/** Tiny WebAudio beeps — no asset files required */
export class Sfx {
  private ctx: AudioContext | null = null;

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  tone(freq: number, dur = 0.08, type: OscillatorType = 'square', gain = 0.04): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  pickup(): void {
    this.tone(660, 0.06, 'square', 0.03);
  }
  deposit(): void {
    this.tone(440, 0.07, 'triangle', 0.035);
  }
  hit(): void {
    this.tone(120, 0.15, 'sawtooth', 0.05);
  }
  intercom(): void {
    this.tone(880, 0.05, 'square', 0.04);
    setTimeout(() => this.tone(660, 0.08, 'square', 0.035), 70);
  }
  repair(): void {
    this.tone(520, 0.1, 'triangle', 0.04);
  }
  craft(): void {
    this.tone(300, 0.05, 'sine', 0.03);
  }
}

export const sfx = new Sfx();
