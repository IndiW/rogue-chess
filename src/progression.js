import {CAPTURE_XP,PACK_THRESHOLDS,effectOwned,upgradesFor} from './upgrades.js';
import {relics} from './relics.js';
export const emptyMastery=()=>({p:0,n:0,b:0,r:0,q:0,k:0});
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function secureRandom(){const data=new Uint32Array(1);if(globalThis.crypto?.getRandomValues){crypto.getRandomValues(data);return data[0]/4294967296;}return Math.random();}
function sample(items,count,random){const pool=[...items];for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}return pool.slice(0,count);}
export function awardCapture(army,pieceId,captured,battleXp,packs){
 const owner=army.find(p=>p.id===pieceId);if(!owner||!CAPTURE_XP[captured])return 0;
 const xp=CAPTURE_XP[captured]+(effectOwned(owner,'scholar')?1:0);owner.xp+=xp;battleXp[owner.kind]=(battleXp[owner.kind]||0)+xp;
 while(owner.packsEarned<PACK_THRESHOLDS.length && owner.xp>=PACK_THRESHOLDS[owner.packsEarned]){
  owner.packsEarned++;packs.push({id:uid(),owner:owner.id,kind:owner.kind,choices:null});
 }
 return xp;
}
export function rollPack(pack,army,mastery,random=secureRandom,blockedGenerals=[]){
 if(pack.choices)return pack.choices;
 const owner=army.find(p=>p.id===pack.owner);if(!owner)throw new Error('Pack owner missing');
 const eligible=upgradesFor(pack.kind,mastery[pack.kind]||0).filter(u=>!owner.upgrades.includes(u.id)&&!(u.charged&&owner.upgrades.some(id=>{const owned=upgradesFor(pack.kind,Infinity).find(entry=>entry.id===id);return owned&&!owned.charged&&owned.effect===u.effect;})));
 if(eligible.length<2)throw new Error('Not enough eligible piece upgrades');
 const specific=sample(eligible,2,random).map(u=>({kind:'piece',id:u.id}));
 const general=sample(relics.filter(r=>!blockedGenerals.includes(r.id)),1,random).map(r=>({kind:'general',id:r.id}));
 pack.choices=sample([...specific,...general],3,random);return pack.choices;
}
export function claimPack(pack,choiceId,army,inventory){
 if(pack.claimed)throw new Error('Pack already claimed');
 const choice=pack.choices?.find(c=>c.id===choiceId);if(!choice)throw new Error('Choose an offered upgrade');
 if(choice.kind==='general')inventory[choice.id]=(inventory[choice.id]||0)+1;
 else {const owner=army.find(p=>p.id===pack.owner);if(!owner||owner.upgrades.includes(choice.id))throw new Error('Upgrade already equipped');const picked=upgradesFor(pack.kind,Infinity).find(u=>u.id===choice.id);if(!picked.charged)owner.upgrades=owner.upgrades.filter(id=>{const existing=upgradesFor(pack.kind,Infinity).find(u=>u.id===id);return !(existing?.charged&&existing.effect===picked.effect);});owner.upgrades.push(choice.id);}
 pack.claimed=choice.id;return choice;
}
export function rollStarterPack(random=secureRandom){return sample(relics,3,random).map(r=>r.id);}
