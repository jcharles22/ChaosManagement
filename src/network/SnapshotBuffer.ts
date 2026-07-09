import type { WorldSnapshot } from './types';

const MAX_BUFFER_MS = 400;
const INTERP_DELAY_MS = 80;

interface PlayerFrame {
  time: number;
  x: number;
  y: number;
}

export class SnapshotBuffer {
  private frames = new Map<string, PlayerFrame[]>();

  push(snapshot: WorldSnapshot): void {
    const time = snapshot.serverTime || Date.now();
    for (const p of snapshot.players) {
      if (!this.frames.has(p.id)) this.frames.set(p.id, []);
      const list = this.frames.get(p.id)!;
      list.push({ time, x: p.x, y: p.y });
      while (list.length > 0 && time - list[0].time > MAX_BUFFER_MS) {
        list.shift();
      }
    }
  }

  getPosition(playerId: string, now: number): { x: number; y: number } | null {
    const list = this.frames.get(playerId);
    if (!list || list.length === 0) return null;

    const renderTime = now - INTERP_DELAY_MS;
    const latest = list[list.length - 1];
    if (renderTime >= latest.time || list.length === 1) {
      return { x: latest.x, y: latest.y };
    }

    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (a.time <= renderTime && renderTime <= b.time) {
        const t = (renderTime - a.time) / (b.time - a.time);
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        };
      }
    }

    return { x: latest.x, y: latest.y };
  }

  getLatest(playerId: string): { x: number; y: number } | null {
    const list = this.frames.get(playerId);
    if (!list?.length) return null;
    const f = list[list.length - 1];
    return { x: f.x, y: f.y };
  }

  clear(): void {
    this.frames.clear();
  }
}
