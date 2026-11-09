import { Chess } from 'chess.js';
import { engineSettings } from './engine-settings.js';

const NAME = 'stockfish-17.1-lite-single-03e3232.js';
// UCI owns a single search at a time. Queue requests so late results can never
// be mistaken for a newer position; the game's request IDs reject stale replies.
export class BrowserEngine {
  constructor() {
    this.onmessage = null;
    this.onstatus = null;
    this.queue = [];
    this.processing = false;
    this.fallbackOnly = false;
    this.name = 'Stockfish 17.1';
  }
  postMessage(request) {
    this.queue.push(request);
    if (!this.processing) void this.process();
  }
  async process() {
    this.processing = true;
    while (this.queue.length) {
      const request = this.queue.shift();
      try {
        let move;
        if(request.requiresVariant){
          this.name='Rogue-aware engine';
          move=await this.variantSearch(request);
        }else{
        this.name=this.fallbackOnly?'Classic engine':'Stockfish 17.1';
        if (!this.fallbackOnly) {
          try { await this.initialize(); move = await this.search(request); }
          catch { this.useFallback(); }
        }
        if (this.fallbackOnly) move = await this.fallbackSearch(request);
        }
        this.onmessage?.({ data: { id: request.id, kind: request.kind, move, backend: this.name } });
      } catch {
        this.onmessage?.({ data: { id: request.id, kind: request.kind, error: true, backend: this.name } });
      }
    }
    this.processing = false;
  }
  variantSearch(request) {
    this.onstatus?.(request.kind==='hint'?'The Oracle is reading your powers…':'The Warden is planning around your powers…');
    return new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./variant-worker.js',import.meta.url),{type:'module'});
      const profile=engineSettings(request.level,request.kind);
      const settings={timeMs:profile.timeMs,depth:request.kind==='hint'?5:Math.min(4,2+Math.floor((request.level-1)/4))};
      const timer=setTimeout(()=>{worker.terminate();reject(new Error('Variant search timed out'));},settings.timeMs+10000);
      const finish=(error,move)=>{clearTimeout(timer);worker.terminate();if(error)reject(error);else resolve(move);};
      worker.onmessage=({data})=>finish(data.error?new Error('Variant search failed'):null,data.move);
      worker.onerror=event=>{event.preventDefault();finish(new Error('Variant search failed'));};
      worker.postMessage({id:request.id,state:request.state,settings});
    });
  }
  initialize() {
    if (this.initialized) return this.initialized;
    this.onstatus?.('Loading Stockfish…');
    this.initialized = new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(this.loadTimer);
        this.loadReject = null;
        if (error) reject(error); else resolve();
      };
      this.loadReject = error => finish(error);
      this.loadTimer = setTimeout(() => finish(new Error('Engine startup timed out')), 20000);
      try {
        const url = new URL(`${import.meta.env.BASE_URL}engine/${NAME}`, window.location.origin);
        this.stockfish = new Worker(url);
        this.stockfish.onerror = event => {
          event.preventDefault();
          const error = new Error('Stockfish could not start');
          this.loadReject?.(error);
          this.searchReject?.(error);
        };
        this.stockfish.onmessage = ({ data }) => {
          for (const line of String(data).split('\n')) {
            if (line === 'uciok') {
              this.send('setoption name Threads value 1');
              this.send('setoption name Hash value 16');
              this.send('setoption name UCI_LimitStrength value false');
              this.send('isready');
            } else if (line === 'readyok') finish();
            else if (line.startsWith('bestmove ')) this.searchResolve?.(line.split(/\s+/)[1]);
          }
        };
        this.send('uci');
      } catch (error) { finish(error); }
    });
    return this.initialized;
  }
  send(command) { this.stockfish.postMessage(command); }
  search(request) {
    const settings = engineSettings(request.level, request.kind);
    this.onstatus?.(request.kind === 'hint' ? 'The Oracle is searching…' : 'The Warden is thinking…');
    return new Promise((resolve, reject) => {
      const finish = (error, uci) => {
        clearTimeout(this.searchTimer);
        this.searchResolve = null;
        this.searchReject = null;
        if (error) { reject(error); return; }
        try {
          const game = new Chess(request.fen);
          if (uci === '(none)' || uci === '0000') {
            if (game.moves().length) throw new Error('Engine returned no legal move');
            resolve(null); return;
          }
          const move = game.move({ from: uci.slice(0,2), to: uci.slice(2,4), ...(uci[4] ? { promotion: uci[4] } : {}) });
          resolve({ from: move.from, to: move.to, promotion: move.promotion, san: move.san });
        } catch (error) { reject(error); }
      };
      this.searchResolve = uci => finish(null, uci);
      this.searchReject = error => finish(error);
      this.searchTimer = setTimeout(() => finish(new Error('Search timed out')), settings.timeMs + 5000);
      try {
        // Clear hash between positions: strength settings and relic-altered
        // positions must not inherit analysis from an Oracle or another floor.
        this.send('ucinewgame');
        this.send(`setoption name Skill Level value ${settings.skill}`);
        this.send(`position fen ${request.fen}`);
        this.send(`go depth ${settings.depth} movetime ${settings.timeMs}`);
      } catch (error) { finish(error); }
    });
  }
  useFallback() {
    this.stockfish?.terminate();
    this.stockfish = null;
    clearTimeout(this.loadTimer);
    clearTimeout(this.searchTimer);
    this.searchResolve = null;
    this.searchReject = null;
    this.fallbackOnly = true;
    this.name = 'Classic engine';
    this.onstatus?.('Stockfish unavailable. Using the classic engine.');
  }
  fallbackSearch(request) {
    return new Promise((resolve, reject) => {
      // Keep the lightweight engine available if WebAssembly is unsupported or
      // its first download fails. A fresh worker also bounds a stalled search.
      const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Fallback timed out')); }, 10000);
      const finish = (error, move) => {
        clearTimeout(timer); worker.terminate();
        if (error) reject(error); else resolve(move);
      };
      worker.onmessage = ({ data }) => finish(data.error ? new Error('Fallback failed') : null, data.move);
      worker.onerror = event => { event.preventDefault(); finish(new Error('Fallback failed')); };
      worker.postMessage({ ...request, depth: request.kind === 'hint' ? 3 : 2 });
    });
  }
}
