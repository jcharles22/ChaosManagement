import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { createInitialState, type GameState } from '../core/GameState';
import type { ItemType, MachineId } from '../core/types';
import { Player } from '../entities/Player';
import { ItemEntity } from '../entities/Item';
import { ConveyorBelt } from '../entities/ConveyorBelt';
import { StorageContainer } from '../entities/StorageContainer';
import { Machine } from '../entities/Machine';
import { PowerSystem } from '../systems/PowerSystem';
import { DamageSystem } from '../systems/DamageSystem';
import { IntercomSystem } from '../systems/IntercomSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { AsteroidsSim } from '../sim/AsteroidsSim';
import { AsteroidsView } from '../sim/AsteroidsView';
import { Hud } from '../ui/Hud';
import { IntercomUI } from '../ui/IntercomUI';
import { PowerConsoleUI } from '../ui/PowerConsoleUI';
import { sfx } from '../core/Sfx';
import { ITEM_LABELS } from '../core/types';

const ROOM = { w: 1280, h: 720 };
const FLOOR = new Phaser.Geom.Rectangle(40, 200, 1200, 480);

export class EngineeringScene extends Phaser.Scene {
  private state!: GameState;
  private player!: Player;
  private incomingBelt!: ConveyorBelt;
  private shellOutBelt!: ConveyorBelt;
  private ammoOutBelt!: ConveyorBelt;
  private storage!: StorageContainer;
  private machines: Machine[] = [];
  private power!: PowerSystem;
  private damage!: DamageSystem;
  private intercom!: IntercomSystem;
  private upgrades!: UpgradeSystem;
  private sim!: AsteroidsSim;
  private asteroidsView!: AsteroidsView;
  private hud!: Hud;
  private intercomUI!: IntercomUI;
  private powerUI!: PowerConsoleUI;
  private upgradeBay!: Phaser.GameObjects.Container;
  private upgradeBayPos = { x: 1100, y: 520 };
  private powerConsolePos = { x: 160, y: 280 };
  private unsubs: Array<() => void> = [];
  private fuelStarveTimer = 0;
  private promptText!: Phaser.GameObjects.Text;
  private outShellVisual = 0;
  private outAmmoVisual = 0;
  private worldItems: ItemEntity[] = [];
  private shellDropZone!: Phaser.GameObjects.Rectangle;
  private ammoDropZone!: Phaser.GameObjects.Rectangle;
  private flowGuide!: Phaser.GameObjects.Text;

  constructor() {
    super('Engineering');
  }

  create(): void {
    bus.clear();
    this.state = createInitialState();
    this.power = new PowerSystem(this.state);
    this.intercom = new IntercomSystem(this.state);
    this.upgrades = new UpgradeSystem(this.state);
    this.machines = [];
    this.worldItems = [];
    this.unsubs = [];
    this.fuelStarveTimer = 0;

    this.drawRoom();
    this.buildBeltsAndStorage();
    this.buildMachines();
    this.buildConsoles();

    this.damage = new DamageSystem(this, this.state, FLOOR);
    this.damage.setMachines(this.machines);

    this.sim = new AsteroidsSim(this.power, this.state, this.intercom);
    this.asteroidsView = new AsteroidsView(this, 640, 118, this.sim, this.state);

    this.player = new Player(this, 640, 420);

    this.hud = new Hud(this, this.state);
    this.intercomUI = new IntercomUI(this, this.state);
    this.powerUI = new PowerConsoleUI(
      this,
      this.powerConsolePos.x,
      this.powerConsolePos.y,
      this.state,
      this.power,
    );

    this.promptText = this.add
      .text(640, 680, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '13px',
        color: '#cceeff',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(160)
      .setScrollFactor(0);

    this.wireEvents();
    this.cameras.main.setBackgroundColor(0x0a0e14);
  }

  private drawRoom(): void {
    const g = this.add.graphics();
    g.setDepth(0);

    // Floor gradient-ish tiles
    g.fillStyle(0x1a2230, 1);
    g.fillRect(0, 0, ROOM.w, ROOM.h);

    // Wall
    g.fillStyle(0x121820, 1);
    g.fillRect(0, 0, ROOM.w, 190);
    g.fillStyle(0x1e2838, 1);
    g.fillRect(0, 180, ROOM.w, 20);

    // Floor paneling
    g.lineStyle(1, 0x2a3548, 0.5);
    for (let x = FLOOR.left; x < FLOOR.right; x += 40) {
      g.lineBetween(x, FLOOR.top, x, FLOOR.bottom);
    }
    for (let y = FLOOR.top; y < FLOOR.bottom; y += 40) {
      g.lineBetween(FLOOR.left, y, FLOOR.right, y);
    }

    // Floor fill
    g.fillStyle(0x243044, 0.35);
    g.fillRect(FLOOR.x, FLOOR.y, FLOOR.width, FLOOR.height);

    // Side walls accent
    g.fillStyle(0x152030, 1);
    g.fillRect(0, 190, 30, ROOM.h);
    g.fillRect(ROOM.w - 30, 190, 30, ROOM.h);

    this.add
      .text(640, 24, 'ENGINEERING DECK — KEEP THEIR FUN ALIVE', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#6a8aaa',
      })
      .setOrigin(0.5)
      .setDepth(2);
  }

  private buildBeltsAndStorage(): void {
    // Incoming: left wall hatch → storage
    this.incomingBelt = new ConveyorBelt(
      this,
      [
        { x: 50, y: 250 },
        { x: 200, y: 250 },
        { x: 320, y: 250 },
        { x: 400, y: 320 },
      ],
      { speed: 90, label: 'incoming' },
    );

    this.storage = new StorageContainer(this, 460, 340, this.state.storageCapacity);

    // Outgoing shell belt → right "cannon feed"
    this.shellOutBelt = new ConveyorBelt(
      this,
      [
        { x: 900, y: 300 },
        { x: 1050, y: 280 },
        { x: 1180, y: 240 },
      ],
      { speed: 100, label: 'shells', acceptTypes: ['heavy_shell'] },
    );

    this.ammoOutBelt = new ConveyorBelt(
      this,
      [
        { x: 900, y: 400 },
        { x: 1050, y: 420 },
        { x: 1180, y: 460 },
      ],
      { speed: 110, label: 'ammo', acceptTypes: ['ammo_box'] },
    );

    // Drop zones (glow when carrying matching item)
    this.shellDropZone = this.add
      .rectangle(920, 300, 70, 40, 0xff8844, 0.15)
      .setStrokeStyle(2, 0xff8844, 0.7)
      .setDepth(9);
    this.ammoDropZone = this.add
      .rectangle(920, 400, 70, 40, 0xffdd44, 0.15)
      .setStrokeStyle(2, 0xffdd44, 0.7)
      .setDepth(9);

    // Flow labels
    this.add
      .text(120, 220, '① INCOMING — grab off belt or wait for STORAGE', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#88ddff',
        fontStyle: 'bold',
        backgroundColor: '#00000099',
        padding: { x: 4, y: 2 },
      })
      .setDepth(16);

    this.add
      .text(900, 268, '③ DROP SHELLS HERE →', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#ffaa66',
        fontStyle: 'bold',
        backgroundColor: '#00000099',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(16);

    this.add
      .text(900, 368, '③ DROP AMMO HERE →', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#ffee66',
        fontStyle: 'bold',
        backgroundColor: '#00000099',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(16);

    this.add
      .text(1180, 200, 'HEAVY CANNON\n(needs shells)', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#ff8844',
        align: 'center',
        fontStyle: 'bold',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(16);
    this.add
      .text(1180, 500, 'MG FEED\n(needs ammo)', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#ffdd44',
        align: 'center',
        fontStyle: 'bold',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(16);

    this.flowGuide = this.add
      .text(
        640,
        195,
        'FLOW:  belt/storage → DROP IN machine → TAKE OUT product → shells/ammo to right belts',
        {
          fontFamily: 'Courier New, monospace',
          fontSize: '11px',
          color: '#aacc88',
          backgroundColor: '#0a1810cc',
          padding: { x: 8, y: 3 },
        },
      )
      .setOrigin(0.5)
      .setDepth(16);
  }

  private buildMachines(): void {
    const specs: { id: MachineId; x: number; y: number }[] = [
      { id: 'fuel_processor', x: 220, y: 480 },
      { id: 'ingot_fabricator', x: 420, y: 560 },
      { id: 'shell_fabricator', x: 680, y: 560 },
      { id: 'ammo_fabricator', x: 920, y: 560 },
    ];
    for (const s of specs) {
      this.machines.push(new Machine(this, s.id, s.x, s.y));
    }
  }

  private buildConsoles(): void {
    // Power console prop
    const pc = this.add.rectangle(
      this.powerConsolePos.x,
      this.powerConsolePos.y,
      50,
      40,
      0x2a4060,
    );
    pc.setStrokeStyle(3, 0x66aaff);
    this.add
      .text(this.powerConsolePos.x, this.powerConsolePos.y - 32, 'POWER', {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#88ccff',
      })
      .setOrigin(0.5)
      .setDepth(12);

    // Upgrade bay
    const ub = this.add.rectangle(
      this.upgradeBayPos.x,
      this.upgradeBayPos.y,
      60,
      48,
      0x402050,
    );
    ub.setStrokeStyle(3, 0xff66cc);
    const ubLabel = this.add
      .text(this.upgradeBayPos.x, this.upgradeBayPos.y - 36, 'UPGRADE BAY', {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#ff88cc',
      })
      .setOrigin(0.5);
    this.upgradeBay = this.add.container(0, 0, [ub, ubLabel]);
    this.upgradeBay.setDepth(12);
  }

  private wireEvents(): void {
    this.unsubs.push(
      bus.on('fuelCollected', () => {
        this.trySpawnIncoming('fuel_orb');
      }),
    );
    this.unsubs.push(
      bus.on('asteroidMined', ({ amount }) => {
        for (let i = 0; i < amount; i++) this.trySpawnIncoming('raw_chunk');
      }),
    );
    this.unsubs.push(
      bus.on('enemyDestroyed', () => {
        this.trySpawnIncoming('upgrade_module');
        this.state.score += 0; // already scored in sim
      }),
    );
    this.unsubs.push(
      bus.on('shipHit', ({ damage, shielded }) => {
        this.damage.onShipHit(damage, shielded);
        this.asteroidsView.flashHit();
        sfx.hit();
      }),
    );
    this.unsubs.push(
      bus.on('weaponFired', ({ weapon }) => {
        if (weapon === 'cannon') this.outShellVisual = 0.35;
        else this.outAmmoVisual = 0.25;
      }),
    );
    this.unsubs.push(
      bus.on('demandRaised', () => {
        this.intercomUI.ping();
        sfx.intercom();
      }),
    );
    this.unsubs.push(
      bus.on('gameOver', ({ reason, score, wave, survivedMs }) => {
        this.time.delayedCall(600, () => {
          this.scene.start('GameOver', { reason, score, wave, survivedMs });
        });
      }),
    );
    this.unsubs.push(
      bus.on('upgradeInstalled', () => {
        this.storage.setCapacity(this.state.storageCapacity);
        this.showToast(`Upgrade installed!`);
      }),
    );
    this.unsubs.push(
      bus.on('waveAdvanced', ({ wave }) => {
        this.state.score += wave * 25;
        this.showToast(`Wave ${wave} — bridge is escalating`);
        if (wave === 5) this.showToast('Shift milestone: still employed!');
        if (wave === 8) this.showToast('Heroic overtime. Captain still yelling.');
      }),
    );
  }

  private trySpawnIncoming(type: ItemType): void {
    if (this.storage.isFull) {
      this.incomingBelt.blocked = true;
      return;
    }
    if (!this.incomingBelt.canAccept(type)) return;
    this.incomingBelt.blocked = false;
    const item = new ItemEntity(this, type, this.incomingBelt.points[0].x, this.incomingBelt.points[0].y);
    this.incomingBelt.addItem(item, 0);
    this.worldItems.push(item);
    bus.emit('itemSpawned', { type });
  }

  update(_time: number, delta: number): void {
    if (!this.state.alive) return;
    const dt = Math.min(0.05, delta / 1000);
    this.state.elapsedMs += delta;

    // Systems
    this.sim.update(dt);
    this.asteroidsView.update(dt);
    this.intercom.update(dt);
    this.intercomUI.update(dt);
    this.damage.update(dt);
    this.hud.update();

    // Power → machines
    const fabOn = this.power.fabricatorsPowered();
    for (const m of this.machines) {
      m.powered = fabOn;
      m.update(dt, this.state.craftSpeedMult, (amt) => {
        this.state.fuel = Math.min(this.state.maxFuel, this.state.fuel + amt);
        this.showToast(`+${amt} fuel`);
      });
    }

    // Belts
    this.updateBelts(dt);

    // Player
    if (this.powerUI.visible) {
      this.powerUI.handleKeys();
      if (this.player.interactJustPressed) this.powerUI.close();
    } else {
      this.player.update(dt, FLOOR);
      this.handleInteract(dt);
    }

    this.updatePrompt();
    this.updateCarryHighlights();
    this.checkFuelStarve(dt);
    this.animateOutBelts(dt);

    // Sync storage capacity from upgrades
    if (this.storage.capacity !== this.state.storageCapacity) {
      this.storage.setCapacity(this.state.storageCapacity);
    }
    this.incomingBelt.blocked = this.storage.isFull;
  }

  private updateBelts(dt: number): void {
    const finished = this.incomingBelt.update(dt, this.state.beltSpeedMult);
    for (const item of finished) {
      this.incomingBelt.removeItem(item);
      if (!this.storage.addItem(item)) {
        // Bounce back slightly
        this.incomingBelt.addItem(item, 0.85);
        this.incomingBelt.blocked = true;
      }
    }

    for (const item of this.shellOutBelt.update(dt, this.state.beltSpeedMult)) {
      this.shellOutBelt.removeItem(item);
      this.state.heavyShells += 1;
      this.removeWorldItem(item);
      item.destroy();
      this.showToast('+1 shell to cannon');
    }

    for (const item of this.ammoOutBelt.update(dt, this.state.beltSpeedMult)) {
      this.ammoOutBelt.removeItem(item);
      this.state.ammoBoxes += 1;
      this.removeWorldItem(item);
      item.destroy();
      this.showToast('+1 ammo to MG');
    }
  }

  private animateOutBelts(dt: number): void {
    if (this.outShellVisual > 0) {
      this.outShellVisual -= dt;
      this.shellOutBelt.blocked = false;
    }
    if (this.outAmmoVisual > 0) {
      this.outAmmoVisual -= dt;
    }
  }

  private handleInteract(dt: number): void {
    const p = this.player;

    // Hold E to repair
    const breach = this.damage.nearestBreach(p.x, p.y, 45);
    const broken = this.machines.find((m) => m.broken && m.near(p.x, p.y, 55));
    if (p.interactHeld && (breach || broken)) {
      p.repairing = true;
      if (breach) {
        if (breach.repair(28 * dt)) {
          this.showToast('Breach sealed!');
          sfx.repair();
        }
      } else if (broken) {
        if (broken.tickRepair(dt)) {
          bus.emit('machineRepaired', { id: broken.id });
          this.showToast(`${broken.id.replace(/_/g, ' ')} repaired`);
          sfx.repair();
        }
      }
      return;
    }
    p.repairing = false;

    if (!p.interactJustPressed) return;

    // Power console
    if (this.powerUI.near(p.x, p.y)) {
      this.powerUI.open();
      return;
    }

    // Upgrade bay — install carried upgrade module
    if (
      Phaser.Math.Distance.Between(p.x, p.y, this.upgradeBayPos.x, this.upgradeBayPos.y) < 55
    ) {
      const carried = p.peek();
      if (carried?.type === 'upgrade_module') {
        if (!this.upgrades.canInstall()) {
          this.showToast('Upgrade bay full!');
          return;
        }
        const effect = this.upgrades.randomEffect();
        const item = p.dropOne();
        if (item) {
          this.removeWorldItem(item);
          item.destroy();
          this.upgrades.install(effect);
          this.showToast(`Installed: ${this.upgrades.labelFor(effect)}`);
        }
      } else {
        this.showToast('Bring an upgrade module here');
      }
      return;
    }

    // If carrying — try deposit
    if (p.carried.length > 0) {
      if (this.tryDeposit(p)) return;
      // Drop on nearby out belt
      const item = p.peek()!;
      if (item.type === 'heavy_shell' && this.nearBelt(this.shellOutBelt, p.x, p.y, 55)) {
        const dropped = p.dropOne()!;
        this.shellOutBelt.addItem(dropped, 0);
        sfx.deposit();
        this.showToast('Shell loaded → cannon');
        return;
      }
      if (item.type === 'ammo_box' && this.nearBelt(this.ammoOutBelt, p.x, p.y, 55)) {
        const dropped = p.dropOne()!;
        this.ammoOutBelt.addItem(dropped, 0);
        sfx.deposit();
        this.showToast('Ammo loaded → MG');
        return;
      }
      // Drop on floor
      p.dropOne();
      return;
    }

    // Pick up
    this.tryPickup(p);
  }

  private tryDeposit(p: Player): boolean {
    const item = p.peek();
    if (!item) return false;

    // Machine input chests
    for (const m of this.machines) {
      if (m.inputChest.near(p.x, p.y) && m.inputChest.canAccept(item.type)) {
        const dropped = p.dropOne()!;
        m.inputChest.addItem(dropped);
        sfx.deposit();
        this.showToast(`Dropped into ${m.id.replace(/_/g, ' ')}`);
        return true;
      }
    }

    // Storage
    if (this.storage.containsPoint(p.x, p.y) && this.storage.canAccept(item.type)) {
      const dropped = p.dropOne()!;
      this.storage.addItem(dropped);
      return true;
    }

    return false;
  }

  private tryPickup(p: Player): void {
    // Belts
    for (const belt of [this.incomingBelt, this.shellOutBelt, this.ammoOutBelt]) {
      const item = belt.nearestItem(p.x, p.y, 36);
      if (item && p.canCarry()) {
        belt.removeItem(item);
        p.pickUp(item);
        sfx.pickup();
        return;
      }
    }

    // Storage
    const fromStorage = this.storage.takeNearest(p.x, p.y, 40);
    if (fromStorage && p.canCarry()) {
      fromStorage.sprite.setVisible(true);
      fromStorage.sprite.setScale(1);
      p.pickUp(fromStorage);
      return;
    }

    // Machine output chests
    for (const m of this.machines) {
      if (m.outputChest.near(p.x, p.y) && m.outputChest.items.length > 0 && p.canCarry()) {
        const item = m.outputChest.takeItem();
        if (item) {
          p.pickUp(item);
          return;
        }
      }
      // Also allow taking from input (rework)
      if (m.inputChest.near(p.x, p.y) && m.inputChest.items.length > 0 && p.canCarry()) {
        const item = m.inputChest.takeItem();
        if (item) {
          p.pickUp(item);
          return;
        }
      }
    }

    // Floor items
    for (const item of this.worldItems) {
      if (item.carried || item.onBelt) continue;
      if (Phaser.Math.Distance.Between(p.x, p.y, item.sprite.x, item.sprite.y) < 32 && p.canCarry()) {
        p.pickUp(item);
        return;
      }
    }
  }

  private nearBelt(belt: ConveyorBelt, x: number, y: number, r: number): boolean {
    for (const pt of belt.points) {
      if (Phaser.Math.Distance.Between(x, y, pt.x, pt.y) < r) return true;
    }
    // Also check along path
    for (let t = 0; t <= 1; t += 0.1) {
      const pt = belt.pointAt(t);
      if (Phaser.Math.Distance.Between(x, y, pt.x, pt.y) < r) return true;
    }
    return false;
  }

  private updateCarryHighlights(): void {
    const carried = this.player.peek();
    const type = carried?.type;

    for (const m of this.machines) {
      m.setInputHighlight(!!type && m.inputChest.canAccept(type));
    }
    this.storage.setHighlighted(!!type && this.storage.canAccept(type));

    const shellOn = type === 'heavy_shell';
    const ammoOn = type === 'ammo_box';
    this.shellDropZone.setFillStyle(0xff8844, shellOn ? 0.45 : 0.12);
    this.shellDropZone.setStrokeStyle(2, 0xff8844, shellOn ? 1 : 0.5);
    this.ammoDropZone.setFillStyle(0xffdd44, ammoOn ? 0.45 : 0.12);
    this.ammoDropZone.setStrokeStyle(2, 0xffdd44, ammoOn ? 1 : 0.5);

    if (shellOn) {
      this.shellDropZone.setScale(1 + Math.sin(this.time.now / 200) * 0.06);
    } else {
      this.shellDropZone.setScale(1);
    }
    if (ammoOn) {
      this.ammoDropZone.setScale(1 + Math.sin(this.time.now / 200) * 0.06);
    } else {
      this.ammoDropZone.setScale(1);
    }
  }

  private updatePrompt(): void {
    if (this.powerUI.visible) {
      this.promptText.setText('POWER CONSOLE — 1-4 add pips, Q/A/Z/X remove, E close');
      return;
    }
    const p = this.player;
    const carried = p.peek();

    if (this.powerUI.near(p.x, p.y)) {
      this.promptText.setText('E — Open Power Console');
      return;
    }
    if (Phaser.Math.Distance.Between(p.x, p.y, this.upgradeBayPos.x, this.upgradeBayPos.y) < 55) {
      this.promptText.setText(
        carried?.type === 'upgrade_module'
          ? 'E — Install upgrade module'
          : 'Bring a pink Upgrade Module here',
      );
      return;
    }
    if (this.damage.nearestBreach(p.x, p.y, 45)) {
      this.promptText.setText('Hold E — Seal hull breach');
      return;
    }
    if (this.machines.some((m) => m.broken && m.near(p.x, p.y, 55))) {
      this.promptText.setText('Hold E — Repair machine');
      return;
    }

    if (carried) {
      const label = ITEM_LABELS[carried.type];
      // Near a valid machine input?
      for (const m of this.machines) {
        if (m.inputChest.near(p.x, p.y) && m.inputChest.canAccept(carried.type)) {
          this.promptText.setText(`E — Drop ${label} into ${m.id.replace(/_/g, ' ')} IN`);
          return;
        }
        if (m.inputChest.near(p.x, p.y) && !m.inputChest.canAccept(carried.type)) {
          this.promptText.setText(
            `Wrong item — this IN wants ${ITEM_LABELS[m.recipe.input]}`,
          );
          return;
        }
      }
      if (carried.type === 'heavy_shell' && this.nearBelt(this.shellOutBelt, p.x, p.y, 50)) {
        this.promptText.setText('E — Load shell onto cannon belt');
        return;
      }
      if (carried.type === 'ammo_box' && this.nearBelt(this.ammoOutBelt, p.x, p.y, 50)) {
        this.promptText.setText('E — Load ammo onto MG belt');
        return;
      }
      if (carried.type === 'heavy_shell') {
        this.promptText.setText(`Carrying ${label} — walk to orange DROP SHELLS zone (right)`);
        return;
      }
      if (carried.type === 'ammo_box') {
        this.promptText.setText(`Carrying ${label} — walk to yellow DROP AMMO zone (right)`);
        return;
      }
      if (carried.type === 'upgrade_module') {
        this.promptText.setText(`Carrying ${label} — take it to UPGRADE BAY (far right)`);
        return;
      }
      if (carried.type === 'fuel_orb') {
        this.promptText.setText(`Carrying ${label} — drop in Fuel Processor IN (green)`);
        return;
      }
      if (carried.type === 'raw_chunk') {
        this.promptText.setText(`Carrying ${label} — drop in Ingot Fabricator IN (green)`);
        return;
      }
      if (carried.type === 'ingot') {
        this.promptText.setText(
          `Carrying ${label} — drop in Shell Fab (2x) or Ammo Fab IN`,
        );
        return;
      }
      this.promptText.setText(`Carrying ${label} — stand on green DROP IN and press E`);
      return;
    }

    // Not carrying — suggest pickups
    for (const m of this.machines) {
      if (m.outputChest.items.length > 0 && m.outputChest.near(p.x, p.y, 55)) {
        const out = m.recipe.output === 'ship_fuel' ? 'fuel' : ITEM_LABELS[m.recipe.output as ItemType];
        this.promptText.setText(`E — TAKE OUT ${out} (then deliver it)`);
        return;
      }
    }
    if (this.storage.containsPoint(p.x, p.y, 55) && this.storage.items.length > 0) {
      this.promptText.setText('E — TAKE from STORAGE, then drop into a machine IN');
      return;
    }
    if (this.incomingBelt.nearestItem(p.x, p.y, 40)) {
      this.promptText.setText('E — Pick up from incoming belt');
      return;
    }
    this.promptText.setText(
      'Pick up from belt/STORAGE → DROP IN (green) → TAKE OUT (orange) → feed right belts',
    );
  }

  private checkFuelStarve(dt: number): void {
    if (this.state.fuel <= 0) {
      this.fuelStarveTimer += dt;
      if (this.fuelStarveTimer > 8) {
        this.state.alive = false;
        this.state.gameOverReason = 'Engines starved. Ship adrift in the belt.';
        bus.emit('gameOver', {
          reason: this.state.gameOverReason,
          score: this.state.score,
          wave: this.state.wave,
          survivedMs: this.state.elapsedMs,
        });
      }
    } else {
      this.fuelStarveTimer = 0;
    }
  }

  private removeWorldItem(item: ItemEntity): void {
    this.worldItems = this.worldItems.filter((i) => i !== item);
  }

  private showToast(msg: string): void {
    const t = this.add
      .text(this.player.x, this.player.y - 40, msg, {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(100);
    this.tweens.add({
      targets: t,
      y: t.y - 30,
      alpha: 0,
      duration: 900,
      onComplete: () => t.destroy(),
    });
  }

  shutdown(): void {
    for (const u of this.unsubs) u();
    bus.clear();
  }
}
