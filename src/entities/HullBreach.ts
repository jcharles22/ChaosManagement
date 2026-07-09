import Phaser from 'phaser';

export class HullBreach {
  x: number;
  y: number;
  size: number;
  maxSize: number;
  repaired = false;
  sprite: Phaser.GameObjects.Container;
  private ring: Phaser.GameObjects.Arc;
  private crack: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  private pulse = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.size = 18;
    this.maxSize = 56;

    this.crack = scene.add.graphics();
    this.ring = scene.add.circle(0, 0, this.size, 0x112233, 0.55);
    this.ring.setStrokeStyle(3, 0xff4466, 0.9);
    const warn = scene.add
      .text(0, 0, '!', {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        color: '#ff6688',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.sprite = scene.add.container(x, y, [this.crack, this.ring, warn]);
    this.sprite.setDepth(8);
    this.redraw();
  }

  near(px: number, py: number, r = 40): boolean {
    return Phaser.Math.Distance.Between(px, py, this.x, this.y) < r + this.size * 0.3;
  }

  update(dt: number, slowMult: number): number {
    if (this.repaired) return 0;
    this.pulse += dt;
    this.size = Math.min(this.maxSize, this.size + (6 * dt) / slowMult);
    this.ring.setRadius(this.size);
    this.ring.setAlpha(0.4 + Math.sin(this.pulse * 6) * 0.15);
    this.redraw();
    // Damage per second scales with size
    return (this.size / this.maxSize) * 2.2 * dt;
  }

  repair(amount: number): boolean {
    this.size -= amount;
    if (this.size <= 8) {
      this.repaired = true;
      this.sprite.destroy();
      return true;
    }
    this.ring.setRadius(this.size);
    this.redraw();
    return false;
  }

  setNetworkState(x: number, y: number, size: number): void {
    this.x = x;
    this.y = y;
    this.size = size;
    this.sprite.setPosition(x, y);
    this.ring.setRadius(size);
    this.redraw();
  }

  private redraw(): void {
    const g = this.crack;
    g.clear();
    g.lineStyle(2, 0xff3355, 0.8);
    const r = this.size;
    g.beginPath();
    g.moveTo(-r * 0.6, 0);
    g.lineTo(r * 0.5, -r * 0.3);
    g.lineTo(r * 0.2, r * 0.5);
    g.lineTo(-r * 0.3, r * 0.2);
    g.strokePath();
  }
}
