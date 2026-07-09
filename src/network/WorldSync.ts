import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import type { ItemType } from '../core/types';
import type { WorldSnapshot } from '../network/types';
import { SnapshotBuffer } from './SnapshotBuffer';
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

export interface NetworkSideEffects {
  events: string[];
  newDemands: boolean;
}

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
  private playerBuffer = new SnapshotBuffer();
  private lastTick = -1;
  private beltBlockedCache = new Map<string, boolean>();
  private machineCache = new Map<string, string>();
  private localCarriedType: ItemType | null = null;
  private lastDemandCount = 0;
  private beltItemsCache = new Map<string, { id: string; type: ItemType; progress: number }[]>();
  private breachCache: { x: number; y: number }[] = [];

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

  onSnapshot(snapshot: WorldSnapshot, localPlayerId: string): NetworkSideEffects {
    this.playerBuffer.push(snapshot);

    let sideEffects: NetworkSideEffects = { events: [], newDemands: false };
    if (snapshot.tick !== this.lastTick) {
      this.lastTick = snapshot.tick;
      sideEffects = this.applyWorldState(snapshot);
    }

    for (const p of snapshot.players) {
      let crew = this.crew.get(p.id);
      if (!crew) {
        crew = new RemotePlayer(
          this.scene,
          p.id,
          p.name,
          p.role,
          p.x,
          p.y,
          p.id === localPlayerId,
        );
        this.crew.set(p.id, crew);
      }
      crew.setCarriedCount(p.carried?.length ?? 0);
      crew.setRepairing(p.repairing ?? false);
      if (p.id === localPlayerId) {
        this.localCarriedType =
          p.carried && p.carried.length > 0 ? p.carried[p.carried.length - 1] : null;
        crew.reconcile(p.x, p.y);
      }
    }

    for (const id of [...this.crew.keys()]) {
      if (!snapshot.players.some((p) => p.id === id)) {
        this.crew.get(id)!.destroy();
        this.crew.delete(id);
      }
    }

    return sideEffects;
  }

  getLocalCarriedType(): ItemType | null {
    return this.localCarriedType;
  }

  hasBeltItemNear(beltId: string, x: number, y: number, radius: number): boolean {
    const points = BELT_POINTS[beltId] ?? [];
    const items = this.beltItemsCache.get(beltId) ?? [];
    for (const bi of items) {
      const pt = beltPointAt(points, bi.progress);
      if (Phaser.Math.Distance.Between(x, y, pt.x, pt.y) < radius) return true;
    }
    return false;
  }

  hasBreachNear(x: number, y: number, radius: number): boolean {
    for (const b of this.breachCache) {
      if (Phaser.Math.Distance.Between(x, y, b.x, b.y) < radius) return true;
    }
    return false;
  }

  predictLocal(
    localPlayerId: string,
    mx: number,
    my: number,
    dt: number,
    repairing: boolean,
  ): void {
    this.crew.get(localPlayerId)?.predictMove(mx, my, dt, repairing);
  }

  /** Dead-reckon bridge feed between server snapshots (multiplayer). */
  extrapolateSim(dt: number): void {
    const ship = this.sim.ship;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    for (const b of this.sim.bodies) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
  }

  getLocalPosition(localPlayerId: string): { x: number; y: number } | null {
    const crew = this.crew.get(localPlayerId);
    return crew ? { x: crew.x, y: crew.y } : null;
  }

  updateCrew(dt: number, localPlayerId: string): void {
    const now = performance.now();
    for (const [id, crew] of this.crew) {
      if (id === localPlayerId) continue;
      const pos = this.playerBuffer.getPosition(id, now);
      if (pos) crew.moveToward(pos.x, pos.y, dt);
    }
  }

  getCrew(id: string): RemotePlayer | undefined {
    return this.crew.get(id);
  }

  private applyWorldState(snapshot: WorldSnapshot): NetworkSideEffects {
    Object.assign(this.state, snapshot.ship);
    this.state.pips = { ...snapshot.ship.pips };
    this.state.demands = [...snapshot.ship.demands];
    this.state.upgrades = [...snapshot.ship.upgrades];

    const newDemands = snapshot.ship.demands.length > this.lastDemandCount;
    this.lastDemandCount = snapshot.ship.demands.length;

    // Asteroids — full body list every server tick
    this.sim.ship = { ...snapshot.asteroids.ship };
    this.sim.bodies = snapshot.asteroids.bodies.map((b) => ({ ...b }));

    const liveIds = new Set<string>();
    this.beltItemsCache.clear();

    for (const belt of snapshot.belts) {
      this.beltItemsCache.set(belt.id, belt.items);
      const beltEnt = this.belts[belt.id];
      if (beltEnt) {
        const prev = this.beltBlockedCache.get(belt.id);
        if (prev !== belt.blocked) {
          beltEnt.blocked = belt.blocked;
          beltEnt.draw();
          this.beltBlockedCache.set(belt.id, belt.blocked);
        }
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

    for (let i = 0; i < snapshot.storage.items.length; i++) {
      const si = snapshot.storage.items[i];
      liveIds.add(si.id);
      const item = this.ensureItem(si.id, si.type);
      this.storage.layoutNetworkItem(item, i);
    }
    this.storage.setNetworkCount(snapshot.storage.items.length, snapshot.storage.capacity);

    for (const m of snapshot.machines) {
      const itemKey = `${m.inputItems.map((i) => i.id).join(',')}|${m.outputItems.map((i) => i.id).join(',')}`;
      const stateKey = `${m.broken}|${m.crafting}|${m.progress.toFixed(2)}|${m.powered}|${m.repairProgress.toFixed(2)}|${itemKey}`;
      const machine = this.machines.find((x) => x.id === m.id);
      if (machine && this.machineCache.get(m.id) !== stateKey) {
        this.machineCache.set(m.id, stateKey);
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
      machine?.inputChest.syncNetworkItems(m.inputItems, (id, type) => this.ensureItem(id, type));
      machine?.outputChest.syncNetworkItems(m.outputItems, (id, type) => this.ensureItem(id, type));
      for (const item of m.inputItems) liveIds.add(item.id);
      for (const item of m.outputItems) liveIds.add(item.id);
    }

    for (const fi of snapshot.floorItems) {
      liveIds.add(fi.id);
      const item = this.ensureItem(fi.id, fi.type);
      item.setPosition(fi.x, fi.y);
      item.sprite.setVisible(true);
      item.sprite.setScale(1);
      item.onBelt = false;
      item.carried = false;
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
          item.onBelt = false;
          item.carried = true;
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
    this.breachCache = snapshot.breaches.map((b) => ({ x: b.x, y: b.y }));

    for (const [id, breach] of [...this.breaches]) {
      if (!snapshot.breaches.some((b) => b.id === id)) {
        breach.sprite.destroy();
        this.breaches.delete(id);
      }
    }

    return {
      events: snapshot.events ?? [],
      newDemands,
    };
  }

  destroy(): void {
    for (const c of this.crew.values()) c.destroy();
    this.crew.clear();
    for (const item of this.items.values()) item.destroy();
    this.items.clear();
    for (const b of this.breaches.values()) b.sprite.destroy();
    this.breaches.clear();
    this.playerBuffer.clear();
    this.beltItemsCache.clear();
    this.machineCache.clear();
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
