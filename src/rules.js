import {Chess} from 'chess.js';
import {createArmy,effectOwned,upgradeById,PACK_THRESHOLDS} from './upgrades.js';
const ORTH=[[1,0],[-1,0],[0,1],[0,-1]], DIAG=[[1,1],[-1,1],[1,-1],[-1,-1]];
const KNIGHT=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
const STRIDE=[[1,3],[3,1],[-1,3],[-3,1],[1,-3],[3,-1],[-1,-3],[-3,-1]];
const coordinates=s=>[s.charCodeAt(0)-97,Number(s[1])-1];
const square=(x,y)=>x>=0&&x<8&&y>=0&&y<8?'abcdefgh'[x]+(y+1):null;
const clone=value=>JSON.parse(JSON.stringify(value));
export class RogueGame {
 constructor(state={}){
  this.chess=new Chess(state.fen);this.army=clone(state.army||createArmy());for(const p of this.army){if(!Number.isFinite(p.captures))p.captures=p.packsEarned?PACK_THRESHOLDS[Math.min(2,p.packsEarned-1)]:0;}this.charges={...state.charges};this.extra=state.extra?{...state.extra}:null;this.echo=state.echo||0;
 }
 static newBattle(army,echo=0,crown=false){
  const game=new RogueGame({army,echo});
  for(const p of game.army){p.square=p.origin;for(const id of p.upgrades){if(upgradeById(id)?.charged)game.charges[`${p.id}:${id}`]=effectOwned(p,'secondwind')?2:1;}}
  if(crown)game.chess.put({type:'n',color:'w'},'a2');
  for(const p of game.army){if(p.kind==='p'&&effectOwned(p,'vanguard')){const target=p.origin[0]+'3';if(!game.get(target)){const figure=game.get(p.origin);game.chess.remove(p.origin);game.chess.put(figure,target);p.square=target;}}}
  return game;
 }
 serialize(){return {fen:this.fen(),army:clone(this.army),charges:{...this.charges},extra:this.extra?{...this.extra}:null,echo:this.echo};}
 clone(){return new RogueGame(this.serialize());}
 fen(){return this.chess.fen();}turn(){return this.chess.turn();}get(s){return this.chess.get(s);}board(){return this.chess.board();}
 owner(square){return this.army.find(p=>p.square===square);}
 charge(piece,id){return this.charges[`${piece.id}:${id}`]||0;}
 requiresVariant(){return !!this.extra||this.echo>0||this.army.some(p=>p.square&&p.upgrades.some(id=>{const u=upgradeById(id);return u&&!['scholar','secondwind','vanguard'].includes(u.effect)&&(!u.charged||this.charge(p,id)>0);}));}
 isCheck(color=this.turn()){
  const king=this.board().flat().find(p=>p?.color===color&&p.type==='k');if(!king)return true;
  const enemy=color==='w'?'b':'w';if(this.chess.isAttacked(king.square,enemy))return true;
  if(enemy==='w')for(const p of this.army){if(!p.square||!effectOwned(p,'longstride')||this.get(p.square)?.type!=='n')continue;const [x,y]=coordinates(p.square),[kx,ky]=coordinates(king.square);if(STRIDE.some(([dx,dy])=>x+dx===kx&&y+dy===ky))return true;}
  return false;
 }
 positionKey(){return this.fen().split(' ').slice(0,4).join(' ')+'|'+JSON.stringify([this.echo,this.extra,this.charges,this.army.filter(p=>p.upgrades.length).map(p=>[p.id,p.square,p.upgrades])]);}
 isCheckmate(){return this.isCheck()&&this.actions().length===0;}
 isDraw(){return (!this.isCheck()&&this.actions().length===0)||Number(this.fen().split(' ')[4])>=100||(!this.requiresVariant()&&this.chess.isInsufficientMaterial());}
 moves({square,verbose=true,power=null}={}){const actions=this.actions({square,charged:!!power,power}).filter(m=>!m.skip);return verbose?actions:actions.map(m=>m.san);}
 actions({square:only,charged=true,power=null}={}){
  const color=this.turn(),actions=[];
  const normals=this.chess.moves({verbose:true}).filter(m=>m.captured!=='k'&&(!only||m.from===only));
  const add=candidate=>{
   try{
    if(candidate.flags?.includes('k')||candidate.flags?.includes('q')){
     if(this.isCheck(color))return;
     const [x,y]=coordinates(candidate.from),mid=square(x+(candidate.flags.includes('k')?1:-1),y),passing=this.clone();
     passing.applyCustom({from:candidate.from,to:mid});if(passing.isCheck(color))return;
    }
    const next=this.clone();next.apply(candidate);if(!next.isCheck(color))actions.push(candidate);
   }catch{}
  };
  if(this.extra){
   const owner=this.army.find(p=>p.id===this.extra.owner);
   if(owner?.square){const ordinary=this.clone();ordinary.extra=null;for(const m of ordinary.actions({square:owner.square,charged:false})){if(!this.extra.nonCapture||!m.captured)add(m);}}
   if(!only)actions.push({skip:true,color,san:'End echo'});return actions;
  }
  if(!power)for(const m of normals)add(this.normal(m));
  if(color!=='w')return actions;
  for(const owner of this.army){
   if(!owner.square||(only&&owner.square!==only))continue;
   const figure=this.get(owner.square);if(!figure||figure.color!=='w')continue;
   const [x,y]=coordinates(owner.square);
   for(const id of owner.upgrades){
    const u=upgradeById(id);if(!u||['scholar','secondwind','vanguard'].includes(u.effect))continue;
    if(u.charged&&(!charged||this.charge(owner,id)<=0))continue;
    if(power&&id!==power)continue;
    if(u.effect==='chain'){
     for(const m of normals)if(m.from===owner.square)add({...this.normal(m),ability:id});continue;
    }
    let targets=[];
    if(u.effect==='recall')targets=[owner.origin];
    if(u.effect==='backstep')targets=[square(x,y-1)];
    if(u.effect==='orthogonal')targets=ORTH.map(([dx,dy])=>square(x+dx,y+dy));
    if(u.effect==='diagonal')targets=DIAG.map(([dx,dy])=>square(x+dx,y+dy));
    if(u.effect==='knight')targets=KNIGHT.map(([dx,dy])=>square(x+dx,y+dy));
    if(u.effect==='longstride'&&figure.type==='n')targets=STRIDE.map(([dx,dy])=>square(x+dx,y+dy));
    if(u.effect==='march')targets=ORTH.filter(([dx,dy])=>{
     const mid=square(x+dx,y+dy);if(!mid||this.get(mid))return false;
     const next=this.clone();next.apply({from:owner.square,to:mid,custom:true,color:'w',piece:figure.type,san:'March'});return !next.isCheck('w');
    }).map(([dx,dy])=>square(x+2*dx,y+2*dy));
    for(const to of targets){
     if(!to||to===owner.square)continue;const target=this.get(to);
     if(target&&(u.effect!=='longstride'||target.color==='w'||target.type==='k'))continue;
     if(figure.type==='p'&&Number(to[1])===1)continue;
     // Skip redundant non-capturing powers that are already ordinary moves.
     if(normals.some(m=>m.from===owner.square&&m.to===to)&&u.effect!=='longstride')continue;
     const promotions=figure.type==='p'&&to[1]==='8'?['q','r','b','n']:[undefined];
     for(const promotion of promotions)add({from:owner.square,to,color:'w',piece:figure.type,captured:target?.type,promotion,ability:id,custom:true,san:`${u.name}: ${owner.square}–${to}${promotion?'='+promotion.toUpperCase():''}`});
    }
   }
   if(this.echo>0&&charged&&(!power||power==='item:echo'))for(const m of normals)if(m.from===owner.square)add({...this.normal(m),ability:'item:echo'});
  }
  return actions;
 }
 normal(m){return {from:m.from,to:m.to,promotion:m.promotion,color:m.color,piece:m.piece,captured:m.captured,flags:m.flags,san:m.san};}
 move(action){
  const candidates=this.actions();const found=candidates.find(m=>!!m.skip===!!action.skip&&m.from===action.from&&m.to===action.to&&m.promotion===action.promotion&&(m.ability||null)===(action.ability||null));
  if(!found)throw new Error('Illegal move');this.apply(found);return found;
 }
 apply(action){
  if(action.skip){if(!this.extra)throw new Error('No extra turn');const ep=this.extra.ep||'-';this.extra=null;this.switchTurn('b',ep);return;}
  const figure=this.get(action.from);if(!figure)throw new Error('Missing piece');const owner=figure.color==='w'?this.owner(action.from):null;
  const wasExtra=!!this.extra;const capturedSquare=action.flags?.includes('e')?action.to[0]+action.from[1]:action.to;
  if(action.custom)this.applyCustom(action);else this.chess.move({from:action.from,to:action.to,promotion:action.promotion});
  if(figure.color==='b'){const victim=this.owner(capturedSquare);if(victim)victim.square=null;}
  if(owner){owner.square=action.to;if(action.flags?.includes('k')||action.flags?.includes('q')){const rook=this.army.find(p=>p.square===(action.flags.includes('k')?'h1':'a1'));if(rook)rook.square=action.flags.includes('k')?'f1':'d1';}}
  if(action.ability==='item:echo')this.echo--;
  else if(owner&&action.ability&&upgradeById(action.ability)?.charged)this.charges[`${owner.id}:${action.ability}`]--;
  const chain=action.ability==='item:echo'||upgradeById(action.ability)?.effect==='chain';
  this.extra=null;
  if(chain&&owner&&!wasExtra&&!this.isCheck('b')){this.extra={owner:owner.id,nonCapture:action.ability!=='item:echo',ep:this.fen().split(' ')[3]};this.switchTurn('w');}
 }
 switchTurn(color,ep='-'){const fields=this.fen().split(' ');fields[1]=color;fields[3]=ep;this.chess.load(fields.join(' '));}
 applyCustom(action){
  const fields=this.fen().split(' '),figure=this.get(action.from),captured=this.get(action.to);
  this.chess.remove(action.from);this.chess.put({type:action.promotion||figure.type,color:figure.color},action.to);
  fields[0]=this.chess.fen().split(' ')[0];fields[1]=figure.color==='w'?'b':'w';fields[3]='-';
  let rights=fields[2];if(figure.type==='k')rights=rights.replace(figure.color==='w'?/[KQ]/g:/[kq]/g,'');
  for(const [s,right] of [['a1','Q'],['h1','K'],['a8','q'],['h8','k']])if(action.from===s||action.to===s)rights=rights.replace(right,'');
  fields[2]=rights||'-';fields[4]=figure.type==='p'||captured?'0':String(Number(fields[4])+1);if(figure.color==='b')fields[5]=String(Number(fields[5])+1);
  this.chess.load(fields.join(' '));
 }
}
