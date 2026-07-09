import Phaser from 'phaser';
import { AsteroidsSim, ASTEROIDS_W, ASTEROIDS_H } from './AsteroidsSim';
import type { GameState } from '../core/GameState';

/** On-wall screen size (sim world is 2× this — drawn scaled down). */
const VIEW_W = 320;
const VIEW_H = 200;
const SCALE = VIEW_W / ASTEROIDS_W;

export class AsteroidsView {
  container: Phaser.GameObjects.Container;
  private gfx: Phaser.GameObjects.Graphics;
  private frame: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private sim: AsteroidsSim;
  private state: GameState;
  private flash = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, sim: AsteroidsSim, state: GameState) {
    this.sim = sim;
    this.state = state;

    this.frame = scene.add.rectangle(0, 0, VIEW_W + 16, VIEW_H + 36, 0x1a2230);
    this.frame.setStrokeStyle(4, 0x5a7a9a);
    const bezel = scene.add.rectangle(0, -VIEW_H / 2 - 10, VIEW_W + 8, 18, 0x2a3548);
    this.title = scene.add
      .text(0, -VIEW_H / 2 - 10, 'BRIDGE FEED — SOMEONE ELSE IS HAVING FUN', {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#8ab4d4',
      })
      .setOrigin(0.5);

    this.gfx = scene.add.graphics();

    this.container = scene.add.container(x, y, [this.frame, bezel, this.title, this.gfx]);
    this.container.setDepth(15);
  }

  flashHit(): void {
    this.flash = 0.25;
  }

  update(_dt: number): void {
    const g = this.gfx;
    g.clear();
    const ox = -VIEW_W / 2;
    const oy = -VIEW_H / 2 + 8;
    const s = SCALE;

    // Screen bg
    g.fillStyle(0x050810, 1);
    g.fillRect(ox, oy, VIEW_W, VIEW_H);

    // Stars
    g.fillStyle(0x334455, 1);
    for (let i = 0; i < 60; i++) {
      const sx = ox + ((i * 73) % VIEW_W);
      const sy = oy + ((i * 97) % VIEW_H);
      g.fillCircle(sx, sy, 1);
    }

    const toX = (wx: number) => ox + wx * s;
    const toY = (wy: number) => oy + wy * s;

    // Shield aura
    const shield = this.state.pips.shields;
    if (shield > 0) {
      g.lineStyle(2, 0x44aaff, 0.25 + shield * 0.1);
      g.strokeCircle(
        toX(this.sim.ship.x),
        toY(this.sim.ship.y),
        (16 + shield) * s,
      );
    }

    // Bodies
    for (const b of this.sim.bodies) {
      const bx = toX(b.x);
      const by = toY(b.y);
      const br = b.r * s;
      if (b.kind === 'asteroid') {
        g.lineStyle(2, 0xa09070, 1);
        g.strokeCircle(bx, by, br);
        g.fillStyle(0x3a3428, 0.6);
        g.fillCircle(bx, by, Math.max(1, br - 1));
      } else if (b.kind === 'enemy') {
        g.fillStyle(0xff3355, 1);
        g.fillTriangle(
          bx + Math.cos(0) * br,
          by + Math.sin(0) * br,
          bx + Math.cos(2.3) * br,
          by + Math.sin(2.3) * br,
          bx + Math.cos(-2.3) * br,
          by + Math.sin(-2.3) * br,
        );
      } else if (b.kind === 'fuel') {
        g.fillStyle(0x44ddff, 0.9);
        g.fillCircle(bx, by, br);
      } else if (b.kind === 'bullet') {
        g.fillStyle(b.weapon === 'cannon' ? 0xff8844 : 0xffee66, 1);
        g.fillCircle(bx, by, Math.max(1.5, br));
      }
    }

    // Ship
    const ship = this.sim.ship;
    const ang = ship.angle;
    const cx = toX(ship.x);
    const cy = toY(ship.y);
    const tip = 10 * s;
    const wing = 8 * s;
    g.fillStyle(0x66ffcc, 1);
    g.fillTriangle(
      cx + Math.cos(ang) * tip,
      cy + Math.sin(ang) * tip,
      cx + Math.cos(ang + 2.5) * wing,
      cy + Math.sin(ang + 2.5) * wing,
      cx + Math.cos(ang - 2.5) * wing,
      cy + Math.sin(ang - 2.5) * wing,
    );

    if (this.flash > 0) {
      this.flash -= 0.016;
      g.fillStyle(0xff2244, 0.25);
      g.fillRect(ox, oy, VIEW_W, VIEW_H);
    }

    if (this.state.integrity < 40) {
      g.lineStyle(2, 0xff4466, 0.5);
      g.strokeRect(ox + 2, oy + 2, VIEW_W - 4, VIEW_H - 4);
    }

    this.title.setText(
      `BRIDGE FEED  W${this.state.wave}  SCR ${this.state.score}  — you're the engineer`,
    );
  }
}
