import Phaser from 'phaser';
import type { ItemEntity } from './Item';

export class Player {
  sprite: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  speed = 180;
  carried: ItemEntity[] = [];
  maxCarry = 2;
  repairing = false;
  private scene: Phaser.Scene;
  private keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    interact: Phaser.Input.Keyboard.Key;
    arrowUp: Phaser.Input.Keyboard.Key;
    arrowDown: Phaser.Input.Keyboard.Key;
    arrowLeft: Phaser.Input.Keyboard.Key;
    arrowRight: Phaser.Input.Keyboard.Key;
  };
  private facing = new Phaser.Math.Vector2(0, 1);
  private interactPressed = false;
  private holdText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.body = scene.add.rectangle(0, 0, 22, 28, 0x4ecdc4, 1);
    this.body.setStrokeStyle(2, 0xffffff);
    const helmet = scene.add.circle(0, -10, 8, 0x88e0d8);
    const visor = scene.add.rectangle(0, -10, 10, 4, 0x224466);
    this.holdText = scene.add
      .text(0, -28, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5);

    this.sprite = scene.add.container(x, y, [this.body, helmet, visor, this.holdText]);
    this.sprite.setDepth(40);

    const kb = scene.input.keyboard!;
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      interact: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      arrowUp: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      arrowDown: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      arrowLeft: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      arrowRight: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  get interactJustPressed(): boolean {
    return this.interactPressed;
  }

  get interactHeld(): boolean {
    return this.keys.interact.isDown;
  }

  getMoveInput(): { x: number; y: number } {
    const up = this.keys.up.isDown || this.keys.arrowUp.isDown;
    const down = this.keys.down.isDown || this.keys.arrowDown.isDown;
    const left = this.keys.left.isDown || this.keys.arrowLeft.isDown;
    const right = this.keys.right.isDown || this.keys.arrowRight.isDown;

    let vx = 0;
    let vy = 0;
    if (up) vy -= 1;
    if (down) vy += 1;
    if (left) vx -= 1;
    if (right) vx += 1;

    if (vx === 0 && vy === 0) return { x: 0, y: 0 };
    const len = Math.hypot(vx, vy);
    return { x: vx / len, y: vy / len };
  }

  pollInput(): void {
    this.interactPressed = Phaser.Input.Keyboard.JustDown(this.keys.interact);
  }

  update(dt: number, bounds: Phaser.Geom.Rectangle): void {
    this.pollInput();

    const { x: vx, y: vy } = this.getMoveInput();
    const moveX = vx;
    const moveY = vy;

    if (moveX !== 0 || moveY !== 0) {
      this.facing.set(moveX, moveY);
      const mult = this.repairing ? 0.35 : this.carried.length > 0 ? 0.85 : 1;
      this.sprite.x += moveX * this.speed * mult * dt;
      this.sprite.y += moveY * this.speed * mult * dt;
    }

    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, bounds.left + 16, bounds.right - 16);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, bounds.top + 16, bounds.bottom - 16);

    this.layoutCarried();
    this.holdText.setText(
      this.carried.length
        ? this.carried.map((c) => c.type.replace('_', ' ')).join(', ')
        : '',
    );
  }

  canCarry(): boolean {
    return this.carried.length < this.maxCarry;
  }

  pickUp(item: ItemEntity): boolean {
    if (!this.canCarry()) return false;
    item.carried = true;
    item.onBelt = false;
    item.sprite.setScale(0.85);
    item.sprite.setDepth(41);
    this.carried.push(item);
    this.layoutCarried();
    return true;
  }

  dropOne(): ItemEntity | null {
    const item = this.carried.pop() ?? null;
    if (item) {
      item.carried = false;
      item.sprite.setScale(1);
      item.setPosition(this.x + this.facing.x * 24, this.y + this.facing.y * 24);
    }
    this.layoutCarried();
    return item;
  }

  peek(): ItemEntity | null {
    return this.carried[this.carried.length - 1] ?? null;
  }

  private layoutCarried(): void {
    this.carried.forEach((item, i) => {
      item.setPosition(this.x + 14 + i * 8, this.y - 18 - i * 6);
    });
  }
}
