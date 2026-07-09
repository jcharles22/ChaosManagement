import Phaser from 'phaser';
import type { ItemEntity } from './Item';
import type { ItemType, MachineId, Recipe } from '../core/types';
import { ITEM_LABELS, MACHINE_LABELS, MACHINE_RECIPES } from '../core/types';
import { ItemEntity as ItemCtor } from './Item';

export class Chest {
  x: number;
  y: number;
  items: ItemEntity[] = [];
  capacity: number;
  accept: ItemType[] | null;
  sprite: Phaser.GameObjects.Container;
  private countText: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Rectangle;
  private tag: Phaser.GameObjects.Text;
  private acceptText: Phaser.GameObjects.Text;
  private highlight: Phaser.GameObjects.Rectangle;
  private networkCount = 0;
  kind: 'input' | 'output';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: 'input' | 'output',
    accept: ItemType[] | null,
    capacity = 6,
    acceptLabel?: string,
  ) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.accept = accept;
    this.capacity = capacity;

    this.highlight = scene.add.rectangle(0, 0, 44, 36, 0x88ffaa, 0);
    this.highlight.setStrokeStyle(2, 0x88ffaa, 0);

    this.body = scene.add.rectangle(0, 0, 40, 32, kind === 'input' ? 0x1e4a32 : 0x4a3218, 1);
    this.body.setStrokeStyle(3, kind === 'input' ? 0x55cc88 : 0xcc9955);
    this.countText = scene.add
      .text(0, 4, '0', {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.tag = scene.add
      .text(0, -22, kind === 'input' ? '▼ DROP IN' : '▲ TAKE OUT', {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: kind === 'input' ? '#66ffaa' : '#ffcc66',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.acceptText = scene.add
      .text(0, 22, acceptLabel ?? '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '8px',
        color: '#aabbcc',
        align: 'center',
        wordWrap: { width: 70 },
      })
      .setOrigin(0.5);

    this.sprite = scene.add.container(x, y, [
      this.highlight,
      this.body,
      this.countText,
      this.tag,
      this.acceptText,
    ]);
    this.sprite.setDepth(14);
  }

  get isFull(): boolean {
    return this.displayCount >= this.capacity;
  }

  get displayCount(): number {
    return this.items.length > 0 ? this.items.length : this.networkCount;
  }

  canAccept(type: ItemType): boolean {
    if (this.isFull) return false;
    if (this.accept && !this.accept.includes(type)) return false;
    return true;
  }

  setHighlighted(on: boolean): void {
    if (on) {
      this.highlight.setFillStyle(0x88ffaa, 0.25);
      this.highlight.setStrokeStyle(2, 0x88ffaa, 1);
      this.body.setStrokeStyle(3, 0xffffff);
    } else {
      this.highlight.setFillStyle(0x88ffaa, 0);
      this.highlight.setStrokeStyle(2, 0x88ffaa, 0);
      this.body.setStrokeStyle(3, this.kind === 'input' ? 0x55cc88 : 0xcc9955);
    }
  }

  setOutputReady(on: boolean): void {
    if (this.kind !== 'output') return;
    if (on) {
      this.tag.setText('▲ TAKE OUT!');
      this.tag.setColor('#ffff66');
      this.body.setStrokeStyle(3, 0xffee55);
    } else {
      this.tag.setText('▲ TAKE OUT');
      this.tag.setColor('#ffcc66');
      this.body.setStrokeStyle(3, 0xcc9955);
    }
  }

  addItem(item: ItemEntity): boolean {
    if (!this.canAccept(item.type)) return false;
    item.onBelt = false;
    item.carried = false;
    item.sprite.setVisible(false);
    this.items.push(item);
    this.refresh();
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
    item.sprite.setVisible(true);
    item.sprite.setScale(1);
    this.refresh();
    return item;
  }

  countOf(type: ItemType): number {
    return this.items.filter((i) => i.type === type).length;
  }

  consume(type: ItemType, count: number): boolean {
    if (this.countOf(type) < count) return false;
    let left = count;
    for (let i = this.items.length - 1; i >= 0 && left > 0; i--) {
      if (this.items[i].type === type) {
        this.items[i].destroy();
        this.items.splice(i, 1);
        left--;
      }
    }
    this.refresh();
    return true;
  }

  near(x: number, y: number, r = 48): boolean {
    return Phaser.Math.Distance.Between(x, y, this.x, this.y) < r;
  }

  setCount(n: number): void {
    this.networkCount = n;
    this.countText.setText(String(n));
    this.body.setFillStyle(
      n >= this.capacity ? 0x664444 : this.kind === 'input' ? 0x1e4a32 : 0x4a3218,
    );
    if (this.kind === 'output') this.setOutputReady(n > 0);
  }

  /** Sync chest contents from server snapshot (multiplayer). */
  syncNetworkItems(
    items: { id: string; type: ItemType }[],
    ensure: (id: string, type: ItemType) => ItemEntity,
  ): void {
    this.networkCount = items.length;
    this.items = items.map((entry) => {
      const item = ensure(entry.id, entry.type);
      item.onBelt = false;
      item.carried = false;
      item.sprite.setVisible(false);
      item.setPosition(this.x, this.y);
      return item;
    });
    this.countText.setText(String(items.length));
    this.body.setFillStyle(
      items.length >= this.capacity
        ? 0x664444
        : this.kind === 'input'
          ? 0x1e4a32
          : 0x4a3218,
    );
    if (this.kind === 'output') this.setOutputReady(items.length > 0);
  }

  private refresh(): void {
    this.countText.setText(String(this.items.length));
    this.body.setFillStyle(
      this.isFull
        ? 0x664444
        : this.kind === 'input'
          ? 0x1e4a32
          : 0x4a3218,
    );
    if (this.kind === 'output') {
      this.setOutputReady(this.items.length > 0);
    }
  }
}

function recipeBlurb(recipe: Recipe): string {
  const inn = ITEM_LABELS[recipe.input];
  const out =
    recipe.output === 'ship_fuel' ? 'Ship Fuel' : ITEM_LABELS[recipe.output as ItemType];
  const inCount = recipe.inputCount > 1 ? `${recipe.inputCount}x ` : '';
  return `${inCount}${inn} → ${out}`;
}

export class Machine {
  id: MachineId;
  x: number;
  y: number;
  recipe: Recipe;
  inputChest: Chest;
  outputChest: Chest;
  progress = 0;
  repairProgress = 0;
  crafting = false;
  broken = false;
  powered = true;
  sprite: Phaser.GameObjects.Container;
  private progressBar: Phaser.GameObjects.Rectangle;
  private body: Phaser.GameObjects.Rectangle;
  private statusText: Phaser.GameObjects.Text;
  private sparkTimer = 0;
  private scene: Phaser.Scene;
  private nextHint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, id: MachineId, x: number, y: number) {
    this.scene = scene;
    this.id = id;
    this.x = x;
    this.y = y;
    this.recipe = MACHINE_RECIPES[id];

    const inLabel = ITEM_LABELS[this.recipe.input];
    const outLabel =
      this.recipe.output === 'ship_fuel'
        ? 'auto → fuel tank'
        : ITEM_LABELS[this.recipe.output as ItemType];

    this.inputChest = new Chest(
      scene,
      x - 52,
      y + 10,
      'input',
      [this.recipe.input],
      6,
      inLabel,
    );
    this.outputChest = new Chest(
      scene,
      x + 52,
      y + 10,
      'output',
      this.recipe.output === 'ship_fuel' ? [] : [this.recipe.output as ItemType],
      6,
      outLabel,
    );
    if (this.recipe.output === 'ship_fuel') {
      this.outputChest.accept = null;
      this.outputChest.capacity = 0;
      this.outputChest.sprite.setVisible(false);
    }

    this.body = scene.add.rectangle(0, 0, 70, 52, 0x3a5068, 1);
    this.body.setStrokeStyle(3, 0x6a90b0);
    const title = scene.add
      .text(0, -42, MACHINE_LABELS[id], {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#d0e4f8',
        align: 'center',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const recipe = scene.add
      .text(0, -28, recipeBlurb(this.recipe), {
        fontFamily: 'Courier New, monospace',
        fontSize: '8px',
        color: '#88aacc',
        align: 'center',
      })
      .setOrigin(0.5);
    this.progressBar = scene.add.rectangle(-26, 16, 0, 6, 0x44ffaa, 1).setOrigin(0, 0.5);
    this.statusText = scene.add
      .text(0, 28, 'READY', {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#88ffaa',
      })
      .setOrigin(0.5);

    this.nextHint = scene.add
      .text(0, 42, this.destinationHint(), {
        fontFamily: 'Courier New, monospace',
        fontSize: '8px',
        color: '#ffcc88',
        align: 'center',
        wordWrap: { width: 120 },
      })
      .setOrigin(0.5);

    this.sprite = scene.add.container(x, y, [
      this.body,
      title,
      recipe,
      this.progressBar,
      this.statusText,
      this.nextHint,
    ]);
    this.sprite.setDepth(11);
  }

  private destinationHint(): string {
    switch (this.id) {
      case 'fuel_processor':
        return 'output fills FUEL bar';
      case 'ingot_fabricator':
        return 'then → Shell or Ammo fab';
      case 'shell_fabricator':
        return 'then → orange cannon belt';
      case 'ammo_fabricator':
        return 'then → yellow MG belt';
      default:
        return '';
    }
  }

  near(x: number, y: number, r = 55): boolean {
    return Phaser.Math.Distance.Between(x, y, this.x, this.y) < r;
  }

  setInputHighlight(on: boolean): void {
    this.inputChest.setHighlighted(on);
  }

  break(): void {
    this.broken = true;
    this.crafting = false;
    this.progress = 0;
    this.repairProgress = 0;
    this.progressBar.width = 0;
    this.body.setFillStyle(0x662222);
    this.body.setStrokeStyle(3, 0xff4444);
    this.statusText.setText('BROKEN');
    this.statusText.setColor('#ff6666');
  }

  repair(): void {
    this.broken = false;
    this.repairProgress = 0;
    this.progress = 0;
    this.progressBar.width = 0;
    this.body.setFillStyle(0x3a5068);
    this.body.setStrokeStyle(3, 0x6a90b0);
    this.statusText.setText('READY');
    this.statusText.setColor('#88ffaa');
  }

  tickRepair(dt: number): boolean {
    if (!this.broken) return false;
    this.repairProgress += dt / 1.2;
    this.progressBar.width = Math.min(52, this.repairProgress * 52);
    this.statusText.setText('REPAIRING');
    this.statusText.setColor('#ffcc66');
    if (this.repairProgress >= 1) {
      this.repair();
      return true;
    }
    return false;
  }

  update(
    dt: number,
    craftMult: number,
    onFuelProduced: (amount: number) => void,
  ): void {
    if (this.broken) {
      this.sparkTimer += dt;
      if (this.sparkTimer > 0.25) {
        this.sparkTimer = 0;
        this.spawnSpark();
      }
      return;
    }
    if (!this.powered) {
      this.statusText.setText('NO POWER');
      this.statusText.setColor('#ffaa44');
      this.crafting = false;
      this.progress = 0;
      this.progressBar.width = 0;
      return;
    }

    if (!this.crafting) {
      if (
        this.inputChest.countOf(this.recipe.input) >= this.recipe.inputCount &&
        (this.recipe.output === 'ship_fuel' || !this.outputChest.isFull)
      ) {
        this.inputChest.consume(this.recipe.input, this.recipe.inputCount);
        this.crafting = true;
        this.progress = 0;
        this.statusText.setText('CRAFTING');
        this.statusText.setColor('#88ccff');
      } else {
        this.statusText.setText('READY');
        this.statusText.setColor('#88ffaa');
      }
    }

    if (this.crafting) {
      const time = this.recipe.craftTimeMs / craftMult;
      this.progress += (dt * 1000) / time;
      this.progressBar.width = Math.min(52, this.progress * 52);
      if (this.progress >= 1) {
        this.crafting = false;
        this.progress = 0;
        this.progressBar.width = 0;
        if (this.recipe.output === 'ship_fuel') {
          onFuelProduced(this.recipe.outputCount);
        } else {
          for (let i = 0; i < this.recipe.outputCount; i++) {
            if (this.outputChest.isFull) break;
            const out = new ItemCtor(
              this.scene,
              this.recipe.output as ItemType,
              this.outputChest.x,
              this.outputChest.y,
            );
            this.outputChest.addItem(out);
          }
        }
        this.statusText.setText('DONE — TAKE OUT');
        this.statusText.setColor('#ffff88');
      }
    }
  }

  tickBrokenSparks(dt: number): void {
    if (!this.broken) return;
    this.sparkTimer += dt;
    if (this.sparkTimer > 0.25) {
      this.sparkTimer = 0;
      this.spawnSpark();
    }
  }

  applyNetworkState(data: {
    broken: boolean;
    crafting: boolean;
    progress: number;
    repairProgress: number;
    powered: boolean;
    inputCount: number;
    outputCount: number;
  }): void {
    this.broken = data.broken;
    this.crafting = data.crafting;
    this.progress = data.progress;
    this.repairProgress = data.repairProgress;
    this.powered = data.powered;
    this.progressBar.width = data.crafting ? Math.min(52, data.progress * 52) : 0;
    if (data.broken) {
      this.body.setFillStyle(0x662222);
      this.body.setStrokeStyle(3, 0xff4444);
      this.statusText.setText('BROKEN');
      this.statusText.setColor('#ff6666');
    } else if (!data.powered) {
      this.statusText.setText('NO POWER');
      this.statusText.setColor('#ffaa44');
    } else if (data.crafting) {
      this.statusText.setText('CRAFTING');
      this.statusText.setColor('#88ccff');
    } else if (data.outputCount > 0) {
      this.statusText.setText('DONE — TAKE OUT');
      this.statusText.setColor('#ffff88');
    } else {
      this.body.setFillStyle(0x3a5068);
      this.body.setStrokeStyle(3, 0x6a90b0);
      this.statusText.setText('READY');
      this.statusText.setColor('#88ffaa');
    }
    this.inputChest.setCount(data.inputCount);
    this.outputChest.setCount(data.outputCount);
    if (data.broken) {
      this.progressBar.width = Math.min(52, data.repairProgress * 52);
      if (data.repairProgress > 0 && data.repairProgress < 1) {
        this.statusText.setText('REPAIRING');
        this.statusText.setColor('#ffcc66');
      }
    }
  }

  private spawnSpark(): void {
    const s = this.scene.add.circle(
      this.x + Phaser.Math.Between(-20, 20),
      this.y + Phaser.Math.Between(-16, 16),
      2,
      0xffaa00,
    );
    s.setDepth(30);
    this.scene.tweens.add({
      targets: s,
      alpha: 0,
      y: s.y - 20,
      duration: 300,
      onComplete: () => s.destroy(),
    });
  }
}
