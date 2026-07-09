import type { GameState } from './gameTypes.js';
import type { PowerSystem } from './PowerSystem.js';
import type { IntercomSystem } from './IntercomSystem.js';
import { clamp, dist, wrapAngle } from './util.js';

export interface SimBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 'asteroid' | 'enemy' | 'fuel' | 'bullet';
  hp: number;
  size?: number;
  weapon?: 'cannon' | 'mg';
  life?: number;
}

export interface ShipState {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  alive: boolean;
}

const W = 640;
const H = 400;

export class AsteroidsSim {
  ship: ShipState = { x: W / 2, y: H / 2, angle: 0, vx: 0, vy: 0, alive: true };
  bodies: SimBody[] = [];
  private spawnTimer = 0;
  private shootTimer = 0;
  private mgTimer = 0;
  private waveTimer = 0;
  private targetAngle = 0;
  private callbacks: {
    onFuelCollected: () => void;
    onAsteroidMined: (amount: number) => void;
    onEnemyDestroyed: () => void;
    onShipHit: (damage: number, shielded: boolean) => void;
    onWeaponFired: (weapon: 'cannon' | 'mg') => void;
    onWaveAdvanced: (wave: number) => void;
  };

  constructor(
    private power: PowerSystem,
    private state: GameState,
    private intercom: IntercomSystem,
    callbacks: AsteroidsSim['callbacks'],
  ) {
    this.callbacks = callbacks;
    this.seedWave(1);
  }

  seedWave(wave: number): void {
    this.bodies = this.bodies.filter((b) => b.kind === 'bullet');
    for (let i = 0; i < 3 + wave; i++) this.spawnAsteroid(2);
    for (let i = 0; i < Math.floor(wave / 2); i++) this.spawnEnemy();
    for (let i = 0; i < 2; i++) this.spawnFuel();
  }

  update(dt: number): void {
    if (!this.state.alive || !this.ship.alive) return;

    this.waveTimer += dt;
    if (this.waveTimer > 45) {
      this.waveTimer = 0;
      this.state.wave += 1;
      this.callbacks.onWaveAdvanced(this.state.wave);
      this.seedWave(this.state.wave);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(1.2, 3.5 - this.state.wave * 0.15);
      if (Math.random() < 0.55) this.spawnAsteroid(1 + Math.floor(Math.random() * 3));
      else if (Math.random() < 0.5) this.spawnEnemy();
      else this.spawnFuel();
    }

    this.ai(dt);
    this.integrate(dt);
    this.collide();
    this.state.fuel = Math.max(0, this.state.fuel - this.power.fuelDrainPerSec() * dt);
  }

  private ai(dt: number): void {
    const eng = this.power.engineMult() * (this.state.fuel > 0 ? 1 : 0.15);
    const wpn = this.power.weaponMult();
    const shellPenalty = this.intercom.ignoredPenalty('shells');
    const ammoPenalty = this.intercom.ignoredPenalty('ammo');
    const engDemand = this.intercom.ignoredPenalty('engines');

    let best: SimBody | null = null;
    let bestScore = -Infinity;
    for (const b of this.bodies) {
      if (b.kind === 'bullet') continue;
      const d = dist(this.ship.x, this.ship.y, b.x, b.y);
      let score = 0;
      if (b.kind === 'enemy') score = 200 - d;
      else if (b.kind === 'asteroid') score = 120 - d;
      else if (b.kind === 'fuel' && this.state.fuel < 70) score = 150 - d;
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }

    if (best) this.targetAngle = Math.atan2(best.y - this.ship.y, best.x - this.ship.x);
    else this.targetAngle += dt * 0.4;

    let da = wrapAngle(this.targetAngle - this.ship.angle);
    this.ship.angle += clamp(da, -3 * dt, 3 * dt);

    const threatNear = this.bodies.some(
      (b) =>
        (b.kind === 'asteroid' || b.kind === 'enemy') &&
        dist(this.ship.x, this.ship.y, b.x, b.y) < 50,
    );
    const thrust = (threatNear ? -0.4 : 1) * eng * (1 - engDemand * 0.5);
    this.ship.vx += Math.cos(this.ship.angle) * 90 * thrust * dt;
    this.ship.vy += Math.sin(this.ship.angle) * 90 * thrust * dt;
    this.ship.vx *= 1 - 0.6 * dt;
    this.ship.vy *= 1 - 0.6 * dt;

    this.shootTimer -= dt;
    this.mgTimer -= dt;
    const canCannon = this.state.heavyShells > 0 && this.shootTimer <= 0;
    const canMg = this.state.ammoBoxes > 0 && this.mgTimer <= 0;

    if (best && (best.kind === 'asteroid' || best.kind === 'enemy') && Math.abs(da) < 0.35) {
      if (canCannon && best.kind === 'enemy' && Math.random() < 0.6 * wpn * (1 - shellPenalty)) {
        this.fire('cannon');
        this.shootTimer = 0.9 / Math.max(0.4, wpn);
      } else if (canMg && Math.random() < 0.85 * wpn * (1 - ammoPenalty * 0.7)) {
        this.fire('mg');
        this.mgTimer = 0.18 / Math.max(0.4, wpn);
      } else if (canCannon && Math.random() < 0.3 * wpn) {
        this.fire('cannon');
        this.shootTimer = 1.1 / Math.max(0.4, wpn);
      }
    }
  }

  private fire(weapon: 'cannon' | 'mg'): void {
    if (weapon === 'cannon') {
      if (this.state.heavyShells <= 0) return;
      this.state.heavyShells -= 1;
    } else {
      if (this.state.ammoBoxes <= 0) return;
      if (Math.random() < 0.35) this.state.ammoBoxes -= 1;
    }
    this.callbacks.onWeaponFired(weapon);
    const speed = weapon === 'cannon' ? 220 : 280;
    this.bodies.push({
      x: this.ship.x + Math.cos(this.ship.angle) * 12,
      y: this.ship.y + Math.sin(this.ship.angle) * 12,
      vx: Math.cos(this.ship.angle) * speed + this.ship.vx,
      vy: Math.sin(this.ship.angle) * speed + this.ship.vy,
      r: weapon === 'cannon' ? 4 : 2,
      kind: 'bullet',
      hp: weapon === 'cannon' ? 3 : 1,
      weapon,
      life: 1.4,
    });
  }

  private integrate(dt: number): void {
    this.ship.x += this.ship.vx * dt;
    this.ship.y += this.ship.vy * dt;
    this.ship.x = clamp(this.ship.x, 10, W - 10);
    this.ship.y = clamp(this.ship.y, 10, H - 10);

    for (const b of this.bodies) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.kind === 'bullet') b.life = (b.life ?? 1) - dt;
      else {
        if (b.x < b.r || b.x > W - b.r) b.vx *= -1;
        if (b.y < b.r || b.y > H - b.r) b.vy *= -1;
        b.x = clamp(b.x, b.r, W - b.r);
        b.y = clamp(b.y, b.r, H - b.r);
      }
    }
    this.bodies = this.bodies.filter(
      (b) =>
        b.kind !== 'bullet' ||
        ((b.life ?? 0) > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20),
    );
  }

  private collide(): void {
    const shieldChance =
      this.power.shieldMult() * (1 - this.intercom.ignoredPenalty('shields') * 0.5);

    for (const bullet of [...this.bodies.filter((b) => b.kind === 'bullet')]) {
      for (const target of [...this.bodies]) {
        if (target.kind === 'bullet' || target.kind === 'fuel') continue;
        if (dist(bullet.x, bullet.y, target.x, target.y) < bullet.r + target.r) {
          target.hp -= bullet.hp;
          bullet.life = 0;
          if (target.hp <= 0) this.destroyBody(target);
        }
      }
    }

    for (const b of [...this.bodies]) {
      if (b.kind === 'bullet') continue;
      if (dist(this.ship.x, this.ship.y, b.x, b.y) < 10 + b.r) {
        if (b.kind === 'fuel') {
          this.callbacks.onFuelCollected();
          this.removeBody(b);
        } else {
          const shielded = Math.random() < shieldChance;
          const dmg = b.kind === 'enemy' ? 12 : 6 + (b.size ?? 1) * 3;
          this.callbacks.onShipHit(dmg, shielded);
          if (b.kind === 'asteroid') this.splitOrRemove(b);
          else this.removeBody(b);
        }
      }
    }
  }

  private destroyBody(b: SimBody): void {
    if (b.kind === 'asteroid') {
      this.callbacks.onAsteroidMined(b.size ?? 1);
      this.state.score += 10 * (b.size ?? 1);
      this.splitOrRemove(b);
    } else if (b.kind === 'enemy') {
      this.callbacks.onEnemyDestroyed();
      this.state.score += 50;
      this.removeBody(b);
    }
  }

  private splitOrRemove(b: SimBody): void {
    const size = b.size ?? 1;
    this.removeBody(b);
    if (size > 1) {
      for (let i = 0; i < 2; i++) {
        this.bodies.push({
          x: b.x,
          y: b.y,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          r: 6 + size * 4,
          kind: 'asteroid',
          hp: size,
          size: size - 1,
        });
      }
    }
  }

  private removeBody(b: SimBody): void {
    this.bodies = this.bodies.filter((x) => x !== b);
  }

  private spawnAsteroid(size: number): void {
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = Math.random() * W;
      y = 20;
    } else if (edge === 1) {
      x = Math.random() * W;
      y = H - 20;
    } else if (edge === 2) {
      x = 20;
      y = Math.random() * H;
    } else {
      x = W - 20;
      y = Math.random() * H;
    }
    this.bodies.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
      r: 8 + size * 6,
      kind: 'asteroid',
      hp: size * 2,
      size,
    });
  }

  private spawnEnemy(): void {
    this.bodies.push({
      x: Math.random() * W,
      y: Math.random() < 0.5 ? 20 : H - 20,
      vx: (Math.random() - 0.5) * 50,
      vy: (Math.random() - 0.5) * 50,
      r: 10,
      kind: 'enemy',
      hp: 4,
    });
  }

  private spawnFuel(): void {
    this.bodies.push({
      x: 40 + Math.random() * (W - 80),
      y: 40 + Math.random() * (H - 80),
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      r: 7,
      kind: 'fuel',
      hp: 1,
    });
  }
}
