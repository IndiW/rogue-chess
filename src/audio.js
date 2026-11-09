// Original, procedural chiptune score. All audio is synthesized locally.
const STORAGE_KEY = 'rogue-chess-audio-v1';
let preferences;
try { preferences = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch {}
let musicEnabled = preferences?.music === true;
let effectsEnabled = preferences?.effects !== false;
let context, musicBus, effectsBus, timer, nextNote = 0, step = 0;
let unavailable = false;
const musicVoices = new Set();
const bpm = 108;
const tick = 60 / bpm / 2;
// Four eight-beat phrases in A minor; a quiet pulse beneath the board.
const melody = [
  76, 0, 72, 74, 76, 0, 79, 76, 74, 0, 72, 0, 71, 72, 74, 0,
  72, 0, 69, 71, 72, 0, 76, 72, 71, 0, 67, 0, 69, 71, 72, 0,
  74, 0, 71, 72, 74, 0, 77, 74, 76, 0, 74, 72, 71, 0, 67, 0,
  69, 0, 72, 0, 76, 74, 72, 71, 69, 0, 64, 0, 69, 0, 0, 0,
];
const chords = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [45, 52, 57, 60]];
const frequency = note => 440 * 2 ** ((note - 69) / 12);
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ music: musicEnabled, effects: effectsEnabled })); } catch {}
}
function tone(note, at, duration, volume, type, bus, track = false) {
  if (!context || !note) return;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency(note), at);
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(volume, at + 0.008);
  envelope.gain.setValueAtTime(volume * 0.65, at + duration * 0.35);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(envelope).connect(bus);
  if (track) musicVoices.add(oscillator);
  oscillator.onended = () => { musicVoices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
  oscillator.start(at);
  oscillator.stop(at + duration + 0.015);
}
function schedule() {
  if (!context || context.state !== 'running') return;
  // Reset after a throttled/background tab so missed notes never pile up.
  if (nextNote < context.currentTime) nextNote = context.currentTime + 0.025;
  while (nextNote < context.currentTime + 0.18) {
    const index = step % melody.length;
    const chord = chords[Math.floor(index / 16)];
    tone(melody[index], nextNote, tick * 0.72, 0.075, 'square', musicBus, true);
    if (index % 2 === 0) tone(chord[0], nextNote, tick * 1.65, 0.18, 'triangle', musicBus, true);
    tone(chord[1 + index % 3] + 12, nextNote, tick * 0.4, 0.025, 'square', musicBus, true);
    step++;
    nextNote += tick;
  }
}
function stopMusic() {
  clearInterval(timer);
  timer = undefined;
  for (const voice of musicVoices) { try { voice.stop(); } catch {} }
  musicVoices.clear();
}
function syncMusic() {
  if (!musicEnabled || !context || context.state !== 'running' || document.hidden) { stopMusic(); return; }
  if (timer) return;
  nextNote = context.currentTime + 0.035;
  schedule();
  timer = setInterval(schedule, 80);
}
async function unlock() {
  if (unavailable) return false;
  try {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { unavailable = true; return false; }
      context = new AudioContext();
      musicBus = context.createGain();
      effectsBus = context.createGain();
      musicBus.gain.value = 0.38;
      effectsBus.gain.value = 0.32;
      musicBus.connect(context.destination);
      effectsBus.connect(context.destination);
    }
    if (context.state === 'suspended') await context.resume();
    syncMusic();
    return context.state === 'running';
  } catch { unavailable = true; stopMusic(); return false; }
}
async function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (musicEnabled && !await unlock()) musicEnabled = false;
  syncMusic(); save();
}
async function toggleEffects() {
  effectsEnabled = !effectsEnabled;
  if (effectsEnabled && !await unlock()) effectsEnabled = false;
  save();
}
function playMove(move, check = false) {
  if (!effectsEnabled || !context || context.state !== 'running' || document.hidden) return;
  const at = context.currentTime;
  if (move.promotion) {
    [72, 76, 79, 84].forEach((n, i) => tone(n, at + i * 0.055, 0.13, 0.2, 'square', effectsBus));
  } else if (move.captured) {
    [64, 55, 43].forEach((n, i) => tone(n, at + i * 0.035, 0.09, 0.22, 'triangle', effectsBus));
    tone(79, at, 0.035, 0.1, 'square', effectsBus);
  } else if (move.flags?.includes('k') || move.flags?.includes('q')) {
    [60, 67, 72].forEach((n, i) => tone(n, at + i * 0.04, 0.08, 0.17, 'square', effectsBus));
  } else {
    tone(move.color === 'w' ? 76 : 69, at, 0.035, 0.13, 'square', effectsBus);
    tone(move.color === 'w' ? 60 : 53, at + 0.026, 0.09, 0.3, 'triangle', effectsBus);
  }
  if (check) [81, 77].forEach((n, i) => tone(n, at + 0.16 + i * 0.09, 0.13, 0.12, 'square', effectsBus));
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopMusic(); else syncMusic();
});
export const audio = {
  unlock, toggleMusic, toggleEffects, playMove,
  get music() { return musicEnabled; },
  get effects() { return effectsEnabled; },
  get unavailable() { return unavailable; },
};
