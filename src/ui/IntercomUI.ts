import Phaser from 'phaser';
import type { GameState } from '../core/GameState';

export class IntercomUI {
  container: Phaser.GameObjects.Container;
  private lines: Phaser.GameObjects.Text[] = [];
  private flashRect: Phaser.GameObjects.Rectangle;
  private state: GameState;
  private flash = 0;

  constructor(scene: Phaser.Scene, state: GameState) {
    this.state = state;
    this.flashRect = scene.add.rectangle(0, 0, 360, 90, 0xff4466, 0);
    const bg = scene.add.rectangle(0, 0, 360, 90, 0x0a1018, 0.75);
    bg.setStrokeStyle(1, 0x445566);
    const header = scene.add
      .text(-170, -35, '◈ INTERCOM', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#ff8866',
      })
      .setOrigin(0, 0.5);

    this.container = scene.add.container(200, 70, [this.flashRect, bg, header]);
    this.container.setDepth(150);
    this.container.setScrollFactor(0);

    for (let i = 0; i < 3; i++) {
      const t = scene.add
        .text(-170, -12 + i * 22, '', {
          fontFamily: 'Courier New, monospace',
          fontSize: '11px',
          color: '#e8d0b0',
          wordWrap: { width: 340 },
        })
        .setOrigin(0, 0.5);
      this.lines.push(t);
      this.container.add(t);
    }
  }

  ping(): void {
    this.flash = 0.4;
  }

  update(dt: number): void {
    if (this.flash > 0) {
      this.flash -= dt;
      this.flashRect.setFillStyle(0xff4466, Math.max(0, this.flash));
    }
    const demands = this.state.demands;
    for (let i = 0; i < 3; i++) {
      const d = demands[i];
      if (!d) {
        this.lines[i].setText('');
        continue;
      }
      const urg = '!' .repeat(1 + Math.floor(d.urgency * 3));
      this.lines[i].setText(`${urg} [${d.role}] ${d.line}`);
      const heat = Math.floor(180 + d.urgency * 75);
      this.lines[i].setColor(`rgb(255,${heat - 80},${100})`);
    }
  }
}
