import {test} from 'node:test';import assert from 'node:assert/strict';import {Chess} from 'chess.js';import {bestMove} from '../src/engine.js';
test('engine returns a legal opening at every supported depth',()=>{for(const d of [1,2,3]){const g=new Chess();assert.ok(g.move(bestMove(g.fen(),d)));}});
test('engine finds mate in one',()=>{const g=new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');g.move(bestMove(g.fen(),2));assert.ok(g.isCheckmate());});
test('engine has no move in a terminal position',()=>{assert.equal(bestMove('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1'),null);});
