// Tiny, dependency-free sound effects built with the Web Audio API.
// Nothing is fetched from disk or network - every sound is synthesized on
// the spot, so it works offline and plays back instantly. Browsers only
// allow audio to start from a real user gesture (a click, tap or drag), so
// these are only ever called from click/drag handlers, never on page load.

let ctx;

function getCtx() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { duration = 0.12, type = 'sine', gain = 0.16, delay = 0 } = {}) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Soft, short tick - for icon toggles and small UI clicks. */
export function playClick() {
  tone(760, { duration: 0.06, type: 'triangle', gain: 0.1 });
}

/** Electric "plug seats home" spark/zap - a quick rising burst. */
export function playConnect() {
  tone(160, { duration: 0.2, type: 'sawtooth', gain: 0.14 });
  tone(820, { duration: 0.09, type: 'square', gain: 0.09, delay: 0.03 });
  tone(1500, { duration: 0.15, type: 'sine', gain: 0.1, delay: 0.05 });
}

/** Gentle rising whoosh - for the doors sliding open. */
export function playOpen() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, t0);
  osc.frequency.exponentialRampToValueAtTime(480, t0 + 0.5);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(0.07, t0 + 0.08);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.6);
}
