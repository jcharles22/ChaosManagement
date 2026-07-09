import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import type { WorldSnapshot } from '../network/types';
import { ItemEntity } from '../entities/Item';
import { RemotePlayer } from '../entities/RemotePlayer';
import { HullBreach } from '../entities/HullBreach';
import type { Machine } from '../entities/Machine';
import type { ConveyorBelt } from '../entities/ConveyorBelt';
import type { StorageContainer } from '../entities/StorageContainer';
import type { AsteroidsSim } from '../sim/AsteroidsSim';
import { beltPointAt } from './beltMath';

const BELT_POINTS: Record<string, { x: number; y: number }[]> = {
  incoming: [
    { x: 50, y: 250 },
    { x: 200, y: 250 },
    { x: 320, y: 250 },
    { x: 400, y: 320 },
  ],
  shells: [
    { x: 900, y: 300 },
    { x: 1050, y: 280 },
    { x: 1180, y: 240 },
  ],
  ammo: [
    { x: 900, y: 400 },
    { x: 1050, y: 420 },
    { x: 1180, y: 460 },
  ],
};

export class WorldSync {
  private scene: Phaser.Scene;
  private state: GameState;
  private sim: AsteroidsSim;
  private machines: Machine[];
  private belts: Record<string, ConveyorBelt>;
  private storage: StorageContainer;
  private crew = new Map<string, RemotePlayer>();
  private items = new Map<string, ItemEntity>();
  private breaches = new Map<string, HullBreach>();

  constructor(
    scene: Phaser.Scene,
    state: GameState,
    sim: AsteroidsSim,
    machines: Machine[],
    belts: { incoming: ConveyorBelt; shells: ConveyorBelt; ammo: ConveyorBelt },
    storage: StorageContainer,
  ) {
    this.scene = scene;
    this.state = state;
    this.sim = sim;
    this.machines = machines;
    this.belts = { incoming: belts.incoming, shells: belts.shells, ammo: belts.ammo };
    this.storage = storage;
  }

  apply(snapshot: WorldSnapshot, localPlayerId: string): void {
    Object.assign(this.state, snapshot.ship);
    this.state.pips = { ...snapshot.ship.pips };
    this.state.demands = [...snapshot.ship.demands];
    this.state.upgrades = [...snapshot.ship.upgrades];

    this.sim.ship = { ...snapshot.asteroids.ship };
    this.sim.bodies = snapshot.asteroids.bodies.map((b) => ({ ...b }));

    for (const p of snapshot.players) {
      let crew = this.crew.get(p.id);
      if (!crew) {
        crew = new RemotePlayer(this.scene, p.id, p.name, p.role, p.x, p.y);
        this.crew.set(p.id, crew);
      }
      crew.setTarget(p.x, p.y);
      crew.sprite.setDepth(p.id === localPlayerId ? 41 : 39);
    }

    for (const id of [...this.crew.keys()]) {
      if (!snapshot.players.some((p) => p.id === id)) {
        this.crew.get(id)!.destroy();
        this.crew.delete(id);
      }
    }

    const liveIds = new Set<string>();

    for (const belt of snapshot.belts) {
      const beltEnt = this.belts[belt.id];
      if (beltEnt) {
        beltEnt.blocked = belt.blocked;
        beltEnt.draw();
      }
      const points = BELT_POINTS[belt.id] ?? [];
      for (const bi of belt.items) {
        liveIds.add(bi.id);
        const item = this.ensureItem(bi.id, bi.type);
        const pt = beltPointAt(points, bi.progress);
        item.setPosition(pt.x, pt.y);
        item.sprite.setVisible(true);
        item.sprite.setScale(1);
        item.onBelt = true;
        item.carried = false;
      }
    }

    for (const si of snapshot.storage.items) {
      liveIds.add(si.id);
    }
    this.storage.setNetworkCount(snapshot.storage.items.length, snapshot.storage.capacity);

    for (const m of snapshot.machines) {
      const machine = this.machines.find((x) => x.id === m.id);
      if (!machine) continue;
      machine.applyNetworkState({
        broken: m.broken,
        crafting: m.crafting,
        progress: m.progress,
        repairProgress: m.repairProgress,
        powered: m.powered,
        inputCount: m.inputItems.length,
        outputCount: m.outputItems.length,
      });
    }

    for (const fi of snapshot.floorItems) {
      liveIds.add(fi.id);
      const item = this.ensureItem(fi.id, fi.type);
      item.setPosition(fi.x, fi.y);
      item.sprite.setVisible(true);
      item.sprite.setScale(1);
    }

    for (const p of snapshot.players) {
      const crew = this.crew.get(p.id);
      for (let i = 0; i < (p.carried?.length ?? 0); i++) {
        const fakeId = `carry-${p.id}-${i}`;
        liveIds.add(fakeId);
        const item = this.ensureItem(fakeId, p.carried![i]);
        if (crew) {
          item.setPosition(crew.x + 14 + i * 8, crew.y - 18 - i * 6);
          item.sprite.setVisible(true);
          item.sprite.setScale(0.85);
          item.sprite.setDepth(42);
        }
      }
    }

    for (const [id, item] of [...this.items]) {
      if (!liveIds.has(id)) {
        item.destroy();
        this.items.delete(id);
      }
    }

    for (const b of snapshot.breaches) {
      let breach = this.breaches.get(b.id);
      if (!breach) {
        breach = new HullBreach(this.scene, b.x, b.y);
        this.breaches.set(b.id, breach);
      }
      breach.setNetworkState(b.x, b.y, b.size);
    }

    for (const [id, breach] of [...this.breaches]) {
      if (!snapshot.breaches.some((b) => b.id === id)) {
        breach.sprite.destroy();
        this.breaches.delete(id);
      }
    }
  }

  updateCrew(dt: number): void {
    for (const c of this.crew.values()) c.update(dt);
  }

  destroy(): void {
    for (const c of this.crew.values()) c.destroy();
    this.crew.clear();
    for (const item of this.items.values()) item.destroy();
    this.items.clear();
    for (const b of this.breaches.values()) b.sprite.destroy();
    this.breaches.clear();
  }

  private ensureItem(id: string, type: import('../core/types').ItemType): ItemEntity {
    let item = this.items.get(id);
    if (!item) {
      item = new ItemEntity(this.scene, type, 0, 0);
      this.items.set(id, item);
    }
    return item;
  }
}
