import Phaser from 'phaser';
import type { CrewRole } from '../core/types';

const ROLE_COLORS: Record<CrewRole, number> = {
  captain: 0x4ecdc4,
  heavy_gunner: 0xff8844,
  mg_gunner: 0xaa88ff,
};

const ROLE_LABELS: Record<CrewRole, string> = {
  captain: 'Captain',
  heavy_gunner: 'Heavy Gunner',
  mg_gunner: 'MG Gunner',
};

const FLOOR = { left: 56, right: 1224, top: 216, bottom: 664 };
const SPEED = 180;

export class RemotePlayer {
  sprite: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;
  private roleText: Phaser.GameObjects.Text;
  readonly id: string;
  private isLocal: boolean;
  private carriedCount = 0;

  constructor(
    scene: Phaser.Scene,
    id: string,
    name: string,
    role: CrewRole,
    x: number,
    y: number,
    isLocal = false,
  ) {
    this.id = id;
    this.isLocal = isLocal;

    const color = ROLE_COLORS[role];
    this.body = scene.add.rectangle(0, 0, 22, 28, color, 1);
    this.body.setStrokeStyle(2, 0xffffff);
    const helmet = scene.add.circle(0, -10, 8, color, 0.85);
    const visor = scene.add.rectangle(0, -10, 10, 4, 0x224466);
    this.nameText = scene.add
      .text(0, -42, name, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5);
    this.roleText = scene.add
      .text(0, -54, ROLE_LABELS[role], {
        fontFamily: 'Courier New, monospace',
        fontSize: '8px',
        color: '#aabbcc',
      })
      .setOrigin(0.5);

    this.sprite = scene.add.container(x, y, [
      this.body,
      helmet,
      visor,
      this.nameText,
      this.roleText,
    ]);
    this.sprite.setDepth(isLocal ? 41 : 39);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  setCarriedCount(n: number): void {
    this.carriedCount = n;
  }

  /** Immediate local movement — no waiting for server round-trip */
  predictMove(mx: number, my: number, dt: number, repairing = false): void {
    if (!this.isLocal || (mx === 0 && my === 0)) return;
    const len = Math.hypot(mx, my) || 1;
    const mult = repairing ? 0.35 : this.carriedCount > 0 ? 0.85 : 1;
    this.sprite.x += (mx / len) * SPEED * mult * dt;
    this.sprite.y += (my / len) * SPEED * mult * dt;
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, FLOOR.left, FLOOR.right);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, FLOOR.top, FLOOR.bottom);
  }

  /** Soft correction when server disagrees with prediction */
  reconcile(sx: number, sy: number): void {
    const dx = sx - this.sprite.x;
    const dy = sy - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 48) {
      this.sprite.x = sx;
      this.sprite.y = sy;
    } else if (dist > 1.5) {
      this.sprite.x += dx * 0.2;
      this.sprite.y += dy * 0.2;
    }
  }

  /** Remote players — smooth toward interpolated server position */
  moveToward(x: number, y: number, dt: number): void {
    if (this.isLocal) return;
    const t = 1 - Math.exp(-20 * dt);
    this.sprite.x += (x - this.sprite.x) * t;
    this.sprite.y += (y - this.sprite.y) * t;
  }

  snapTo(x: number, y: number): void {
    this.sprite.x = x;
    this.sprite.y = y;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
