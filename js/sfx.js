// Synthesized sounds: tones and bursts of noise, nothing to load.
let ac = null, noiseBuf = null, mute = (() => { try { return localStorage.getItem('ironfront.mute') === '1'; } catch (e) { return false; } })();
export const muted = () => mute;
export function setMute(m) { mute = m; try { localStorage.setItem('ironfront.mute', m ? '1' : '0'); } catch (e) { /* ignore */ } }
function ctx() {
  if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); const n = ac.sampleRate; noiseBuf = ac.createBuffer(1, n, n); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(f, t0, d, type = 'sine', v = 0.2, f2) {
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.05);
}
function noise(t0, d, v = 0.3, freq = 1200, q = 0.8, type = 'lowpass') {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime + t0;
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f).connect(g).connect(ac.destination); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
}
const S = {
  click: () => tone(900, 0, 0.04, 'square', 0.04),
  step: () => { tone(90, 0, 0.08, 'sine', 0.12, 50); noise(0, 0.05, 0.06, 400); },
  start: () => { [440, 660, 880].forEach((f, i) => tone(f, i * 0.08, 0.14, 'square', 0.05)); },
  shot: () => { noise(0, 0.07, 0.3, 2500, 0.7, 'highpass'); tone(160, 0, 0.05, 'square', 0.06, 80); },
  hit: () => { noise(0, 0.1, 0.35, 1200); tone(220, 0, 0.08, 'square', 0.08, 120); },
  miss: () => { noise(0, 0.12, 0.08, 3000, 2, 'bandpass'); },
  clang: () => { tone(700, 0, 0.25, 'triangle', 0.15, 500); tone(1150, 0, 0.18, 'square', 0.05, 900); noise(0, 0.08, 0.3, 3000); },
  launch: () => { noise(0, 0.5, 0.18, 900, 1.5, 'bandpass'); },
  win: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'square', 0.06)); },
  lose: () => { [440, 370, 311, 262].forEach((f, i) => tone(f, i * 0.2, 0.4, 'triangle', 0.1)); },
  thump: (k) => { tone(140, 0, 0.12, 'sine', 0.25 * k, 60); noise(0, 0.08, 0.15 * k, 600); },
  pow: (k) => { tone(220, 0, 0.1, 'square', 0.12 * k, 90); noise(0, 0.12, 0.3 * k, 1800); },
  slap: (k) => { noise(0, 0.09, 0.45 * k, 3500, 0.7, 'highpass'); },
  bonk: (k) => { tone(700, 0, 0.08, 'triangle', 0.25 * k, 300); tone(180, 0, 0.18, 'sine', 0.2 * k, 80); },
  splat: (k) => { noise(0, 0.18, 0.35 * k, 900); tone(300, 0, 0.1, 'sine', 0.1 * k, 80); },
  squeak: () => { tone(900, 0, 0.12, 'square', 0.08, 1500); tone(1400, 0.06, 0.1, 'square', 0.06, 900); },
  boom: (k) => { noise(0, 0.9 * k, 0.6, 500); tone(90, 0, 0.6, 'sine', 0.4 * k, 30); },
  pop: () => { noise(0, 0.15, 0.4, 2500); tone(500, 0, 0.08, 'square', 0.1, 150); },
  zap: () => { for (let i = 0; i < 6; i++) tone(200 + Math.random() * 900, i * 0.05, 0.06, 'sawtooth', 0.1); noise(0, 0.4, 0.2, 4000, 1, 'highpass'); },
  freeze: () => { [1800, 2200, 2600, 3100].forEach((f, i) => tone(f, i * 0.05, 0.25, 'sine', 0.07)); },
  shatter: () => { noise(0, 0.35, 0.4, 5000, 1, 'highpass'); [2500, 3200, 2800].forEach((f, i) => tone(f, i * 0.03, 0.12, 'triangle', 0.06)); },
  whoosh: () => { noise(0, 0.3, 0.2, 800, 2, 'bandpass'); },
  rocket: () => { noise(0, 1.6, 0.18, 700, 1, 'bandpass'); },
  hiss: () => { noise(0, 1.2, 0.08, 6000, 1, 'highpass'); },
  laugh: () => { [520, 470, 520, 470, 560].forEach((f, i) => tone(f, i * 0.09, 0.08, 'triangle', 0.12)); },
  ouch: (k) => { tone(600, 0, 0.2, 'triangle', 0.1 * k, 350); },
  coin: () => { tone(1300, 0, 0.06, 'square', 0.04); tone(1750, 0.05, 0.1, 'square', 0.04); },
  buy: () => { [660, 880, 1100].forEach((f, i) => tone(f, i * 0.07, 0.15, 'triangle', 0.12)); },
  hole: () => { tone(300, 0, 1.5, 'sine', 0.15, 40); noise(0, 1.5, 0.1, 300); },
  tick: () => tone(1500, 0, 0.03, 'square', 0.03),
};
let last = {};
export function sfx(name, k = 1) {
  if (mute) return;
  const now = performance.now(); if (now - (last[name] || 0) < 45) return; last[name] = now; // no machine-gun repeats
  try { ctx(); S[name]?.(Math.max(0.2, Math.min(1.4, k))); } catch (e) { /* no sound */ }
}
