import Phaser from 'phaser';
import type { ItemEntity } from './Item';
import type { ItemType } from '../core/types';

export class StorageContainer {
  x: number;
  y: number;
  capacity: number;
  items: ItemEntity[] = [];
  sprite: Phaser.GameObjects.Container;
  labelText: Phaser.GameObjects.Text;
  private bodyGfx: Phaser.GameObjects.Rectangle;
  private highlight: Phaser.GameObjects.Rectangle;
  private actionText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, capacity: number) {
    this.x = x;
    this.y = y;
    this.capacity = capacity;

    this.highlight = scene.add.rectangle(0, 0, 84, 70, 0x88ffaa, 0);
    this.highlight.setStrokeStyle(2, 0x88ffaa, 0);

    this.bodyGfx = scene.add.rectangle(0, 0, 76, 60, 0x3a4558, 1);
    this.bodyGfx.setStrokeStyle(3, 0x7a8aa0);
    const lid = scene.add.rectangle(0, -24, 80, 12, 0x556277);
    const title = scene.add
      .text(0, -42, 'STORAGE', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#d0e0f0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.actionText = scene.add
      .text(0, 38, 'E: pick up · walk here', {
        fontFamily: 'Courier New, monospace',
        fontSize: '8px',
        color: '#99aabb',
      })
      .setOrigin(0.5);
    this.labelText = scene.add
      .text(0, 0, `0/${capacity}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.sprite = scene.add.container(x, y, [
      this.highlight,
      this.bodyGfx,
      lid,
      title,
      this.labelText,
      this.actionText,
    ]);
    this.sprite.setDepth(12);
  }

  get isFull(): boolean {
    return this.items.length >= this.capacity;
  }

  get freeSlots(): number {
    return Math.max(0, this.capacity - this.items.length);
  }

  canAccept(_type?: ItemType): boolean {
    return !this.isFull;
  }

  setHighlighted(on: boolean): void {
    if (on) {
      this.highlight.setFillStyle(0x88ffaa, 0.2);
      this.highlight.setStrokeStyle(2, 0x88ffaa, 1);
      this.bodyGfx.setStrokeStyle(3, 0xffffff);
    } else {
      this.highlight.setFillStyle(0x88ffaa, 0);
      this.highlight.setStrokeStyle(2, 0x88ffaa, 0);
      this.bodyGfx.setStrokeStyle(3, 0x7a8aa0);
    }
  }

  addItem(item: ItemEntity): boolean {
    if (this.isFull) return false;
    item.onBelt = false;
    item.carried = false;
    this.items.push(item);
    this.layoutItems();
    this.refreshLabel();
    return true;
  }

  takeItem(preferred?: ItemType): ItemEntity | null {
    if (this.items.length === 0) return null;
    let idx = this.items.length - 1;
    if (preferred) {
      const found = this.items.findIndex((i) => i.type === preferred);
      if (found >= 0) idx = found;
    }
    const [item] = this.items.splice(idx, 1);
    this.layoutItems();
    this.refreshLabel();
    return item;
  }

  takeNearest(x: number, y: number, radius: number): ItemEntity | null {
    let best: ItemEntity | null = null;
    let bestDist = radius;
    let bestIdx = -1;
    this.items.forEach((item, i) => {
      const d = Phaser.Math.Distance.Between(x, y, item.sprite.x, item.sprite.y);
      if (d < bestDist) {
        bestDist = d;
        best = item;
        bestIdx = i;
      }
    });
    if (best && bestIdx >= 0) {
      this.items.splice(bestIdx, 1);
      this.layoutItems();
      this.refreshLabel();
      return best;
    }
    const boxDist = Phaser.Math.Distance.Between(x, y, this.x, this.y);
    if (boxDist < radius + 20 && this.items.length > 0) {
      return this.takeItem();
    }
    return null;
  }

  setCapacity(cap: number): void {
    this.capacity = cap;
    this.refreshLabel();
  }

  private layoutItems(): void {
    const cols = 4;
    this.items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      item.setPosition(this.x - 24 + col * 16, this.y - 8 + row * 14);
      item.sprite.setDepth(13);
      item.sprite.setScale(0.7);
    });
  }

  private refreshLabel(): void {
    this.labelText.setText(`${this.items.length}/${this.capacity}`);
    this.bodyGfx.setFillStyle(this.isFull ? 0x664444 : 0x3a4558);
    this.actionText.setText(
      this.items.length > 0 ? 'E: TAKE item' : this.isFull ? 'FULL — clear it!' : 'belt dumps here',
    );
  }

  setNetworkCount(count: number, capacity: number): void {
    this.capacity = capacity;
    this.labelText.setText(`${count}/${capacity}`);
    this.bodyGfx.setFillStyle(count >= capacity ? 0x664444 : 0x3a4558);
  }

  containsPoint(x: number, y: number, radius = 50): boolean {
    return Phaser.Math.Distance.Between(x, y, this.x, this.y) < radius;
  }
}
