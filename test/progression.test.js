import {test} from 'node:test';import assert from 'node:assert/strict';
import {createArmy,upgradesFor,UPGRADES} from '../src/upgrades.js';
import {emptyMastery,awardCapture,rollPack,claimPack,rollStarterPack} from '../src/progression.js';
test('packs require 3, 6 and 10 actual captures, independent of captured piece value',()=>{
 const army=createArmy(),xp=emptyMastery(),packs=[];const owner=army.find(p=>p.id==='b1');
 awardCapture(army,'b1','q',xp,packs);assert.equal(owner.xp,9);assert.equal(owner.captures,1);assert.equal(packs.length,0);
 awardCapture(army,'b1','r',xp,packs);assert.equal(owner.xp,14);assert.equal(packs.length,0);
 awardCapture(army,'b1','p',xp,packs);assert.equal(owner.captures,3);assert.equal(packs.length,1);
 for(let n=0;n<3;n++)awardCapture(army,'b1','p',xp,packs);assert.equal(owner.captures,6);assert.equal(packs.length,2);
 for(let n=0;n<4;n++)awardCapture(army,'b1','p',xp,packs);assert.equal(owner.captures,10);assert.equal(packs.length,3);
 awardCapture(army,'b1','q',xp,packs);assert.equal(packs.length,3);assert.equal(xp.n,31);
});
test('each saved roll has exactly two eligible piece upgrades and one general item',()=>{
 for(const kind of ['p','n','b','r','q','k'])for(let seed=0;seed<20;seed++){
  const army=createArmy(),owner=army.find(p=>p.kind===kind),pack={owner:owner.id,kind,choices:null};let number=seed+1;const rng=()=>((number=(number*1664525+1013904223)>>>0)/4294967296);
  const choices=rollPack(pack,army,emptyMastery(),rng);assert.equal(choices.length,3);assert.equal(new Set(choices.map(c=>c.id)).size,3);assert.equal(choices.filter(c=>c.kind==='piece').length,2);assert.equal(choices.filter(c=>c.kind==='general').length,1);
  assert.ok(choices.filter(c=>c.kind==='piece').every(c=>UPGRADES.find(u=>u.id===c.id).piece===kind));assert.deepEqual(rollPack(JSON.parse(JSON.stringify(pack)),army,emptyMastery(),()=>0),choices);
 }
});
test('claim attaches only the chosen reward, rejects forged choices, and filters owned upgrades',()=>{
 const army=createArmy(),owner=army.find(p=>p.id==='b1'),inventory={};const pack={owner:'b1',kind:'n',choices:[{kind:'piece',id:'n-chain'},{kind:'piece',id:'n-step'},{kind:'general',id:'oracle'}]};
 assert.throws(()=>claimPack(pack,'q-chain',army,inventory));claimPack(pack,'n-chain',army,inventory);assert.deepEqual(owner.upgrades,['n-chain']);assert.deepEqual(inventory,{});
 const next={owner:'b1',kind:'n',choices:null};assert.ok(!rollPack(next,army,emptyMastery()).some(c=>c.id==='n-chain'));
 assert.throws(()=>claimPack(pack,'oracle',army,inventory));claimPack({...pack,claimed:null},'oracle',army,inventory);assert.equal(inventory.oracle,1);
});
test('permanent mastery unlocks advanced branches and starter packs have three unique items',()=>{
 assert.equal(upgradesFor('n',0).length,4);assert.equal(upgradesFor('n',8).length,5);assert.equal(upgradesFor('n',20).length,6);assert.equal(new Set(rollStarterPack()).size,3);
});
test('all three packs remain eligible after prior choices, at every mastery tier',()=>{
 for(const kind of ['p','n','b','r','q','k'])for(const lifetime of [0,8,20])for(let seed=0;seed<10;seed++){
  const army=createArmy(),owner=army.find(p=>p.kind===kind),mastery={...emptyMastery(),[kind]:lifetime};let n=seed+1;const rng=()=>((n=(n*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<3;i++){const pack={owner:owner.id,kind,choices:null};const options=rollPack(pack,army,mastery,rng);assert.equal(options.filter(c=>c.kind==='piece').length,2);claimPack(pack,options.find(c=>c.kind==='piece').id,army,{});}
 }
});
test('passive movement replaces its charged version rather than stacking redundant abilities',()=>{
 const army=createArmy(),owner=army.find(p=>p.kind==='b');owner.upgrades=['b-step'];const pack={owner:owner.id,kind:'b',choices:[{id:'b-advanced',kind:'piece'}]};claimPack(pack,'b-advanced',army,{});assert.deepEqual(owner.upgrades,['b-advanced']);
});
test('Scholar boosts mastery XP without accelerating capture-count milestones',()=>{
 const army=createArmy(),owner=army.find(p=>p.id==='a2'),xp=emptyMastery(),packs=[];owner.upgrades=['p-scholar'];awardCapture(army,'a2','q',xp,packs);assert.equal(owner.xp,10);assert.equal(owner.captures,1);assert.equal(xp.p,10);assert.equal(packs.length,0);
});
