import type { CrewRole, ItemType, MachineId, PowerChannel } from './gameTypes.js';
import {
  createInitialState,
  healIntegrityFromBreach,
  type GameState,
  MACHINE_RECIPES,
} from './gameTypes.js';
import { PowerSystem } from './PowerSystem.js';
import { IntercomSystem } from './IntercomSystem.js';
import { UpgradeSystem } from './UpgradeSystem.js';
import { AsteroidsSim, type SimBody, type ShipState } from './AsteroidsSim.js';
import {
  BELTS,
  FLOOR,
  MACHINE_POSITIONS,
  PLAYER_SPEED,
  POWER_CONSOLE,
  SPAWNS,
  STORAGE,
  UPGRADE_BAY,
} from './constants.js';
import { beltLength, beltPointAt, between, clamp, dist } from './util.js';

export interface GameItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  onBelt: boolean;
  beltId: string | null;
  beltProgress: number;
  carriedBy: string | null;
}

export interface BreachState {
  id: string;
  x: number;
  y: number;
  size: number;
}

export interface MachineItemNet {
  id: string;
  type: ItemType;
}

interface MachineSimState {
  id: MachineId;
  broken: boolean;
  crafting: boolean;
  progress: number;
  repairProgress: number;
  powered: boolean;
  inputItems: string[];
  outputItems: string[];
}

export interface MachineNetState {
  id: MachineId;
  broken: boolean;
  crafting: boolean;
  progress: number;
  repairProgress: number;
  powered: boolean;
  inputItems: MachineItemNet[];
  outputItems: MachineItemNet[];
}

export interface BeltState {
  id: string;
  blocked: boolean;
  items: { id: string; type: ItemType; progress: number }[];
}

export interface PlayerNetState {
  id: string;
  name: string;
  role: CrewRole;
  x: number;
  y: number;
  ready: boolean;
  repairing: boolean;
  carried: ItemType[];
  powerConsoleOpen: boolean;
}

export interface WorldSnapshot {
  tick: number;
  serverTime: number;
  ship: GameState;
  players: PlayerNetState[];
  belts: BeltState[];
  storage: { capacity: number; items: { id: string; type: ItemType }[] };
  machines: MachineNetState[];
  breaches: BreachState[];
  floorItems: { id: string; type: ItemType; x: number; y: number }[];
  asteroids: { ship: ShipState; bodies: SimBody[] };
  gameOver?: { reason: string; score: number; wave: number; survivedMs: number };
  events?: string[];
}

interface RoomPlayer {
  id: string;
  name: string;
  role: CrewRole;
  x: number;
  y: number;
  ready: boolean;
  move: { x: number; y: number };
  interactHeld: boolean;
  interactPressed: boolean;
  repairing: boolean;
  carried: string[];
  powerConsoleOpen: boolean;
}

export class GameWorld {
  private state = createInitialState();
  private power = new PowerSystem(this.state);
  private upgrades = new UpgradeSystem(this.state);
  private intercom!: IntercomSystem;
  private sim!: AsteroidsSim;
  private players = new Map<string, RoomPlayer>();
  private items = new Map<string, GameItem>();
  private breaches: BreachState[] = [];
  private machines: MachineSimState[] = [];
  private beltItems = new Map<string, string[]>();
  private beltBlocked = new Map<string, boolean>();
  private storageItems: string[] = [];
  private nextItemId = 1;
  private nextBreachId = 1;
  private tick = 0;
  private fuelStarveTimer = 0;
  private started = false;
  private events: string[] = [];

  constructor() {
    for (const id of Object.keys(MACHINE_POSITIONS) as MachineId[]) {
      const recipe = MACHINE_RECIPES[id];
      this.machines.push({
        id,
        broken: false,
        crafting: false,
        progress: 0,
        repairProgress: 0,
        powered: true,
        inputItems: [],
        outputItems: recipe.output === 'ship_fuel' ? [] : [],
      });
    }
    for (const beltId of Object.keys(BELTS)) {
      this.beltItems.set(beltId, []);
      this.beltBlocked.set(beltId, false);
    }

    this.intercom = new IntercomSystem(this.state, () => {});
    this.sim = new AsteroidsSim(this.power, this.state, this.intercom, {
      onFuelCollected: () => this.trySpawnIncoming('fuel_orb'),
      onAsteroidMined: (amount) => {
        for (let i = 0; i < amount; i++) this.trySpawnIncoming('raw_chunk');
      },
      onEnemyDestroyed: () => this.trySpawnIncoming('upgrade_module'),
      onShipHit: (damage, shielded) => this.onShipHit(damage, shielded),
      onWeaponFired: () => {},
      onWaveAdvanced: (wave) => {
        this.state.score += wave * 25;
        this.events.push(`Wave ${wave} — bridge is escalating`);
        if (wave === 5) this.events.push('Shift milestone: still employed!');
        if (wave === 8) this.events.push('Heroic overtime. Captain still yelling.');
      },
    });
  }

  addPlayer(_ws: unknown, name: string): string {
    const id = crypto.randomUUID();
    const role = this.nextRole();
    const spawn = SPAWNS[this.players.size] ?? SPAWNS[0];
    this.players.set(id, {
      id,
      name: name.slice(0, 16) || 'Engineer',
      role,
      x: spawn.x,
      y: spawn.y,
      ready: false,
      move: { x: 0, y: 0 },
      interactHeld: false,
      interactPressed: false,
      repairing: false,
      carried: [],
      powerConsoleOpen: false,
    });
    return id;
  }

  removePlayer(id: string): void {
    const p = this.players.get(id);
    if (!p) return;
    for (const itemId of [...p.carried]) {
      const item = this.items.get(itemId);
      if (item) {
        item.carriedBy = null;
        item.x = p.x + 24;
        item.y = p.y + 24;
      }
    }
    p.carried = [];
    this.players.delete(id);
  }

  getPlayerRole(id: string): CrewRole | undefined {
    return this.players.get(id)?.role;
  }

  setReady(id: string): void {
    const p = this.players.get(id);
    if (p) p.ready = true;
  }

  allReady(): boolean {
    return this.players.size === 3 && [...this.players.values()].every((p) => p.ready);
  }

  start(): void {
    this.started = true;
  }

  isStarted(): boolean {
    return this.started;
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  isFull(): boolean {
    return this.players.size >= 3;
  }

  applyInput(
    id: string,
    input: {
      move?: { x: number; y: number };
      interactDown?: boolean;
      interactUp?: boolean;
      interactHeld?: boolean;
    },
  ): void {
    const p = this.players.get(id);
    if (!p || !this.started) return;
    if (input.move) {
      p.move.x = clamp(input.move.x, -1, 1);
      p.move.y = clamp(input.move.y, -1, 1);
    }
    if (input.interactDown) p.interactPressed = true;
    if (input.interactUp) p.interactHeld = false;
    if (input.interactHeld !== undefined) p.interactHeld = input.interactHeld;
  }

  applyPower(id: string, channel: PowerChannel, delta: 1 | -1): void {
    const p = this.players.get(id);
    if (!p?.powerConsoleOpen || !this.started) return;
    if (delta === 1) this.power.addPip(channel);
    else this.power.removePip(channel);
  }

  setPowerConsole(id: string, open: boolean): void {
    const p = this.players.get(id);
    if (p) p.powerConsoleOpen = open;
  }

  update(dt: number): void {
    if (!this.started || !this.state.alive) return;
    this.events = [];
    this.state.elapsedMs += dt * 1000;
    this.tick++;

    this.sim.update(dt);
    this.intercom.update(dt);

    for (const p of this.players.values()) {
      this.movePlayer(p, dt);
      this.handlePlayerInteract(p, dt);
      p.interactPressed = false;
    }

    const fabOn = this.power.fabricatorsPowered();
    for (const m of this.machines) {
      m.powered = fabOn;
      this.updateMachine(m, dt);
    }

    this.updateBelts(dt);
    this.updateBreaches(dt);
    this.checkFuelStarve(dt);

    while (this.storageItems.length > this.state.storageCapacity) {
      const id = this.storageItems.pop()!;
      this.items.delete(id);
    }
    this.beltBlocked.set('incoming', this.storageItems.length >= this.state.storageCapacity);
  }

  getSnapshot(): WorldSnapshot {
    const snap: WorldSnapshot = {
      tick: this.tick,
      serverTime: Date.now(),
      ship: { ...this.state, pips: { ...this.state.pips }, demands: [...this.state.demands], upgrades: [...this.state.upgrades] },
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        x: p.x,
        y: p.y,
        ready: p.ready,
        repairing: p.repairing,
        carried: p.carried.map((id) => this.items.get(id)!.type),
        powerConsoleOpen: p.powerConsoleOpen,
      })),
      belts: [...this.beltItems.entries()].map(([id, itemIds]) => ({
        id,
        blocked: this.beltBlocked.get(id) ?? false,
        items: itemIds.map((iid) => {
          const item = this.items.get(iid)!;
          return { id: iid, type: item.type, progress: item.beltProgress };
        }),
      })),
      storage: {
        capacity: this.state.storageCapacity,
        items: this.storageItems.map((id) => ({ id, type: this.items.get(id)!.type })),
      },
      machines: this.machines.map((m) => ({
        id: m.id,
        broken: m.broken,
        crafting: m.crafting,
        progress: m.progress,
        repairProgress: m.repairProgress,
        powered: m.powered,
        inputItems: m.inputItems.map((id) => ({ id, type: this.items.get(id)!.type })),
        outputItems: m.outputItems.map((id) => ({ id, type: this.items.get(id)!.type })),
      })),
      breaches: this.breaches.map((b) => ({ ...b })),
      floorItems: [...this.items.values()]
        .filter((i) => !i.onBelt && !i.carriedBy && !this.isInStorage(i.id) && !this.isInMachine(i.id))
        .map((i) => ({ id: i.id, type: i.type, x: i.x, y: i.y })),
      asteroids: {
        ship: { ...this.sim.ship },
        bodies: this.sim.bodies.map((b) => ({ ...b })),
      },
    };

    if (this.events.length > 0) snap.events = [...this.events];

    if (!this.state.alive) {
      snap.gameOver = {
        reason: this.state.gameOverReason,
        score: this.state.score,
        wave: this.state.wave,
        survivedMs: this.state.elapsedMs,
      };
    }
    return snap;
  }

  private movePlayer(p: RoomPlayer, dt: number): void {
    if (p.powerConsoleOpen) return;
    const { x: mx, y: my } = p.move;
    if (mx === 0 && my === 0) return;
    const len = Math.hypot(mx, my) || 1;
    const mult = p.repairing ? 0.35 : p.carried.length > 0 ? 0.85 : 1;
    p.x += (mx / len) * PLAYER_SPEED * mult * dt;
    p.y += (my / len) * PLAYER_SPEED * mult * dt;
    p.x = clamp(p.x, FLOOR.left, FLOOR.right);
    p.y = clamp(p.y, FLOOR.top, FLOOR.bottom);
    this.layoutCarried(p);
  }

  private handlePlayerInteract(p: RoomPlayer, dt: number): void {
    const breach = this.nearestBreach(p.x, p.y, 45);
    const broken = this.machines.find((m) => m.broken && this.machineNear(m.id, p.x, p.y, 55));

    if (p.interactHeld && (breach || broken)) {
      p.repairing = true;
      if (breach) {
        const sizeBefore = breach.size;
        breach.size -= 28 * dt;
        if (breach.size <= 8) {
          const heal = healIntegrityFromBreach(sizeBefore);
          this.state.integrity = Math.min(this.state.maxIntegrity, this.state.integrity + heal);
          this.breaches = this.breaches.filter((b) => b.id !== breach.id);
          this.events.push(`Breach sealed! +${Math.round(heal)} hull`);
        }
      } else if (broken) {
        broken.repairProgress += dt / 1.2;
        if (broken.repairProgress >= 1) {
          broken.broken = false;
          broken.repairProgress = 0;
          broken.progress = 0;
          this.events.push(`${broken.id.replace(/_/g, ' ')} repaired`);
        }
      }
      return;
    }
    p.repairing = false;

    if (!p.interactPressed) return;

    if (dist(p.x, p.y, POWER_CONSOLE.x, POWER_CONSOLE.y) < 50) {
      p.powerConsoleOpen = true;
      return;
    }

    if (p.powerConsoleOpen) {
      p.powerConsoleOpen = false;
      return;
    }

    if (dist(p.x, p.y, UPGRADE_BAY.x, UPGRADE_BAY.y) < 55) {
      const carried = this.peekCarried(p);
      if (carried?.type === 'upgrade_module' && this.upgrades.canInstall()) {
        const effect = this.upgrades.randomEffect();
        this.dropCarried(p);
        this.upgrades.install(effect);
        this.events.push(`Installed: ${this.upgrades.labelFor(effect)}`);
        this.events.push('Upgrade installed!');
      } else if (carried?.type === 'upgrade_module') {
        this.events.push('Upgrade bay full!');
      } else {
        this.events.push('Bring an upgrade module here');
      }
      return;
    }

    if (p.carried.length > 0) {
      if (this.tryDeposit(p)) return;
      const item = this.peekCarried(p)!;
      if (item.type === 'heavy_shell' && this.nearBelt('shells', p.x, p.y, 55)) {
        this.dropCarried(p);
        this.addToBelt('shells', item.id, 0);
        this.events.push('Shell loaded → cannon');
        return;
      }
      if (item.type === 'ammo_box' && this.nearBelt('ammo', p.x, p.y, 55)) {
        this.dropCarried(p);
        this.addToBelt('ammo', item.id, 0);
        this.events.push('Ammo loaded → MG');
        return;
      }
      this.dropCarried(p);
      return;
    }

    this.tryPickup(p);
  }

  private tryDeposit(p: RoomPlayer): boolean {
    const item = this.peekCarried(p);
    if (!item) return false;

    for (const m of this.machines) {
      const pos = MACHINE_POSITIONS[m.id];
      const inX = pos.x - 52;
      const inY = pos.y + 10;
      if (dist(p.x, p.y, inX, inY) < 48 && this.canAcceptInput(m, item.type) && m.inputItems.length < 6) {
        this.dropCarried(p);
        m.inputItems.push(item.id);
        item.x = inX;
        item.y = inY;
        this.events.push(`Dropped into ${m.id.replace(/_/g, ' ')}`);
        return true;
      }
    }

    if (dist(p.x, p.y, STORAGE.x, STORAGE.y) < 55 && this.storageItems.length < this.state.storageCapacity) {
      this.dropCarried(p);
      this.storageItems.push(item.id);
      return true;
    }
    return false;
  }

  private tryPickup(p: RoomPlayer): void {
    if (p.carried.length >= 2) return;

    for (const [beltId, ids] of this.beltItems) {
      const belt = BELTS[beltId];
      for (const itemId of ids) {
        const item = this.items.get(itemId)!;
        const pt = beltPointAt(belt.points, item.beltProgress);
        if (dist(p.x, p.y, pt.x, pt.y) < 36) {
          this.removeFromBelt(beltId, itemId);
          this.pickUp(p, item);
          return;
        }
      }
    }

    if (dist(p.x, p.y, STORAGE.x, STORAGE.y) < 60 && this.storageItems.length > 0) {
      const itemId = this.storageItems.pop()!;
      const item = this.items.get(itemId)!;
      this.pickUp(p, item);
      return;
    }

    for (const m of this.machines) {
      const pos = MACHINE_POSITIONS[m.id];
      const outX = pos.x + 52;
      const outY = pos.y + 10;
      if (m.outputItems.length > 0 && dist(p.x, p.y, outX, outY) < 55) {
        const itemId = m.outputItems.pop()!;
        const item = this.items.get(itemId)!;
        this.pickUp(p, item);
        return;
      }
      const inX = pos.x - 52;
      const inY = pos.y + 10;
      if (m.inputItems.length > 0 && dist(p.x, p.y, inX, inY) < 48) {
        const itemId = m.inputItems.pop()!;
        const item = this.items.get(itemId)!;
        this.pickUp(p, item);
        return;
      }
    }

    for (const item of this.items.values()) {
      if (item.onBelt || item.carriedBy || this.isInStorage(item.id) || this.isInMachine(item.id)) continue;
      if (dist(p.x, p.y, item.x, item.y) < 32) {
        this.pickUp(p, item);
        return;
      }
    }
  }

  private updateMachine(m: MachineSimState, dt: number): void {
    const recipe = MACHINE_RECIPES[m.id];
    if (m.broken) return;

    if (!m.powered) {
      m.crafting = false;
      m.progress = 0;
      return;
    }

    if (!m.crafting) {
      const inputCount = m.inputItems.filter((id) => this.items.get(id)?.type === recipe.input).length;
      const outFull = recipe.output !== 'ship_fuel' && m.outputItems.length >= 6;
      if (inputCount >= recipe.inputCount && !outFull) {
        let left = recipe.inputCount;
        for (let i = m.inputItems.length - 1; i >= 0 && left > 0; i--) {
          if (this.items.get(m.inputItems[i])?.type === recipe.input) {
            const [removed] = m.inputItems.splice(i, 1);
            this.items.delete(removed);
            left--;
          }
        }
        m.crafting = true;
        m.progress = 0;
      }
    }

    if (m.crafting) {
      const time = recipe.craftTimeMs / this.state.craftSpeedMult;
      m.progress += (dt * 1000) / time;
      if (m.progress >= 1) {
        m.crafting = false;
        m.progress = 0;
        if (recipe.output === 'ship_fuel') {
          this.state.fuel = Math.min(this.state.maxFuel, this.state.fuel + recipe.outputCount);
          this.events.push(`+${recipe.outputCount} fuel`);
        } else {
          for (let i = 0; i < recipe.outputCount && m.outputItems.length < 6; i++) {
            const item = this.createItem(recipe.output as ItemType, MACHINE_POSITIONS[m.id].x + 52, MACHINE_POSITIONS[m.id].y + 10);
            m.outputItems.push(item.id);
          }
        }
      }
    }
  }

  private updateBelts(dt: number): void {
    for (const [beltId, ids] of this.beltItems) {
      const belt = BELTS[beltId];
      const blocked = this.beltBlocked.get(beltId) ?? false;
      const total = beltLength(belt.points);
      const finished: string[] = [];

      if (!blocked) {
        for (const itemId of ids) {
          const item = this.items.get(itemId)!;
          item.beltProgress += (belt.speed * this.state.beltSpeedMult * dt) / total;
          const pt = beltPointAt(belt.points, item.beltProgress);
          item.x = pt.x;
          item.y = pt.y;
          if (item.beltProgress >= 1) finished.push(itemId);
        }
      }

      for (const itemId of finished) {
        this.removeFromBelt(beltId, itemId);
        const item = this.items.get(itemId)!;
        if (beltId === 'incoming') {
          if (this.storageItems.length < this.state.storageCapacity) {
            this.storageItems.push(itemId);
            item.onBelt = false;
            item.beltId = null;
          } else {
            this.addToBelt('incoming', itemId, 0.85);
            this.beltBlocked.set('incoming', true);
          }
        } else if (beltId === 'shells') {
          this.state.heavyShells += 1;
          this.items.delete(itemId);
          this.events.push('+1 shell to cannon');
        } else if (beltId === 'ammo') {
          this.state.ammoBoxes += 1;
          this.items.delete(itemId);
          this.events.push('+1 ammo to MG');
        }
      }
    }
  }

  private trySpawnIncoming(type: ItemType): void {
    if (this.storageItems.length >= this.state.storageCapacity) {
      this.beltBlocked.set('incoming', true);
      return;
    }
    const belt = BELTS.incoming;
    const ids = this.beltItems.get('incoming')!;
    if (ids.length >= 12) return;
    this.beltBlocked.set('incoming', false);
    const pt = belt.points[0];
    const item = this.createItem(type, pt.x, pt.y);
    this.addToBelt('incoming', item.id, 0);
  }

  private onShipHit(damage: number, shielded: boolean): void {
    const actual = shielded ? damage * 0.35 : damage;
    this.state.integrity = Math.max(0, this.state.integrity - actual);
    this.events.push('__ship_hit__');
    if (!shielded || Math.random() < 0.45) this.spawnBreach();
    if (Math.random() < (shielded ? 0.25 : 0.55)) this.breakRandomMachine();
    if (this.state.integrity <= 0) this.triggerGameOver('Hull integrity critical. Abandon ship!');
  }

  private spawnBreach(): void {
    if (this.breaches.length >= 6) return;
    this.breaches.push({
      id: `b${this.nextBreachId++}`,
      x: between(FLOOR.left + 60, FLOOR.right - 60),
      y: between(FLOOR.top + 80, FLOOR.bottom - 40),
      size: 18,
    });
  }

  private breakRandomMachine(): void {
    const candidates = this.machines.filter((m) => !m.broken);
    if (candidates.length === 0) return;
    const m = candidates[Math.floor(Math.random() * candidates.length)];
    m.broken = true;
    m.crafting = false;
    m.progress = 0;
  }

  private updateBreaches(dt: number): void {
    let dmg = 0;
    for (const b of this.breaches) {
      b.size = Math.min(56, b.size + (6 * dt) / this.state.breachSlowMult);
      dmg += (b.size / 56) * 2.2 * dt;
    }
    if (dmg > 0) {
      this.state.integrity = Math.max(0, this.state.integrity - dmg);
      if (this.state.integrity <= 0) this.triggerGameOver('Hull breaches overwhelmed the deck.');
    }
  }

  private checkFuelStarve(dt: number): void {
    if (this.state.fuel <= 0) {
      this.fuelStarveTimer += dt;
      if (this.fuelStarveTimer > 8) {
        this.triggerGameOver('Engines starved. Ship adrift in the belt.');
      }
    } else {
      this.fuelStarveTimer = 0;
    }
  }

  private triggerGameOver(reason: string): void {
    if (!this.state.alive) return;
    this.state.alive = false;
    this.state.gameOverReason = reason;
  }

  private createItem(type: ItemType, x: number, y: number): GameItem {
    const id = `i${this.nextItemId++}`;
    const item: GameItem = { id, type, x, y, onBelt: false, beltId: null, beltProgress: 0, carriedBy: null };
    this.items.set(id, item);
    return item;
  }

  private addToBelt(beltId: string, itemId: string, progress: number): void {
    const item = this.items.get(itemId)!;
    item.onBelt = true;
    item.beltId = beltId;
    item.beltProgress = progress;
    item.carriedBy = null;
    this.beltItems.get(beltId)!.push(itemId);
    const pt = beltPointAt(BELTS[beltId].points, progress);
    item.x = pt.x;
    item.y = pt.y;
  }

  private removeFromBelt(beltId: string, itemId: string): void {
    const ids = this.beltItems.get(beltId)!;
    this.beltItems.set(beltId, ids.filter((id) => id !== itemId));
    const item = this.items.get(itemId)!;
    item.onBelt = false;
    item.beltId = null;
  }

  private pickUp(p: RoomPlayer, item: GameItem): void {
    if (p.carried.length >= 2) return;
    item.carriedBy = p.id;
    item.onBelt = false;
    p.carried.push(item.id);
    this.layoutCarried(p);
  }

  private dropCarried(p: RoomPlayer): GameItem | null {
    const itemId = p.carried.pop();
    if (!itemId) return null;
    const item = this.items.get(itemId)!;
    item.carriedBy = null;
    item.x = p.x + 24;
    item.y = p.y + 24;
    return item;
  }

  private peekCarried(p: RoomPlayer): GameItem | null {
    const id = p.carried[p.carried.length - 1];
    return id ? this.items.get(id) ?? null : null;
  }

  private layoutCarried(p: RoomPlayer): void {
    p.carried.forEach((itemId, i) => {
      const item = this.items.get(itemId)!;
      item.x = p.x + 14 + i * 8;
      item.y = p.y - 18 - i * 6;
    });
  }

  private canAcceptInput(m: MachineSimState, type: ItemType): boolean {
    const recipe = MACHINE_RECIPES[m.id];
    return recipe.input === type;
  }

  private machineNear(id: MachineId, x: number, y: number, r: number): boolean {
    const pos = MACHINE_POSITIONS[id];
    return dist(x, y, pos.x, pos.y) < r;
  }

  private nearestBreach(x: number, y: number, r: number): BreachState | null {
    let best: BreachState | null = null;
    let bestD = r;
    for (const b of this.breaches) {
      const d = dist(x, y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private nearBelt(beltId: string, x: number, y: number, r: number): boolean {
    const belt = BELTS[beltId];
    for (const pt of belt.points) {
      if (dist(x, y, pt.x, pt.y) < r) return true;
    }
    for (let t = 0; t <= 1; t += 0.1) {
      const pt = beltPointAt(belt.points, t);
      if (dist(x, y, pt.x, pt.y) < r) return true;
    }
    return false;
  }

  private isInStorage(id: string): boolean {
    return this.storageItems.includes(id);
  }

  private isInMachine(id: string): boolean {
    return this.machines.some((m) => m.inputItems.includes(id) || m.outputItems.includes(id));
  }

  private nextRole(): CrewRole {
    const roles: CrewRole[] = ['captain', 'heavy_gunner', 'mg_gunner'];
    const used = new Set([...this.players.values()].map((p) => p.role));
    return roles.find((r) => !used.has(r)) ?? 'captain';
  }
}
