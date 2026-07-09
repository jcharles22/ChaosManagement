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

export class RemotePlayer {
  sprite: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;
  private roleText: Phaser.GameObjects.Text;
  readonly id: string;
  targetX: number;
  targetY: number;

  constructor(scene: Phaser.Scene, id: string, name: string, role: CrewRole, x: number, y: number) {
    this.id = id;
    this.targetX = x;
    this.targetY = y;

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
    this.sprite.setDepth(39);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  update(dt: number): void {
    const t = 1 - Math.exp(-12 * dt);
    this.sprite.x += (this.targetX - this.sprite.x) * t;
    this.sprite.y += (this.targetY - this.sprite.y) * t;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
