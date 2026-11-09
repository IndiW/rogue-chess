// A timestamp-based bank of player thinking time. Background-tab throttling
// cannot grant extra time, and pausing never refunds already-spent time.
export class PlayerClock {
  constructor({ durationMs = 180000, now = () => Date.now() } = {}) {
    this.durationMs = durationMs;
    this.now = now;
    this.reset();
  }
  reset() { this.bank = this.durationMs; this.startedAt = null; }
  get running() { return this.startedAt !== null; }
  get remainingMs() {
    return Math.max(0, this.bank - (this.running ? Math.max(0, this.now() - this.startedAt) : 0));
  }
  get expired() { return this.remainingMs <= 0; }
  setRunning(running) {
    if (running === this.running) return;
    if (running && !this.expired) this.startedAt = this.now();
    else if (!running) { this.bank = this.remainingMs; this.startedAt = null; }
  }
}
export function formatClock(milliseconds) {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
