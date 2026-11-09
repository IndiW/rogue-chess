import { sprite } from './pieces.js';
export const PIECE_NAMES = {p:'Pawn',n:'Knight',b:'Bishop',r:'Rook',q:'Queen',k:'King'};
export const CAPTURE_XP = {p:1,n:3,b:3,r:5,q:9};
export const PACK_THRESHOLDS = [3,8,15];
const movement = {
 p:{name:'Backstep',effect:'backstep',desc:'Once per battle, step one square backward into an empty square.'},
 n:{name:'Shadow Step',effect:'diagonal',desc:'Once per battle, step diagonally to an adjacent empty square.'},
 b:{name:'Sidestep',effect:'orthogonal',desc:'Once per battle, step orthogonally to an adjacent empty square.'},
 r:{name:'Corner Step',effect:'diagonal',desc:'Once per battle, step diagonally to an adjacent empty square.'},
 q:{name:'Royal Leap',effect:'knight',desc:'Once per battle, jump like a knight to an empty square.'},
 k:{name:'King’s Leap',effect:'knight',desc:'Once per battle, jump like a knight to an empty, safe square.'},
};
const advanced = {
 p:{name:'Vanguard',effect:'vanguard',desc:'Start each new battle one square farther forward, if the square is empty.'},
 n:{name:'Long Stride',effect:'longstride',desc:'Your knight can also jump three squares in one direction and one sideways, including captures.'},
 b:{name:'Pathfinder',effect:'orthogonal',desc:'Step to an adjacent empty orthogonal square without spending a charge.'},
 r:{name:'Cornerwalk',effect:'diagonal',desc:'Step to an adjacent empty diagonal square without spending a charge.'},
 q:{name:'Skydance',effect:'knight',desc:'Jump like a knight to an empty square without spending a charge.'},
 k:{name:'Royal March',effect:'march',desc:'Move two squares orthogonally into an empty square. Both steps must be safe and clear.'},
};
export const UPGRADES = Object.keys(PIECE_NAMES).flatMap(piece => [
 {id:`${piece}-step`,piece,...movement[piece],category:'movement',charged:true,unlock:0},
 {id:`${piece}-recall`,piece,name:'Recall',effect:'recall',category:'time',charged:true,unlock:0,desc:'Once per battle, return to this piece’s empty starting square. Your king must remain safe.'},
 {id:`${piece}-scholar`,piece,name:'Scholar',effect:'scholar',category:'growth',charged:false,unlock:0,desc:'Captures made by this piece earn 1 extra XP, including permanent mastery.'},
 {id:`${piece}-chain`,piece,name:piece==='n'?'Chain Jump':'Momentum',effect:'chain',category:'time',charged:true,unlock:0,desc:'Once per battle, take a second non-capturing move with this piece. Giving check ends the turn.'},
 {id:`${piece}-advanced`,piece,...advanced[piece],category:'movement',charged:false,unlock:8},
 {id:`${piece}-secondwind`,piece,name:'Second Wind',effect:'secondwind',category:'growth',charged:false,unlock:20,desc:'This piece’s charged abilities each get two uses per battle.'},
]);
export const upgradeById = id => UPGRADES.find(upgrade => upgrade.id===id);
export function upgradesFor(piece,mastery=0){return UPGRADES.filter(u=>u.piece===piece && u.unlock<=mastery);}
export function effectOwned(piece,effect){return (piece?.upgrades||[]).some(id=>upgradeById(id)?.effect===effect);}
export function createArmy(){
 const back='rnbqkbnr';const army=[];
 for(let file=0;file<8;file++)for(const rank of [1,2]){const origin='abcdefgh'[file]+rank;army.push({id:origin,origin,kind:rank===2?'p':back[file],square:origin,xp:0,packsEarned:0,upgrades:[]});}
 return army;
}
export function upgradeSprite(id){
 const u=upgradeById(id);const glyph=u.effect==='scholar'?'M2 1h4v6H2zM4 1v6':u.effect==='recall'?'M1 3h5v4H2M1 3l2-2M1 3l2 2':u.effect==='secondwind'?'M2 1v6M5 1v6':u.category==='movement'?'M1 6l5-5M2 1h4v4':'M1 4h5M4 2l2 2-2 2';
 return `<span class="upgrade-sprite">${sprite(u.piece,'w')}<svg class="upgrade-rune" viewBox="0 0 8 8" aria-hidden="true"><path d="${glyph}" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></span>`;
}
export function packSprite(piece='n'){
 return `<span class="pack-art"><svg viewBox="0 0 24 28" aria-hidden="true" shape-rendering="crispEdges"><path fill="#101b18" d="M3 3h18v23H3z"/><path fill="#65507f" d="M4 4h16v20H4z"/><path fill="#a888ce" d="M4 4h16v3H4zM4 21h16v3H4z"/><path fill="#d7b9ef" d="M5 4h14v1H5zM4 7h1v14H4z"/><path fill="#342d48" d="M19 7h1v14h-1zM5 20h14v1H5z"/><path fill="#e8c784" d="M7 6h2v2H7zM11 6h2v2h-2zM15 6h2v2h-2zM7 22h10v1H7z"/></svg><span class="pack-emblem">${sprite(piece,'w')}</span></span>`;
}
