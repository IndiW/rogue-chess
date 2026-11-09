import {test} from 'node:test';import assert from 'node:assert/strict';
import {RogueGame} from '../src/rules.js';import {createArmy} from '../src/upgrades.js';import {variantBestMove} from '../src/variant-engine.js';
test('variant search uses Long Stride to win material and leaves the input untouched',()=>{
 const army=createArmy();army.forEach(p=>p.square=null);const n=army.find(p=>p.id==='b1');n.square='c3';n.upgrades=['n-advanced'];army.find(p=>p.id==='e1').square='a1';
 const g=new RogueGame({fen:'7k/8/8/8/5q2/2N5/8/K7 w - - 0 1',army}),state=g.serialize(),before=JSON.stringify(state);
 const move=variantBestMove(state,{timeMs:400,depth:2});assert.equal(move.to,'f4');assert.equal(move.ability,'n-advanced');assert.equal(move.captured,'q');assert.equal(JSON.stringify(state),before);assert.ok(g.move(move));
});
test('variant search escapes an extended knight check with a genuinely safe legal move',()=>{
 const army=createArmy();army.forEach(p=>p.square=null);army.find(p=>p.id==='e1').square='a1';const n=army.find(p=>p.id==='b1');n.square='c3';n.upgrades=['n-advanced'];
 const g=new RogueGame({fen:'8/8/3k4/8/8/2N5/8/K7 b - - 0 1',army});assert.ok(g.isCheck());const m=variantBestMove(g.serialize(),{timeMs:250,depth:2});g.move(m);assert.equal(g.isCheck('b'),false);
});
test('variant search finds mate for either side while powers are enabled',()=>{
 for(const [fen,square,kind] of [['7k/5Q2/6K1/8/8/8/8/8 w - - 0 1','f7','q'],['8/8/8/8/8/6k1/5q2/7K b - - 0 1','h1','k']]){
  const army=createArmy();army.forEach(p=>p.square=null);if(kind==='q'){army.find(p=>p.id==='d1').square=square;army.find(p=>p.id==='e1').square='g6';}else army.find(p=>p.id==='e1').square=square;
  const g=new RogueGame({fen,army,echo:1});const m=variantBestMove(g.serialize(),{timeMs:350,depth:2});assert.ok(m);g.move(m);assert.ok(g.isCheckmate());
 }
});
