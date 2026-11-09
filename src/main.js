import {sprite} from './pieces.js';
import {audio} from './audio.js';
import {BrowserEngine} from './browser-engine.js';
import {engineRank} from './engine-settings.js';
import {relics,relicSprite} from './relics.js';
import {PlayerClock,formatClock} from './clock.js';
import {RogueGame} from './rules.js';
import {PIECE_NAMES,PACK_THRESHOLDS,UPGRADES,createArmy,upgradeById,upgradesFor,upgradeSprite,packSprite} from './upgrades.js';
import {emptyMastery,awardCapture,rollPack,claimPack,rollStarterPack} from './progression.js';
import './style.css';

const STORAGE='rogue-chess-v2',copy=value=>JSON.parse(JSON.stringify(value));
let saved,legacy;
try{saved=JSON.parse(localStorage.getItem(STORAGE));legacy=JSON.parse(localStorage.getItem('rogue-chess-v1'));}catch{}
let meta={best:1,runs:0,level:1,relic:null,...legacy,...saved?.profile};
meta.mastery={...emptyMastery(),...saved?.profile?.mastery};
let screen='menu',hasRun=false,clockStarted=false,outcome=null,outcomeTimer=null;
let game,items={echo:0,oracle:0,rewind:0,crown:0},starterSpent=false;
let status='playing',lossReason=null,selected=null,inspectedId=null,legal=[],armedPower=null,hint=null,last=null,log=[],positions=new Map(),snapshots=[];
let packs=[],battleXp=emptyMastery(),committed=false,packRevealed=false,lossChoices=null;
let busy=false,failedSearch=null,pending=null,request=0,message='Select a piece. Make your opening.',storageFailed=false;
const clock=new PlayerClock(),worker=new BrowserEngine();
document.addEventListener('pointerdown',()=>audio.unlock());
document.addEventListener('keydown',()=>audio.unlock());
worker.onstatus=text=>{if(busy){message=text;render();}};
function availableItem(id){return (items[id]||0)+(meta.relic===id&&!starterSpent?1:0);}
function spendItem(id){if(meta.relic===id&&!starterSpent)starterSpent=true;else items[id]=Math.max(0,(items[id]||0)-1);game.echo=availableItem('echo');}
function persist(){
 if(!game)return;
 try{localStorage.setItem(STORAGE,JSON.stringify({version:2,profile:meta,run:hasRun?{clockStarted,outcome,game:game.serialize(),items,starterSpent,status,lossReason,last,log,positions:[...positions],snapshots,packs,battleXp,committed,packRevealed,lossChoices,inspectedId,clock:clock.snapshot()}:null}));}
 catch{storageFailed=true;}
}
function beginBattle(army=game?.army||createArmy()){
 hasRun=true;screen='game';clockStarted=false;outcome=null;clearTimeout(outcomeTimer);
 request++;pending=null;busy=false;failedSearch=null;status='playing';lossReason=null;starterSpent=false;
 const crown=meta.relic==='crown'||items.crown>0;if(meta.relic!=='crown'&&items.crown>0)items.crown--;
 if(meta.relic==='crown')starterSpent=true;
 game=RogueGame.newBattle(army,availableItem('echo'),crown);
 selected=null;inspectedId=null;legal=[];armedPower=null;hint=null;last=null;log=[];snapshots=[];
 positions=new Map();recordPosition();packs=[];battleXp=emptyMastery();committed=false;packRevealed=false;lossChoices=null;
 clock.reset();message='Capture pieces to earn XP and upgrade packs.';render();persist();
}
function restore(){
 const run=saved?.version===2&&saved.run;
 if(!run){
  hasRun=!!legacy&&!saved;game=RogueGame.newBattle(createArmy(),hasRun?availableItem('echo'):0,hasRun&&meta.relic==='crown');clock.reset();screen='menu';render();persist();return;
 }
 try{
  hasRun=true;screen='menu';outcome=run.outcome||null;clockStarted=run.clockStarted??!!run.log?.length;
  game=new RogueGame(run.game);items={...items,...run.items};starterSpent=!!run.starterSpent;status=run.status;lossReason=run.lossReason;
  last=run.last;log=run.log||[];positions=new Map(run.positions||[]);snapshots=run.snapshots||[];packs=run.packs||[];battleXp={...emptyMastery(),...run.battleXp};committed=!!run.committed;packRevealed=!!run.packRevealed;lossChoices=run.lossChoices;inspectedId=run.inspectedId;
  if(game.extra){const owner=game.army.find(p=>p.id===game.extra.owner);selected=owner?.square;legal=game.moves({square:selected});}
  if(run.clock)clock.restore(run.clock);clock.setRunning(false);
  message=status==='playing'?'Your battle has been restored.':status==='won'?'Floor conquered. Open your earned packs.':'Your progress is saved.';
  render();persist();
 }catch{items={echo:0,oracle:0,rewind:0,crown:0};game=RogueGame.newBattle(createArmy());hasRun=false;screen='menu';clock.reset();render();persist();}
}
function commitMastery(){if(committed)return;for(const kind of Object.keys(meta.mastery))meta.mastery[kind]+=battleXp[kind]||0;committed=true;}
function lose(reason){
 if(status!=='playing')return;status='lost';lossReason=reason;commitMastery();packs=[];packRevealed=false;lossChoices=rollStarterPack();
 request++;pending=null;busy=false;failedSearch=null;selected=null;legal=[];armedPower=null;clock.setRunning(false);
 message=reason==='timeout'?'Time is up. Your mastery carries forward.':'The run is over. Your mastery carries forward.';if(reason==='checkmate')beginOutcome('lost');persist();
}
function updateClock(){
 clock.setRunning(hasRun&&screen==='game'&&clockStarted&&status==='playing'&&game.turn()==='w');
 if(hasRun&&clockStarted&&status==='playing'&&clock.expired){lose('timeout');render();return false;}
 const el=document.querySelector('#player-clock');
 if(el){const remaining=clock.remainingMs;el.classList.toggle('clock-running',clock.running);el.classList.toggle('clock-low',remaining<=30000);el.querySelector('.clock-face').textContent=formatClock(remaining);el.querySelector('.clock-state').textContent=status!=='playing'?(lossReason==='timeout'?'Time expired':'Battle ended'):!clockStarted?'Make first move':clock.running?'Your move':'Paused';el.setAttribute('aria-label',`${formatClock(remaining)} remaining. ${clock.running?'Clock running':'Clock paused'}.`);}
 return status==='playing';
}
function recordPosition(){const key=game.positionKey();positions.set(key,(positions.get(key)||0)+1);}
function finish(){
 if(game.isCheckmate()){
  if(game.turn()==='w'){lose('checkmate');return;}
  status='won';meta.best=Math.max(meta.best,meta.level+1);message='Floor conquered. Your army has grown.';commitMastery();beginOutcome('won');
 }else if(game.isDraw()||(positions.get(game.positionKey())||0)>=3){status='draw';message='A draw. Keep your progress and try this floor again.';commitMastery();}
 else if(game.isCheck())message=game.turn()==='w'?'Your king is in check. Find a way out.':'The Warden is in check.';
 if(status!=='playing'){clock.setRunning(false);selected=null;legal=[];armedPower=null;}persist();
}
function ask(kind){
 if(screen!=='game'||!updateClock())return;busy=true;failedSearch=null;message=kind==='hint'?'The Oracle is searching…':'The Warden is thinking…';const id=++request;pending={id,kind};
 game.echo=availableItem('echo');worker.postMessage({id,kind,fen:game.fen(),state:game.serialize(),requiresVariant:game.requiresVariant(),level:meta.level});render();persist();
}
worker.onmessage=({data})=>{
 if(screen!=='game'||!updateClock()||!pending||data.id!==pending.id)return;
 pending=null;busy=false;
 if(data.error){failedSearch=data.kind;message='Engine interrupted. Retry the search below.';render();return;}
 if(data.kind==='hint'){
  spendItem('oracle');hint=data.move;
  if(hint?.from){selected=hint.from;inspectedId=game.owner(selected)?.id;armedPower=hint.ability||null;legal=game.moves({square:selected,power:armedPower});}
  message=hint?`Oracle reveals ${hint.san}. Follow the highlighted move.`:'No legal moves remain.';
 }else if(data.move){
  try{const m=game.move(data.move);last=m;audio.playMove(m,game.isCheck());appendLog(m);recordPosition();message='Your move. Every capture builds your army.';finish();}
  catch{failedSearch='engine';message='Engine returned an invalid move. Retry the search.';}
 }
 render();persist();
};
function appendLog(move){let san=move.san.replace(/[+#]$/,'');if(game.isCheck())san+=game.isCheckmate()?'#':'+';log.push({color:move.color,san});}
function squareClick(sq){
 if(screen!=='game'||!updateClock()||busy||game.turn()!=='w')return;
 if(legal.some(m=>m.to===sq)){
  const options=legal.filter(m=>m.to===sq);
  if(options.some(m=>m.promotion)){promotionPicker(options);return;}
  play(options[0]);return;
 }
 const p=game.get(sq),owner=game.owner(sq);
 if(p?.color==='w'&&(!game.extra||owner?.id===game.extra.owner)){
  if(selected!==sq&&armedPower!=='item:echo')armedPower=null;
  selected=sq;inspectedId=owner?.id;legal=game.moves({square:sq,power:armedPower});message=game.extra?'Take your extra move, or end your turn.':`${PIECE_NAMES[p.type]} on ${sq}. Choose a highlighted square.`;
 }else{selected=null;legal=[];if(armedPower!=='item:echo')armedPower=null;}
 render();
}
function promotionPicker(options){
 document.querySelector('#overlay').innerHTML=`<div class="veil"><section class="dialog"><h2>Claim your crown</h2><p>Choose your promotion. Your clock is running.</p><div class="promotion">${options.map(m=>`<button data-promote="${m.promotion}" aria-label="Promote to ${PIECE_NAMES[m.promotion]}">${sprite(m.promotion,'w')}</button>`).join('')}</div></section></div>`;
 document.querySelectorAll('[data-promote]').forEach(b=>b.onclick=()=>play(options.find(m=>m.promotion===b.dataset.promote)));
}
function saveTurn(){snapshots.push({game:game.serialize(),log:copy(log),last:copy(last),positions:[...positions],packs:copy(packs),battleXp:{...battleXp}});if(snapshots.length>12)snapshots.shift();}
function play(action){
 if(screen!=='game'||!updateClock()||busy)return;
 if(!game.extra)saveTurn();const owner=game.owner(action.from),ownerId=owner?.id;
 let m;try{m=game.move(action);}catch{return;}
 clockStarted=true;
 if(m.ability==='item:echo')spendItem('echo');
 const xp=m.captured&&ownerId?awardCapture(game.army,ownerId,m.captured,battleXp,packs):0;
 audio.playMove(m,game.isCheck());last=m;appendLog(m);hint=null;selected=null;legal=[];armedPower=null;
 if(ownerId)inspectedId=ownerId;
 message=xp?`Capture. +${xp} XP for ${PIECE_NAMES[owner.kind]} ${owner.origin}.`:'Your move is made.';
 if(!game.extra)recordPosition();finish();
 if(status!=='playing'){render();persist();return;}
 if(game.extra){const piece=game.army.find(p=>p.id===game.extra.owner);selected=piece?.square;legal=game.moves({square:selected});message='An echo remains. Move this piece again, or end your turn.';render();persist();}
 else ask('engine');
}
function endExtra(){if(!updateClock()||busy||!game.extra)return;game.move({skip:true});selected=null;legal=[];armedPower=null;recordPosition();finish();if(status==='playing')ask('engine');else render();persist();}
function armUpgrade(id){
 if(!updateClock()||busy||game.turn()!=='w'||game.extra)return;
 const owner=game.army.find(p=>p.id===inspectedId);if(!owner?.square||!owner.upgrades.includes(id)||game.charge(owner,id)<=0)return;
 armedPower=armedPower===id?null:id;selected=owner.square;legal=game.moves({square:selected,power:armedPower});message=armedPower?`${upgradeById(id).name} armed. Choose a highlighted square.`:'Power cancelled.';render();
}
function activateItem(id){
 if(!updateClock()||busy||game.turn()!=='w'||game.extra||availableItem(id)<=0)return;
 if(id==='echo'){armedPower=armedPower==='item:echo'?null:'item:echo';legal=selected?game.moves({square:selected,power:armedPower}):[];message=armedPower?'Echo stone armed. Select a piece and make its first move.':'Echo cancelled.';render();}
 if(id==='oracle')ask('hint');
 if(id==='rewind'&&snapshots.length){
  const snapshot=snapshots.pop();game=new RogueGame(snapshot.game);log=snapshot.log;last=snapshot.last;positions=new Map(snapshot.positions);packs=snapshot.packs;battleXp=snapshot.battleXp;
  spendItem('rewind');selected=null;legal=[];armedPower=null;hint=null;message='Position and capture XP restored. Time and consumed items stay spent.';render();persist();
 }
}
function openPack(){
 if(status==='lost'){if(!lossChoices)lossChoices=rollStarterPack();packRevealed=true;persist();render();return;}
 if(!['won','draw'].includes(status)||!packs.length)return;
 const pack=packs[0];rollPack(pack,game.army,meta.mastery,undefined,meta.relic==='crown'?['crown']:[]);packRevealed=true;persist();render();
}
function pickReward(id){
 if(!packRevealed)return;
 if(status==='lost'){
  if(!lossChoices?.includes(id))return;
  meta.relic=id;meta.runs++;meta.level=1;items={echo:0,oracle:0,rewind:0,crown:0};beginBattle(createArmy());return;
 }
 if(!['won','draw'].includes(status)||!packs.length)return;
 try{claimPack(packs[0],id,game.army,items);}catch{return;}
 packs.shift();packRevealed=false;persist();render();
}
function goMenu(){
 clock.setRunning(false);screen='menu';request++;pending=null;busy=false;failedSearch=null;clearTimeout(outcomeTimer);persist();render();
}
function resumeRun(){
 if(!hasRun)return;screen='game';message=!clockStarted?'Make your first move to start the clock.':'Your run is ready. Make your next move.';
 render();scheduleOutcome();if(status==='playing'&&game.turn()==='b')ask('engine');persist();
}
function restartRun(){
 if(hasRun&&status==='playing')commitMastery();meta.runs++;meta.level=1;items={echo:0,oracle:0,rewind:0,crown:0};beginBattle(createArmy());
}
function quitRun(){
 if(hasRun&&status==='playing')commitMastery();clock.setRunning(false);hasRun=false;screen='menu';request++;pending=null;busy=false;outcome=null;clearTimeout(outcomeTimer);persist();render();
}
function confirmRunAction(action){
 const restart=action==='restart';document.querySelector('#overlay').innerHTML=`<div class="veil"><section class="dialog"><h2>${restart?'Restart this run?':'Quit this run?'}</h2><p>Your permanent capture mastery is kept. Equipped piece upgrades, inventory, and unopened packs from this run are discarded.</p><p>${restart?'You will start again at floor 1 with a fresh army and clock.':'This run will no longer be resumable. You can start a new run from the main menu.'}</p><button class="primary" id="confirm-run-action">${restart?'Restart run':'Quit run'}</button><button class="quiet" id="cancel-run-action">Go back</button></section></div>`;
 document.querySelector('#confirm-run-action').onclick=restart?restartRun:quitRun;document.querySelector('#cancel-run-action').onclick=render;
}
function beginOutcome(result){outcome={result,startedAt:Date.now()};scheduleOutcome();}
function outcomePhase(){if(!outcome)return null;const elapsed=Date.now()-outcome.startedAt;return elapsed<800?'impact':elapsed<2800?'banner':null;}
function scheduleOutcome(){
 clearTimeout(outcomeTimer);if(!outcome||screen!=='game')return;const elapsed=Date.now()-outcome.startedAt;
 if(elapsed>=2800){outcome=null;persist();render();return;}
 outcomeTimer=setTimeout(()=>{render();scheduleOutcome();},Math.max(20,(elapsed<800?800:2800)-elapsed));
}
function outcomeBanner(){
 const won=outcome.result==='won';return `<div class="outcome-overlay" role="status"><div class="victory-ribbon ${won?'':'defeat-ribbon'}"><div class="ribbon-content">${won?'<span class="victory-number">#1</span>':''}<div><h2>CHECKMATE</h2><p>${won?'FLOOR CONQUERED':'KING DOWN · RUN ENDED'}</p></div></div></div><button id="continue-outcome" class="outcome-continue">Continue →</button></div>`;
}
function rewardCard(choice,index){
 const specific=choice.kind==='piece',entry=specific?upgradeById(choice.id):relics.find(r=>r.id===choice.id);
 const type=specific?entry.category:entry.type;
 return `<button class="choice pack-choice item-${type}" style="--reveal-delay:${index*70}ms" data-reward="${entry.id}"><span class="choice-art">${specific?upgradeSprite(entry.id):relicSprite(entry.id)}</span><span class="item-type">${specific?PIECE_NAMES[entry.piece]+' · '+(entry.charged?'Charged ability':'Passive'):status==='lost'?'Starting relic · '+entry.typeName:'General · '+entry.typeName}</span><strong>${entry.name}</strong><span class="choice-desc">${specific?entry.desc:status==='lost'?'Refreshes each battle. '+entry.desc:entry.id==='crown'?'One charge. Transform your a-pawn into a knight at the next battle.':'One charge. '+entry.desc}</span></button>`;
}
function result(){
 if(status==='playing')return '';
 if(outcomePhase()==='impact')return '';
 if(outcomePhase()==='banner')return outcomeBanner();
 const lost=status==='lost',pack=packs[0],owner=pack&&game.army.find(p=>p.id===pack.owner);
 if((lost||pack)&&!packRevealed)return `<div class="veil"><section class="dialog pack-dialog"><div class="sealed-pack">${packSprite(lost?'k':pack.kind)}</div><h2>${lost?(lossReason==='timeout'?'Out of time.':lossReason==='checkmate'?'K.O. Your king has fallen.':'Fall. Learn. Return.'):`${PIECE_NAMES[pack.kind]} pack earned.`}</h2><p>${lost?'Your capture mastery survives. Open a pack and choose a starting relic for the next run.':`${PIECE_NAMES[pack.kind]} ${owner.origin} earned an upgrade pack through captures. Two piece upgrades. One general item. Pick one.`}</p><p class="pack-summary">${lost?`${Object.values(battleXp).reduce((a,b)=>a+b,0)} mastery XP banked · Piece builds reset`:`${packs.length} pack${packs.length===1?'':'s'} waiting · Clock paused`}</p><button class="primary" id="open-pack">Open pack <span>→</span></button></section></div>`;
 if(packRevealed&&(lost||pack)){
  const choices=lost?lossChoices.map(id=>({kind:'general',id})):pack.choices;
  return `<div class="veil"><section class="dialog reward-dialog"><h2>${lost?'A second chance.':`${PIECE_NAMES[pack.kind]} ${owner.origin}: choose your upgrade.`}</h2><p>${lost?'Choose one starting relic. Your permanent mastery and unlocked options carry into the new run.':'Choose one reward. Piece upgrades attach to this piece for the run; general items go into your inventory.'}</p><div class="pack-choices">${choices.map(rewardCard).join('')}</div><small>The other two rewards are discarded. ${storageFailed?'Browser saving is unavailable; keep this tab open.':'This roll is saved.'}</small></section></div>`;
 }
 return `<div class="veil"><section class="dialog"><span class="result-art">${sprite('k','w')}</span><h2>${status==='won'?'Floor conquered.':'A quiet stalemate.'}</h2><p>${status==='won'?'Your army, XP, and upgrades advance with you. The next Warden is stronger.':'Your army keeps its XP and upgrades. Replay this floor with a fresh clock.'}</p><p>${Object.values(battleXp).reduce((a,b)=>a+b,0)} capture XP added to permanent mastery.</p><button class="primary" id="advance">${status==='won'?`Descend to floor ${meta.level+1}`:`Replay floor ${meta.level}`} <span>→</span></button></section></div>`;
}
function renderInventory(){
 const list=relics.filter(r=>availableItem(r.id)>0||meta.relic===r.id);
 return `<section><div class="section-title"><h2>Your items</h2><span>${Object.values(items).reduce((a,b)=>a+b,0)} LOOTED</span></div><div class="item-bag">${list.length?list.map(r=>{
  const count=availableItem(r.id),passive=r.id==='crown',disabled=passive||!count||busy||status!=='playing'||game.turn()!=='w'||!!game.extra||(r.id==='rewind'&&!snapshots.length);
  return `<button class="bag-item item-${r.type} ${armedPower==='item:echo'&&r.id==='echo'?'armed':''}" data-item="${r.id}" ${disabled?'disabled':''} title="${r.desc}"><span class="bag-art">${relicSprite(r.id)}</span><span><strong>${r.name}</strong><span class="item-type">${r.type} · ${passive?(meta.relic==='crown'?'Starting relic':'Next battle'):count?`${count} charge${count===1?'':'s'}`:'Used this battle'}</span><small>${passive?'Automatic':r.id==='echo'&&armedPower==='item:echo'?'Cancel echo':count?'Use item':'Refreshes next battle'}</small></span></button>`;
 }).join(''):'<div class="bag-empty"><div class="empty-art"><span></span><span></span></div><p>General items from packs<br>will appear here.</p></div>'}</div>${game.extra?'<button class="primary" id="end-echo">End extra turn →</button>':''}</section>`;
}
function renderPiece(){
 const owner=game.army.find(p=>p.id===inspectedId);
 if(!owner)return `<section class="piece-sheet"><div class="section-title"><h2>Piece progression</h2></div><p class="piece-empty">Select a piece to inspect its XP and powers.</p><p class="xp-legend">Capture XP: pawn 1 · minor 3 · rook 5 · queen 9</p><small>Packs at 3, 8 and 15 XP.</small></section>`;
 const next=PACK_THRESHOLDS[owner.packsEarned],progress=next?Math.min(100,owner.xp/next*100):100;
 return `<section class="piece-sheet"><div class="piece-identity"><span>${sprite(owner.kind,'w')}</span><div><h2>${PIECE_NAMES[owner.kind]} ${owner.origin}</h2><small>${owner.square?(game.get(owner.square)?.type!==owner.kind?PIECE_NAMES[game.get(owner.square)?.type]+' on '+owner.square:'On '+owner.square):'Returns next battle'} · ${owner.xp} XP</small></div></div><div class="xp-track"><span style="width:${progress}%"></span></div><div class="xp-caption">${next?`${owner.xp} / ${next} XP for next pack`:'All three packs earned'} <span>${owner.packsEarned}/3</span></div><div class="piece-talents">${owner.upgrades.length?owner.upgrades.map(id=>{
  const u=upgradeById(id),charges=game.charge(owner,id),canUse=u.charged&&charges>0&&owner.square&&status==='playing'&&!busy&&game.turn()==='w'&&!game.extra&&game.moves({square:owner.square,power:id}).length>0;
  return `<button class="talent item-${u.category} ${armedPower===id?'armed':''}" data-power="${id}" title="${u.desc}" ${!canUse?'disabled':''}><span>${u.name}</span><small>${u.charged?`${charges} charge${charges===1?'':'s'}`:'Passive'}</small><span class="talent-description">${u.desc}</span></button>`;
 }).join(''):'<p class="piece-empty">No upgrades equipped yet.<br>Captures earn your first pack.</p>'}</div></section>`;
}
function renderLog(){
 const rows=[];let current={white:[],black:null};
 for(const entry of log){if(entry.color==='w'){if(current.black){rows.push(current);current={white:[],black:null};}current.white.push(entry.san);}else{if(current.black){rows.push(current);current={white:[],black:null};}current.black=entry.san;}}
 if(current.white.length||current.black)rows.push(current);
 return `<section class="chronicle"><div class="section-title"><h2>Battle log</h2><span>${rows.length} TURNS</span></div><div class="moves">${rows.length?rows.map((r,i)=>`<div><span>${i+1}.</span><b>${r.white.join(' → ')||'···'}</b><b>${r.black||'···'}</b></div>`).join(''):'<p class="no-moves">Every story starts<br>with a first move.</p>'}</div></section>`;
}
function audioIcon(kind){return `<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">${kind==='music'?'<path d="M8 14V4l8-2v10M8 7l8-2"/><path d="M8 14c0 3-5 4-5 1s5-4 5-1ZM16 12c0 3-5 4-5 1s5-4 5-1Z"/>':'<path d="M3 8h3l4-4v12l-4-4H3ZM13 7c2 2 2 4 0 6M16 4c4 4 4 8 0 12"/>'}</svg>`;}
function updateAudioControls(){for(const [id,on,label] of [['music',audio.music,'Music'],['effects',audio.effects,'Sounds']]){const b=document.querySelector('#'+id);b.setAttribute('aria-pressed',String(on));const action=id==='music'?(on?'Mute music':'Play 8-bit music'):(on?'Mute sound effects':'Enable sound effects');b.setAttribute('aria-label',audio.unavailable?'Audio unavailable in this browser':action);b.title=b.getAttribute('aria-label');b.querySelector('span').textContent=audio.unavailable?'Unavailable':`${label} ${on?'on':'off'}`;b.disabled=audio.unavailable;}}
function headerHtml(){return `<header><a class="brand" href="./"><span class="brand-mark">${sprite('r','w')}</span>ROGUE<span>CHESS</span></a><div class="header-right"><span class="local-dot"></span> LOCAL ENGINE <div class="audio-controls" aria-label="Audio controls"><button class="audio-toggle" id="music" aria-pressed="${audio.music}" aria-label="${audio.music?'Mute music':'Play 8-bit music'}">${audioIcon('music')}<span>Music ${audio.music?'on':'off'}</span></button><button class="audio-toggle" id="effects" aria-pressed="${audio.effects}" aria-label="${audio.effects?'Mute sound effects':'Enable sound effects'}">${audioIcon('effects')}<span>Sounds ${audio.effects?'on':'off'}</span></button></div>${screen==='game'?'<button class="quiet game-menu-button" id="game-menu">Menu</button>':''}<button class="quiet" id="help" aria-label="How to play"><span class="help-label">How to play</span><span class="help-mark">?</span></button></div></header>`;}
function bindHeader(){
 document.querySelector('#music').onclick=async()=>{await audio.toggleMusic();updateAudioControls();};
 document.querySelector('#effects').onclick=async()=>{await audio.toggleEffects();updateAudioControls();};
 document.querySelector('.brand').onclick=event=>{event.preventDefault();if(screen==='game')goMenu();};document.querySelector('#help').onclick=showHelp;document.querySelector('#game-menu')?.addEventListener('click',goMenu);updateAudioControls();
}
function renderMenu(){
 const preview=RogueGame.newBattle(createArmy());
 const summary=hasRun?(status==='playing'?`Floor ${meta.level} · ${!clockStarted?'Clock not started':formatClock(clock.remainingMs)+' left'} · Run paused`:'Battle ended · Rewards ready'):'A fresh army. A fresh chance.';
 document.querySelector('#app').innerHTML=`${headerHtml()}<main class="main-menu"><section class="menu-world" aria-hidden="true"><div class="menu-board">${preview.board().flatMap((row,r)=>row.map((p,c)=>`<span class="menu-square ${(r+c)%2?'dark':'light'}">${p?sprite(p.type,p.color):''}</span>`)).join('')}</div><div class="menu-pack">${packSprite('n')}</div></section><section class="menu-content"><h1>One more<br><em>chance.</em></h1><p>Capture pieces. Open packs.<br>Build an army worth another run.</p><div class="menu-run-summary"><strong>${hasRun?'RUN '+String(meta.runs).padStart(3,'0'):'ROGUE CHESS'}</strong><span>${summary}</span></div><div class="menu-actions">${hasRun?`<button class="primary" id="resume-run">${status==='playing'?'Resume run':'Continue to rewards'} <span>→</span></button><button class="menu-action" id="restart-run">Restart run <small>Start again at floor 1</small></button><button class="menu-action quit-action" id="quit-run">Quit run <small>Keep mastery, discard this run</small></button>`:'<button class="primary" id="new-run">Start new run <span>→</span></button>'}<button class="menu-action" id="mastery">Piece mastery <small>${Object.values(meta.mastery).reduce((a,b)=>a+b,0)} lifetime capture XP</small></button></div><p class="menu-clock-note">Three minutes of thinking time.<br>The clock starts after White’s first move.</p></section></main><footer><span>FORTUNE FAVORS THE PERSISTENT.</span><span>CAPTURE. EVOLVE. RETURN.</span></footer><div id="overlay"></div>`;
 document.querySelector('#resume-run')?.addEventListener('click',resumeRun);document.querySelector('#new-run')?.addEventListener('click',restartRun);document.querySelector('#restart-run')?.addEventListener('click',()=>confirmRunAction('restart'));document.querySelector('#quit-run')?.addEventListener('click',()=>confirmRunAction('quit'));document.querySelector('#mastery').onclick=showMastery;bindHeader();updateClock();
}
function render(){
 if(screen==='menu'){renderMenu();return;}
 const unlocked=UPGRADES.filter(u=>u.unlock>0&&meta.mastery[u.piece]>=u.unlock).length;
 document.querySelector('#app').innerHTML=`${headerHtml()}
 <main><aside class="journey"><div class="run-label">RUN ${String(meta.runs).padStart(3,'0')}</div><h1>One king.<br>Endless<br><em>chances.</em></h1><p class="intro">Outplay the dungeon.<br>Every capture builds your army.</p><div class="floor-track">${[1,2,3,4,5].map(n=>`<div class="floor ${meta.level===n?'current':''} ${meta.level>n?'complete':''}"><span class="node">${meta.level>n?'✓':n}</span><div><strong>${['The gatehouse','Moss-covered halls','The old library','Ashen courtyard','The throne room'][n-1]}</strong><small>${meta.level===n?'YOU ARE HERE':meta.level>n?'CONQUERED':`FLOOR ${n}`}</small></div></div>`).join('')}${meta.level>5?`<div class="floor current"><span class="node">${meta.level}</span><strong>The endless depths</strong></div>`:''}</div><div class="best">DEEPEST FLOOR <strong>${String(meta.best).padStart(2,'0')}</strong></div><button class="mastery-button" id="mastery">Piece mastery <span>${unlocked}/12 unlocks</span></button>${packs.length&&status==='playing'?`<p class="packs-waiting">${packs.length} upgrade pack${packs.length===1?'':'s'} earned<br>Open after this battle.</p>`:''}</aside>
 <section class="arena ${outcomePhase()==='impact'?'checkmate-impact':''}"><div class="opponent"><div class="avatar enemy">${sprite('k','b')}</div><div><strong>The Warden</strong><small>Floor ${meta.level} · ${engineRank(meta.level)} · ${game.requiresVariant()?'Rogue-aware engine':worker.fallbackOnly?'Classic engine':'Stockfish 17.1'}</small></div><span class="turn-badge ${busy?'thinking':''}">${busy?'THINKING…':'BLACK'}</span></div><div class="board-frame"><div class="board" role="group" aria-label="Chessboard. You play white.">${game.board().flatMap((row,r)=>row.map((p,c)=>{const sq='abcdefgh'[c]+(8-r),target=legal.some(m=>m.to===sq),owner=game.owner(sq),ranks=owner?.upgrades.length||0;return `<button class="square ${(r+c)%2?'dark':'light'} ${selected===sq?'selected':''} ${last&&(last.from===sq||last.to===sq)?'last':''} ${hint&&(hint.from===sq||hint.to===sq)?'hint':''} ${lossReason==='checkmate'||status==='won'?p?.type==='k'&&p.color===(status==='won'?'b':'w')?(outcomePhase()==='impact'?'king-fall':'king-defeated'):'':''}" data-square="${sq}" aria-label="${sq}${p?' '+(p.color==='w'?'White':'Black')+' '+PIECE_NAMES[p.type]:''}${ranks?', '+ranks+' upgrades':''}${target?', legal move':''}" ${busy?'disabled':''}>${c===0?`<span class="rank">${8-r}</span>`:''}${r===7?`<span class="file">${'abcdefgh'[c]}</span>`:''}${p?sprite(p.type,p.color):''}${ranks?`<span class="piece-ranks" aria-hidden="true">${'<i></i>'.repeat(ranks)}</span>`:''}${target?`<span class="move-dot ${p?'capture':''}"></span>`:''}</button>`;})).join('')}</div></div><div class="player"><div class="avatar">${sprite('k','w')}</div><div><strong>You, the Wanderer</strong><small>${game.extra?'An echo remains':game.isCheck()&&game.turn()==='w'?'Your king is in check':'The ivory army'}</small></div><div class="player-clock" id="player-clock" role="timer" aria-live="off"><span class="clock-face">${formatClock(clock.remainingMs)}</span><span class="clock-state">Your move</span></div></div><div class="status" role="status"><span class="status-dot"></span>${message}${failedSearch?'<button class="quiet" id="retry-engine">Retry search</button>':''}</div></section>
 <aside class="inventory">${renderInventory()}${renderPiece()}${renderLog()}<button class="resign" id="resign" ${busy||status!=='playing'?'disabled':''}>Resign this run <span>↗</span></button><p class="save-note">${storageFailed?'Saving unavailable in this browser.':'Battle, packs and mastery saved on this device.'}</p></aside></main><footer><span>FORTUNE FAVORS THE PERSISTENT.</span><span>CAPTURE. EVOLVE. RETURN.</span></footer><div id="overlay">${result()}</div>`;
 document.querySelectorAll('[data-square]').forEach(b=>b.onclick=()=>squareClick(b.dataset.square));
 document.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>activateItem(b.dataset.item));
 document.querySelectorAll('[data-power]').forEach(b=>b.onclick=()=>armUpgrade(b.dataset.power));
 document.querySelectorAll('[data-reward]').forEach(b=>b.onclick=()=>pickReward(b.dataset.reward));
 document.querySelector('#open-pack')?.addEventListener('click',openPack);
 document.querySelector('#advance')?.addEventListener('click',()=>{if(packs.length)return;if(status==='won')meta.level++;beginBattle();});
 document.querySelector('#end-echo')?.addEventListener('click',endExtra);
 document.querySelector('#retry-engine')?.addEventListener('click',()=>ask(failedSearch));
 document.querySelector('#resign').onclick=()=>{document.querySelector('#overlay').innerHTML='<div class="veil"><section class="dialog"><h2>Leave this battle?</h2><p>Your capture mastery will be kept. This run’s equipped upgrades and unopened packs will be lost.</p><button class="primary" id="confirm-resign">Resign & open a starter pack</button><button class="quiet" id="cancel">Keep playing</button></section></div>';document.querySelector('#confirm-resign').onclick=()=>{lose('resign');render();};document.querySelector('#cancel').onclick=render;};
 document.querySelector('#mastery').onclick=showMastery;document.querySelector('#continue-outcome')?.addEventListener('click',()=>{outcome=null;clearTimeout(outcomeTimer);persist();render();});bindHeader();updateClock();
}
function showHelp(){
 document.querySelector('#overlay').innerHTML=`<div class="veil"><section class="dialog"><h2>Build your next chance.</h2><p>Play White. Select a piece, then a highlighted square. Standard chess rules apply alongside your equipped powers.</p><p><strong>Capture XP:</strong> pawn 1, knight/bishop 3, rook 5, queen 9. Each piece earns packs at 3, 8, and 15 XP. Open earned packs after a win or draw: two random upgrades for that piece and one general item. Choose one; discard the rest.</p><p><strong>Your army:</strong> XP and equipped upgrades follow the same piece between floors. Captured pieces return next battle. Charged piece powers refresh each battle. General items from packs are consumable; your starting relic refreshes each battle. Royal seed loot is used automatically at the next battle.</p><p><strong>Permanent mastery:</strong> capture XP is banked when a battle ends, even on defeat. At 8 and 20 lifetime XP for a piece type, new options enter its packs. A lost run resets piece builds and inventory, then offers a random three-choice starter pack.</p><p><strong>3-minute clock:</strong> starts after White’s first move, then runs on your turn, including powers, promotions, Oracle searches and background tabs. It pauses for Black, in the main menu, and between battles. Hourglass restores the board and capture XP, but never refunds time or consumed items.</p><p><strong>Your powers:</strong> inspect a piece and select a charged ability to arm it. Pick a highlighted destination. Momentum gives a second non-capturing move; Echo stone can also capture on its extra move. Giving check ends either extra turn.</p><p><strong>Opponent:</strong> Stockfish 17.1 handles standard positions. A separate search uses the same upgrade rules as you whenever movement powers are available. Oracle also accounts for your powers.</p><p><a href="${import.meta.env.BASE_URL}engine/NOTICE.txt" target="_blank" rel="noopener">Engine credits</a> · <a href="${import.meta.env.BASE_URL}engine/COPYING.txt" target="_blank" rel="noopener">GPLv3</a> · <a href="${import.meta.env.BASE_URL}engine/stockfish-source.tar.gz">Engine source</a></p><button class="primary" id="close-help">${screen==='menu'?'Back to menu':'Back to the board'}</button></section></div>`;
 document.querySelector('#close-help').onclick=render;
}
function showMastery(){
 document.querySelector('#overlay').innerHTML=`<div class="veil"><section class="dialog reward-dialog"><h2>Every capture leaves a mark.</h2><p>Mastery survives defeat. New branches enter your random packs at 8 and 20 lifetime XP for each piece type.</p><div class="mastery-grid">${Object.keys(PIECE_NAMES).map(kind=>`<div class="mastery-entry"><div class="mastery-figure">${sprite(kind,'w')}</div><h3>${PIECE_NAMES[kind]}</h3><strong>${meta.mastery[kind]} lifetime XP</strong>${UPGRADES.filter(u=>u.piece===kind&&u.unlock).map(u=>`<p class="${meta.mastery[kind]>=u.unlock?'unlocked':''}">${meta.mastery[kind]>=u.unlock?'Unlocked':'At '+u.unlock+' XP'} · ${u.name}</p>`).join('')}</div>`).join('')}</div><button class="primary" id="close-mastery">${screen==='menu'?'Back to menu':'Back to the board'}</button></section></div>`;
 document.querySelector('#close-mastery').onclick=render;
}
restore();
setInterval(updateClock,100);
setInterval(persist,1000);
document.addEventListener('visibilitychange',()=>{updateClock();persist();});
window.addEventListener('focus',updateClock);
window.addEventListener('pagehide',()=>{screen='menu';clock.setRunning(false);persist();});
window.addEventListener('pageshow',event=>{if(event.persisted)render();});
