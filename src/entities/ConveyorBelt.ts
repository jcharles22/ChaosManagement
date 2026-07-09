import Phaser from 'phaser';
import type { ItemEntity } from './Item';
import type { ItemType } from '../core/types';

export interface BeltPoint {
  x: number;
  y: number;
}

export class ConveyorBelt {
  points: BeltPoint[];
  items: ItemEntity[] = [];
  baseSpeed: number;
  label: string;
  graphics: Phaser.GameObjects.Graphics;
  acceptTypes: ItemType[] | null;
  blocked = false;
  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    points: BeltPoint[],
    opts: { speed?: number; label?: string; acceptTypes?: ItemType[] | null } = {},
  ) {
    this.scene = scene;
    this.points = points;
    this.baseSpeed = opts.speed ?? 80;
    this.label = opts.label ?? 'belt';
    this.acceptTypes = opts.acceptTypes ?? null;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(5);
    this.draw();
  }

  draw(): void {
    const g = this.graphics;
    g.clear();
    if (this.points.length < 2) return;

    g.lineStyle(22, this.blocked ? 0x663333 : 0x2a3344, 1);
    g.beginPath();
    g.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      g.lineTo(this.points[i].x, this.points[i].y);
    }
    g.strokePath();

    g.lineStyle(14, this.blocked ? 0x884444 : 0x3d4a5c, 1);
    g.beginPath();
    g.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      g.lineTo(this.points[i].x, this.points[i].y);
    }
    g.strokePath();

    // Direction chevrons
    const total = this.length();
    const step = 28;
    for (let d = 10; d < total; d += step) {
      const p = this.pointAt(d / total);
      const n = this.pointAt(Math.min(1, (d + 8) / total));
      const angle = Math.atan2(n.y - p.y, n.x - p.x);
      g.fillStyle(0x5a6a80, 0.7);
      g.fillTriangle(
        p.x + Math.cos(angle) * 6,
        p.y + Math.sin(angle) * 6,
        p.x + Math.cos(angle + 2.4) * 5,
        p.y + Math.sin(angle + 2.4) * 5,
        p.x + Math.cos(angle - 2.4) * 5,
        p.y + Math.sin(angle - 2.4) * 5,
      );
    }
  }

  length(): number {
    let len = 0;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      len += Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    }
    return len;
  }

  pointAt(t: number): BeltPoint {
    t = Phaser.Math.Clamp(t, 0, 1);
    const total = this.length();
    let target = t * total;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const seg = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      if (target <= seg || i === this.points.length - 1) {
        const u = seg === 0 ? 0 : target / seg;
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      }
      target -= seg;
    }
    return { ...this.points[this.points.length - 1] };
  }

  canAccept(type: ItemType): boolean {
    if (this.blocked) return false;
    if (this.acceptTypes && !this.acceptTypes.includes(type)) return false;
    return this.items.length < 12;
  }

  addItem(item: ItemEntity, progress = 0): void {
    item.onBelt = true;
    item.carried = false;
    item.beltProgress = progress;
    this.items.push(item);
    const p = this.pointAt(progress);
    item.setPosition(p.x, p.y);
  }

  removeItem(item: ItemEntity): void {
    this.items = this.items.filter((i) => i !== item);
    item.onBelt = false;
  }

  update(dt: number, speedMult: number): ItemEntity[] {
    const finished: ItemEntity[] = [];
    if (this.blocked) {
      this.draw();
      return finished;
    }
    const speed = this.baseSpeed * speedMult;
    const total = this.length();
    for (const item of [...this.items]) {
      item.beltProgress += (speed * dt) / total;
      if (item.beltProgress >= 1) {
        item.beltProgress = 1;
        const p = this.pointAt(1);
        item.setPosition(p.x, p.y);
        finished.push(item);
      } else {
        const p = this.pointAt(item.beltProgress);
        item.setPosition(p.x, p.y);
      }
    }
    this.draw();
    return finished;
  }

  nearestItem(x: number, y: number, radius: number): ItemEntity | null {
    let best: ItemEntity | null = null;
    let bestDist = radius;
    for (const item of this.items) {
      const d = Phaser.Math.Distance.Between(x, y, item.sprite.x, item.sprite.y);
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    return best;
  }
}
