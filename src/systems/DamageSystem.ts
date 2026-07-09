import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import type { Machine } from '../entities/Machine';
import { HullBreach } from '../entities/HullBreach';
import { bus } from '../core/EventBus';
import type { MachineId } from '../core/types';

export class DamageSystem {
  state: GameState;
  breaches: HullBreach[] = [];
  machines: Machine[] = [];
  private scene: Phaser.Scene;
  private floorBounds: Phaser.Geom.Rectangle;

  constructor(scene: Phaser.Scene, state: GameState, floorBounds: Phaser.Geom.Rectangle) {
    this.scene = scene;
    this.state = state;
    this.floorBounds = floorBounds;
  }

  setMachines(machines: Machine[]): void {
    this.machines = machines;
  }

  onShipHit(damage: number, shielded: boolean): void {
    const actual = shielded ? damage * 0.35 : damage;
    this.state.integrity = Math.max(0, this.state.integrity - actual);

    if (!shielded || Math.random() < 0.45) {
      this.spawnBreach();
    }
    if (Math.random() < (shielded ? 0.25 : 0.55)) {
      this.breakRandomMachine();
    }

    this.scene.cameras.main.shake(120, 0.006);
    if (this.state.integrity <= 0) {
      this.triggerGameOver('Hull integrity critical. Abandon ship!');
    }
  }

  spawnBreach(): void {
    if (this.breaches.filter((b) => !b.repaired).length >= 6) return;
    const x = Phaser.Math.Between(this.floorBounds.left + 60, this.floorBounds.right - 60);
    const y = Phaser.Math.Between(this.floorBounds.top + 80, this.floorBounds.bottom - 40);
    const breach = new HullBreach(this.scene, x, y);
    this.breaches.push(breach);
    bus.emit('breachSpawned', { x, y });
  }

  breakRandomMachine(): void {
    const candidates = this.machines.filter((m) => !m.broken);
    if (candidates.length === 0) return;
    const m = candidates[Math.floor(Math.random() * candidates.length)];
    m.break();
    bus.emit('machineBroken', { id: m.id });
  }

  repairMachine(id: MachineId): void {
    const m = this.machines.find((mach) => mach.id === id);
    if (!m || !m.broken) return;
    m.repair();
    bus.emit('machineRepaired', { id });
  }

  update(dt: number): void {
    let dmg = 0;
    for (const b of this.breaches) {
      if (!b.repaired) dmg += b.update(dt, this.state.breachSlowMult);
    }
    this.breaches = this.breaches.filter((b) => !b.repaired);
    if (dmg > 0) {
      this.state.integrity = Math.max(0, this.state.integrity - dmg);
      if (this.state.integrity <= 0) {
        this.triggerGameOver('Hull breaches overwhelmed the deck.');
      }
    }
  }

  nearestBreach(x: number, y: number, r: number): HullBreach | null {
    let best: HullBreach | null = null;
    let bestD = r;
    for (const b of this.breaches) {
      if (b.repaired) continue;
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private triggerGameOver(reason: string): void {
    if (!this.state.alive) return;
    this.state.alive = false;
    this.state.gameOverReason = reason;
    bus.emit('gameOver', {
      reason,
      score: this.state.score,
      wave: this.state.wave,
      survivedMs: this.state.elapsedMs,
    });
  }
}
