// Yumshoq pianino kuyi va qadam tovushi. Hammasi kodda hosil qilinadi.
// `SITE.music` fayli berilsa, bu kuy o‘chadi va o‘sha qo‘shiq chalinadi.
const CHORDS = [
  [48, 55, 60, 64, 67, 71],
  [45, 52, 57, 60, 64, 69],
  [41, 48, 53, 57, 60, 65],
  [43, 50, 55, 59, 62, 67],
];
const ARP = [0, 2, 3, 4, 5, 4, 3, 2];
const EIGHTH = 0.47;

const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);

export class Sound {
  ctx = null;
  muted = false;

  start(withMusic) {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    ctx.resume?.();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    if (withMusic) this.startMusic();
  }

  startMusic() {
    const { ctx } = this;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.gain.linearRampToValueAtTime(0.75, ctx.currentTime + 4);
    this.bus.connect(this.master);

    // Katta zalning aks-sadosi
    const seconds = 3;
    const impulse = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = impulse.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    reverb.connect(wet).connect(this.bus);
    this.reverb = reverb;

    this.next = ctx.currentTime + 0.3;
    this.index = 0;
    this.timer = setInterval(() => this.schedule(), 200);
  }

  schedule() {
    const { ctx } = this;
    while (this.next < ctx.currentTime + 1) {
      const beat = this.index % 8;
      const chord = CHORDS[Math.floor(this.index / 8) % CHORDS.length];
      if (beat === 0) {
        this.note(chord[0] - 12, this.next, 3.6, 0.16);
        this.note(chord[0], this.next, 3.2, 0.1);
      }
      this.note(chord[ARP[beat]] + 12, this.next, 2.4, 0.075 + (beat % 4 === 0 ? 0.03 : 0));
      if (beat % 4 === 2 && Math.random() < 0.55) {
        const top = chord[3 + Math.floor(Math.random() * 3)] + 24;
        this.note(top, this.next, 2.8, 0.085);
      }
      this.next += EIGHTH;
      this.index++;
    }
  }

  /** Pianinoga o‘xshash yumshoq nota. */
  note(midi, t, length, volume) {
    const { ctx } = this;
    const freq = midiToHz(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1500;
    for (const [type, ratio, level] of [['triangle', 1, 0.8], ['sine', 2, 0.28], ['sine', 3, 0.08]]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(tone);
      osc.start(t);
      osc.stop(t + length + 0.05);
    }
    tone.connect(env);
    env.connect(this.bus);
    env.connect(this.reverb);
  }

  /** Ovozli xabar paytida kuy pasayadi. */
  duck(on) {
    if (!this.bus) return;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(on ? 0.14 : 0.75, t, 0.4);
  }

  /** Uzoqdan eshitiladigan mushak ovozi. */
  boom() {
    if (!this.ctx || this.muted) return;
    const { ctx } = this;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 170;
    const env = ctx.createGain();
    const t = ctx.currentTime;
    env.gain.setValueAtTime(0.22, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    source.connect(filter).connect(env).connect(this.master);
    source.start(t, 0, 0.75);
  }

  step(volume = 1) {
    if (!this.ctx || this.muted) return;
    const { ctx } = this;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420 + Math.random() * 120;
    const env = ctx.createGain();
    const t = ctx.currentTime;
    env.gain.setValueAtTime(0.14 * volume, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    source.connect(filter).connect(env).connect(this.master);
    source.start(t, Math.random() * 0.8, 0.12);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }
}
