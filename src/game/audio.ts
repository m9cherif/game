// Synthesized SFX engine — zero assets, pure WebAudio. Punchy + juicy.
export class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  musicNodes: OscillatorNode[] = [];
  musicGain: GainNode | null = null;

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch { return; }
    }
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) { this.muted = m; if (this.master && this.ctx) this.master.gain.value = m ? 0 : 0.5; }

  private env(gain: GainNode, t: number, peak: number, decay: number) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }

  private osc(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    this.env(g, t, vol, dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterFreq: number, type: BiquadFilterType = "lowpass", delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    this.env(g, t, vol, dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shoot(kind: string) {
    this.ensure();
    switch (kind) {
      case "rifle": this.noise(0.09, 0.35, 3200); this.osc("square", 880, 180, 0.09, 0.18); break;
      case "smg": this.noise(0.06, 0.28, 4200); this.osc("sawtooth", 1100, 300, 0.06, 0.14); break;
      case "scatter": this.noise(0.22, 0.55, 1400); this.osc("square", 300, 60, 0.2, 0.3); break;
      case "rail": this.osc("sawtooth", 200, 2400, 0.28, 0.25); this.noise(0.3, 0.4, 6000, "highpass", 0.18); break;
      case "thumper": this.osc("sine", 220, 60, 0.25, 0.5); this.noise(0.12, 0.3, 900); break;
      case "blade": this.noise(0.12, 0.25, 5000, "bandpass"); this.osc("sawtooth", 300, 1200, 0.1, 0.12); break;
      default: this.noise(0.08, 0.3, 3000);
    }
  }
  enemyShoot() { this.osc("square", 500, 120, 0.08, 0.08); }
  hit() { this.osc("square", 1400, 900, 0.05, 0.16); }
  headshot() { this.osc("square", 1800, 600, 0.08, 0.22); this.noise(0.05, 0.2, 6000, "highpass"); }
  kill() { this.osc("sawtooth", 600, 1200, 0.12, 0.2); this.osc("square", 900, 1800, 0.14, 0.14, 0.06); }
  explosion() { this.noise(0.6, 0.6, 500); this.osc("sine", 120, 30, 0.55, 0.5); }
  hurt() { this.osc("sawtooth", 200, 80, 0.18, 0.3); this.noise(0.1, 0.25, 700); }
  reload() { this.osc("square", 400, 800, 0.06, 0.12); this.osc("square", 600, 400, 0.06, 0.12, 0.12); }
  empty() { this.osc("square", 1200, 800, 0.04, 0.1); }
  pickup() { this.osc("sine", 700, 1400, 0.12, 0.2); this.osc("sine", 1050, 2100, 0.14, 0.15, 0.08); }
  wave() { this.osc("sawtooth", 150, 600, 0.4, 0.25); this.osc("sawtooth", 300, 900, 0.4, 0.15, 0.1); }
  ui() { this.osc("sine", 800, 1200, 0.06, 0.12); }
  jump() { this.noise(0.08, 0.12, 800); }
  step() { this.noise(0.04, 0.07, 500); }
  scope() { this.osc("sine", 400, 900, 0.08, 0.1); }

  startMusic() {
    this.ensure();
    if (!this.ctx || !this.master || this.musicNodes.length) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.06;
    g.connect(this.master);
    this.musicGain = g;
    const notes = [55, 55, 65.4, 49, 58.3, 55, 73.4, 65.4];
    notes.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = i % 2 ? "sawtooth" : "square";
      o.frequency.value = f;
      const og = this.ctx!.createGain();
      og.gain.value = 0.5;
      const lfo = this.ctx!.createOscillator();
      lfo.frequency.value = 0.5 + i * 0.13;
      const lg = this.ctx!.createGain();
      lg.gain.value = 0.35;
      lfo.connect(lg); lg.connect(og.gain);
      o.connect(og); og.connect(g);
      o.start(); lfo.start();
      this.musicNodes.push(o, lfo);
    });
  }
  stopMusic() {
    for (const n of this.musicNodes) { try { n.stop(); } catch { /* noop */ } }
    this.musicNodes = [];
    if (this.musicGain) { try { this.musicGain.disconnect(); } catch { /* noop */ } this.musicGain = null; }
  }
}

export const sfx = new Sfx();
