import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerClock, formatClock } from '../src/clock.js';

test('only player thinking time is deducted, across arbitrary pauses', () => {
  let now = 1000; const clock = new PlayerClock({ now:()=>now });
  assert.equal(clock.remainingMs,180000);
  clock.setRunning(true);now+=12500;
  assert.equal(clock.remainingMs,167500);
  clock.setRunning(false);now+=60000;
  assert.equal(clock.remainingMs,167500);
  clock.setRunning(true);now+=2500;
  clock.setRunning(true); // Echo and Oracle remain the same running turn.
  now+=5000;assert.equal(clock.remainingMs,160000);
});
test('background throttling cannot grant extra time and expired clocks cannot restart', () => {
  let now=0;const clock=new PlayerClock({now:()=>now});clock.setRunning(true);
  now+=240000;assert.equal(clock.remainingMs,0);assert.ok(clock.expired);
  clock.setRunning(false);clock.setRunning(true);assert.equal(clock.running,false);
  clock.reset();assert.equal(clock.remainingMs,180000);clock.setRunning(true);assert.ok(clock.running);
});
test('pausing does not refund time, and display rounds upward without negative values', () => {
  let now=0;const clock=new PlayerClock({now:()=>now});clock.setRunning(true);now+=30001;clock.setRunning(false);
  assert.equal(clock.remainingMs,149999);assert.equal(formatClock(clock.remainingMs),'2:30');
  assert.equal(formatClock(180000),'3:00');assert.equal(formatClock(1),'0:01');assert.equal(formatClock(-5),'0:00');
});
test('saved clocks count offline player time but preserve paused time',()=>{
 let now=1000;const a=new PlayerClock({now:()=>now});a.setRunning(true);now+=10000;const saved=a.snapshot();now+=20000;
 const b=new PlayerClock({now:()=>now});b.restore(saved);assert.equal(b.remainingMs,150000);assert.equal(b.running,true);
 b.setRunning(false);const paused=b.snapshot();now+=60000;const c=new PlayerClock({now:()=>now});c.restore(paused);assert.equal(c.remainingMs,150000);assert.equal(c.running,false);
});
