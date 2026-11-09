import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Chess } from 'chess.js';
import { engineSettings } from '../src/engine-settings.js';

test('floor difficulty rises within fixed resource limits; Oracle uses full strength', () => {
  let previous = { skill: -1, depth: 0, timeMs: 0 };
  for (let level = 1; level <= 20; level++) {
    const current = engineSettings(level);
    assert.ok(current.skill >= previous.skill && current.skill <= 20);
    assert.ok(current.depth >= previous.depth && current.depth <= 24);
    assert.ok(current.timeMs >= previous.timeMs && current.timeMs <= 2000);
    previous = current;
  }
  const oracle = engineSettings(1, 'hint');
  assert.equal(oracle.skill, 20);
  assert.ok(oracle.depth > previous.depth && oracle.timeMs > previous.timeMs);
  assert.deepEqual(engineSettings(Infinity), engineSettings(1));
});

test('bundled Stockfish solves tactics for both sides and handles special moves', { timeout: 15000 }, async () => {
  const engine = spawn(process.execPath, ['node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: engine.stdout });
  // Read stderr too so an engine error can never block the child on a full pipe.
  engine.stderr.resume();
  const send = command => engine.stdin.write(command + '\n');
  const until = (command, prefix) => new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); lines.off('line', onLine); engine.off('error', onError); engine.off('exit', onExit); };
    const onError = error => { cleanup(); reject(error); };
    const onExit = () => onError(new Error('Stockfish exited before replying'));
    const onLine = line => { if (line.startsWith(prefix)) { cleanup(); resolve(line); } };
    const timer = setTimeout(() => onError(new Error('Stockfish test timed out')), 5000);
    lines.on('line', onLine); engine.once('error', onError); engine.once('exit', onExit);
    send(command);
  });
  try {
    await until('uci', 'uciok');
    send('setoption name Hash value 16');
    send('setoption name Skill Level value 20');
    await until('isready', 'readyok');
    const positions = [
      { fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1', check: (g) => assert.ok(g.isCheckmate()) },
      { fen: '8/8/8/8/8/6k1/5q2/7K b - - 0 1', check: (g) => assert.ok(g.isCheckmate()) },
      { fen: '4k3/8/4p3/3r4/8/8/8/3QK3 w - - 0 1', check: (_,m) => assert.notEqual(m.san, 'Qxd5') },
      { fen: '5B2/4N3/8/R4Ppk/8/6K1/8/8 w - g6 0 1', check: (g,m) => { assert.equal(m.flags.includes('e'),true); assert.ok(g.isCheckmate()); } },
      { fen: '8/P7/8/8/8/6K1/8/7k w - - 0 1', check: (_,m) => assert.equal(m.promotion, 'q') },
      { fen: '7k/6Q1/6K1/8/8/8/8/8 b - - 0 1', terminal: true },
    ];
    for (const position of positions) {
      send('ucinewgame');
      send(`position fen ${position.fen}`);
      const response = await until('go depth 12 movetime 300', 'bestmove ');
      const uci = response.split(' ')[1];
      if (position.terminal) { assert.ok(['(none)', '0000'].includes(uci)); continue; }
      const game = new Chess(position.fen);
      const move = game.move({ from: uci.slice(0,2), to: uci.slice(2,4), ...(uci[4] ? { promotion: uci[4] } : {}) });
      assert.ok(move);
      position.check(game,move);
    }
  } finally { engine.kill(); lines.close(); }
});
