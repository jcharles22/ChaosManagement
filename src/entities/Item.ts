import Phaser from 'phaser';
import { ITEM_COLORS, ITEM_LABELS, type ItemType } from '../core/types';

export class ItemEntity {
  type: ItemType;
  sprite: Phaser.GameObjects.Container;
  onBelt = false;
  beltProgress = 0;
  carried = false;

  constructor(scene: Phaser.Scene, type: ItemType, x: number, y: number) {
    this.type = type;
    const color = ITEM_COLORS[type];
    const body = scene.add.circle(0, 0, 11, color, 1);
    body.setStrokeStyle(2, 0xffffff, 0.7);
    const highlight = scene.add.circle(-3, -3, 3, 0xffffff, 0.35);
    const label = scene.add
      .text(0, 16, ITEM_LABELS[type], {
        fontFamily: 'Courier New, monospace',
        fontSize: '8px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5);
    this.sprite = scene.add.container(x, y, [body, highlight, label]);
    this.sprite.setDepth(20);
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
