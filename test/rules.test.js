import {test} from 'node:test';import assert from 'node:assert/strict';import {RogueGame} from '../src/rules.js';import {createArmy} from '../src/upgrades.js';
const withUpgrade=(origin,id)=>{const army=createArmy();army.find(p=>p.id===origin).upgrades=[id];return RogueGame.newBattle(army);};
test('standard moves, castling metadata and en passant still work',()=>{
 const g=RogueGame.newBattle(createArmy());assert.equal(g.moves().length,20);g.move({from:'e2',to:'e4'});g.move({from:'a7',to:'a6'});g.move({from:'e4',to:'e5'});g.move({from:'d7',to:'d5'});const ep=g.move({from:'e5',to:'d6'});assert.equal(ep.captured,'p');assert.equal(g.owner('d6').id,'e2');
});
test('charged movement is legal once, consumes a charge, and never captures a king',()=>{
 const g=withUpgrade('b1','n-step');const actions=g.moves({square:'b1',power:'n-step'});assert.ok(actions.some(m=>m.to==='a2')===false); // occupied by a friendly pawn
 g.move({from:'a2',to:'a3'});g.move({from:'a7',to:'a6'});const step=g.moves({square:'b1',power:'n-step'}).find(m=>m.to==='a2');assert.ok(step);g.move(step);assert.equal(g.charge(g.owner('a2'),'n-step'),0);assert.equal(g.turn(),'b');assert.ok(g.actions().every(m=>m.captured!=='k'));
});
test('Chain Jump grants only a non-capturing second action and permits ending early',()=>{
 const g=withUpgrade('b1','n-chain');const action=g.moves({square:'b1',power:'n-chain'}).find(m=>m.to==='c3');g.move(action);assert.equal(g.turn(),'w');assert.equal(g.extra.owner,'b1');assert.ok(g.actions().every(m=>m.skip||!m.captured));g.move({skip:true});assert.equal(g.turn(),'b');assert.equal(g.extra,null);
});
test('Echo consumes a charge and checking ends the extra turn before a king can be captured',()=>{
 const army=createArmy();army.forEach(p=>p.square=null);const rook=army.find(p=>p.id==='a1');rook.square='e2';const king=army.find(p=>p.id==='e1');king.square='a1';const g=new RogueGame({fen:'4k3/8/8/8/8/8/4R3/K7 w - - 0 1',army,echo:1});const action=g.actions().find(m=>m.from==='e2'&&m.to==='e7'&&m.ability==='item:echo');g.move(action);assert.equal(g.turn(),'b');assert.equal(g.extra,null);assert.equal(g.echo,0);assert.ok(g.actions().every(m=>m.captured!=='k'));
});
test('Long Stride attacks restrict the black king, including when ordinary chess sees no check',()=>{
 const army=createArmy();army.forEach(p=>p.square=null);const p=army.find(p=>p.id==='b1');p.square='c3';p.upgrades=['n-advanced'];army.find(p=>p.id==='e1').square='a1';const g=new RogueGame({fen:'8/8/3k4/8/8/2N5/8/K7 b - - 0 1',army});assert.equal(g.chess.isCheck(),false);assert.equal(g.isCheck(),true);for(const move of g.actions()){const next=g.clone();next.apply(move);assert.equal(next.isCheck('b'),false);}
});
test('Vanguard starts farther forward, Second Wind doubles charges, and upgrades follow identity',()=>{
 const army=createArmy();const pawn=army.find(p=>p.id==='a2');pawn.upgrades=['p-advanced'];const knight=army.find(p=>p.id==='b1');knight.upgrades=['n-chain','n-secondwind'];knight.xp=12;const g=RogueGame.newBattle(army);assert.equal(g.owner('a3').id,'a2');assert.equal(g.get('a2'),undefined);assert.equal(g.charge(g.owner('b1'),'n-chain'),2);assert.equal(g.owner('b1').xp,12);
});
test('castling cannot pass through a square attacked by an upgraded knight',()=>{
 const army=createArmy();army.forEach(p=>p.square=null);const knight=army.find(p=>p.id==='b1');knight.square='g5';knight.upgrades=['n-advanced'];army.find(p=>p.id==='e1').square='a1';
 const g=new RogueGame({fen:'4k2r/8/8/6N1/8/8/8/K7 b k - 0 1',army});
 assert.ok(g.chess.moves({verbose:true}).some(m=>m.flags.includes('k')));
 assert.ok(!g.actions().some(m=>m.flags?.includes('k')));
});
test('a charged escape prevents standard-chess checkmate from ending a variant game',()=>{
 const army=createArmy();army.forEach(p=>p.square=null);const king=army.find(p=>p.id==='e1');king.square='a1';king.upgrades=['k-recall'];
 const g=new RogueGame({fen:'8/8/8/8/8/2k5/1q6/K7 w - - 0 1',army,charges:{'e1:k-recall':1}});
 assert.ok(g.chess.isCheckmate());assert.ok(g.moves({square:'a1',power:'k-recall'}).length>0);assert.equal(g.isCheckmate(),false);
});
test('every piece type can use its distinct charged movement safely',()=>{
 const symbols={p:'P',n:'N',b:'B',r:'R',q:'Q',k:'K'};
 for(const kind of Object.keys(symbols)){
  const army=createArmy();army.forEach(p=>p.square=null);const owner=army.find(p=>p.kind===kind);owner.square='d4';owner.upgrades=[`${kind}-step`];
  if(kind!=='k')army.find(p=>p.kind==='k').square='a1';
  const fen=`7k/8/8/8/3${symbols[kind]}4/8/8/${kind==='k'?'8':'K7'} w - - 0 1`;
  const g=new RogueGame({fen,army,charges:{[`${owner.id}:${kind}-step`]:1}});const move=g.moves({square:'d4',power:`${kind}-step`})[0];assert.ok(move,kind);g.move(move);assert.equal(g.isCheck('w'),false);assert.equal(g.charge(g.owner(move.to),`${kind}-step`),0);
 }
});
test('ending an extra turn after a double pawn move preserves the opponent’s en passant right',()=>{
 const army=createArmy();army.forEach(p=>p.square=null);army.find(p=>p.id==='e1').square='a1';army.find(p=>p.id==='e2').square='e2';
 const g=new RogueGame({fen:'7k/8/8/8/3p4/8/4P3/K7 w - - 0 1',army,echo:1});g.move(g.actions().find(m=>m.from==='e2'&&m.to==='e4'&&m.ability==='item:echo'));g.move({skip:true});assert.ok(g.actions().some(m=>m.from==='d4'&&m.to==='e3'&&m.flags?.includes('e')));
});
test('extra actions retain passive movement upgrades, without arming another charged power',()=>{
 const army=createArmy();army.find(p=>p.id==='b1').upgrades=['n-advanced','n-chain'];const g=RogueGame.newBattle(army,1);
 g.move(g.actions().find(m=>m.from==='b1'&&m.to==='c3'&&m.ability==='item:echo'));
 const moves=g.moves({square:'c3'});const stride=moves.find(m=>m.to==='f4'&&m.ability==='n-advanced');assert.ok(stride);assert.ok(!moves.some(m=>m.ability==='n-chain'));g.move(stride);assert.equal(g.turn(),'b');assert.equal(g.extra,null);
});
test('legacy saves preserve already-earned pack milestones when capture counters are introduced',()=>{
 const army=createArmy();for(const piece of army)delete piece.captures;army.find(p=>p.id==='b1').packsEarned=1;army.find(p=>p.id==='g1').packsEarned=2;const game=new RogueGame({army});assert.equal(game.army.find(p=>p.id==='b1').captures,3);assert.equal(game.army.find(p=>p.id==='g1').captures,6);assert.equal(game.army.find(p=>p.id==='a2').captures,0);
});
