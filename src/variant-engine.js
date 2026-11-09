import {RogueGame} from './rules.js';
import {upgradeById} from './upgrades.js';
const VALUE={p:100,n:325,b:335,r:500,q:950,k:0};
function evaluate(game){
 let score=0;
 for(const row of game.board())for(const p of row){if(!p)continue;const x=p.square.charCodeAt(0)-97,y=Number(p.square[1])-1;const center=3.5-(Math.abs(x-3.5)+Math.abs(y-3.5))/2;
  score+=(p.color==='w'?1:-1)*(VALUE[p.type]+(p.type==='p'?(p.color==='w'?y:7-y)*9:p.type==='k'?-center*7:center*12));}
 for(const p of game.army){if(!p.square)continue;for(const id of p.upgrades){const u=upgradeById(id);if(!u)continue;if(u.effect==='longstride')score+=110;else if(u.charged)score+=Math.min(2,game.charge(p,id))*18;else if(!['scholar','secondwind','vanguard'].includes(u.effect))score+=30;}}
 score+=Math.min(3,game.echo)*25;return score;
}
const order=m=>(m.captured?VALUE[m.captured]*10-(VALUE[m.piece]||0):0)+(m.ability?20:0)+(m.promotion?8000:0)-(m.skip?100:0);
export function variantBestMove(state,{timeMs=1000,depth=3}={}){
 const root=new RogueGame(state),moves=root.actions().sort((a,b)=>order(b)-order(a));if(!moves.length)return null;
 const deadline=performance.now()+timeMs;let nodes=0,best=moves[0];const timeout=Symbol('timeout');
 function checkTime(){if(performance.now()>=deadline)throw timeout;}
 function search(game,remaining,alpha,beta,ply,quiet=2){
  if((++nodes&7)===0)checkTime();
  const actions=game.actions();
  if(!actions.length)return game.isCheck()?(game.turn()==='w'?-100000+ply:100000-ply):0;
  if(Number(game.fen().split(' ')[4])>=100)return 0;
  const maximizing=game.turn()==='w';
  let candidates=actions;
  if(remaining<=0){
   const staticScore=evaluate(game);if(quiet<=0)return staticScore;
   if(!game.isCheck()){
    if(maximizing){if(staticScore>=beta)return staticScore;alpha=Math.max(alpha,staticScore);}else{if(staticScore<=alpha)return staticScore;beta=Math.min(beta,staticScore);}
    candidates=actions.filter(m=>m.captured||m.promotion);if(!candidates.length)return staticScore;
   }
  }
  candidates.sort((a,b)=>order(b)-order(a));
  let value=remaining<=0&&!game.isCheck()?evaluate(game):(maximizing?-Infinity:Infinity);
  for(const action of candidates){
   const next=game.clone();next.apply(action);
   const score=search(next,remaining-1,alpha,beta,ply+1,remaining<=0?quiet-1:quiet);
   value=maximizing?Math.max(value,score):Math.min(value,score);
   if(maximizing)alpha=Math.max(alpha,value);else beta=Math.min(beta,value);
   if(alpha>=beta)break;
  }
  return value;
 }
 const key=m=>[m.from,m.to,m.promotion,m.ability,m.skip].join(':');
 for(let target=1;target<=depth;target++){
  const maximizing=root.turn()==='w';let iterationBest=null,value=maximizing?-Infinity:Infinity,alpha=-Infinity,beta=Infinity;
  const ordered=[...moves].sort((a,b)=>(key(b)===key(best)?1:0)-(key(a)===key(best)?1:0)||order(b)-order(a));
  try{
   for(const action of ordered){checkTime();const next=root.clone();next.apply(action);const score=search(next,target-1,alpha,beta,1);
    if(iterationBest===null||(maximizing?score>value:score<value)){value=score;iterationBest=action;}
    if(maximizing)alpha=Math.max(alpha,value);else beta=Math.min(beta,value);
   }
   if(iterationBest)best=iterationBest;
   if(Math.abs(value)>90000)break;
  }catch(error){if(error!==timeout)throw error;if(target===1&&iterationBest)best=iterationBest;break;}
 }
 return best;
}
