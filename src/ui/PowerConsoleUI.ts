import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import type { PowerSystem } from '../systems/PowerSystem';
import type { PowerChannel } from '../core/types';
import { freePips } from '../core/GameState';

const CHANNELS: { key: PowerChannel; label: string; color: number }[] = [
  { key: 'engines', label: 'ENG', color: 0x44aaff },
  { key: 'weapons', label: 'WPN', color: 0xff6644 },
  { key: 'shields', label: 'SHD', color: 0x44ffaa },
  { key: 'fabricators', label: 'FAB', color: 0xffaa44 },
];

export class PowerConsoleUI {
  container: Phaser.GameObjects.Container;
  visible = false;
  x: number;
  y: number;
  private state: GameState;
  private power: PowerSystem;
  private pipTexts: Phaser.GameObjects.Text[] = [];
  private freeText: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};

  constructor(scene: Phaser.Scene, x: number, y: number, state: GameState, power: PowerSystem) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.state = state;
    this.power = power;

    const panel = scene.add.rectangle(0, 0, 220, 200, 0x121820, 0.95);
    panel.setStrokeStyle(2, 0x6a90b0);
    const title = scene.add
      .text(0, -85, 'POWER ALLOCATION', {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: '#a8d4ff',
      })
      .setOrigin(0.5);
    const hint = scene.add
      .text(0, 85, '1-4 add  |  Q/A/Z/X remove  |  E close', {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#667788',
      })
      .setOrigin(0.5);

    this.freeText = scene.add
      .text(0, -65, 'Free: 0', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#88ffaa',
      })
      .setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [panel, title, hint, this.freeText];
    CHANNELS.forEach((ch, i) => {
      const ty = -35 + i * 28;
      const label = scene.add
        .text(-90, ty, ch.label, {
          fontFamily: 'Courier New, monospace',
          fontSize: '12px',
          color: '#ccddee',
        })
        .setOrigin(0, 0.5);
      const barBg = scene.add.rectangle(20, ty, 100, 12, 0x222833);
      const pipText = scene.add
        .text(90, ty, '0', {
          fontFamily: 'Courier New, monospace',
          fontSize: '12px',
          color: '#ffffff',
        })
        .setOrigin(0, 0.5);
      this.pipTexts.push(pipText);
      children.push(label, barBg, pipText);
    });

    this.container = scene.add.container(640, 360, children);
    this.container.setDepth(200);
    this.container.setVisible(false);

    const kb = scene.input.keyboard!;
    for (const code of ['ONE', 'TWO', 'THREE', 'FOUR', 'Q', 'A', 'Z', 'X']) {
      this.keys[code] = kb.addKey(code);
    }
  }

  open(): void {
    this.visible = true;
    this.container.setVisible(true);
    this.refresh();
  }

  close(): void {
    this.visible = false;
    this.container.setVisible(false);
  }

  toggle(): void {
    if (this.visible) this.close();
    else this.open();
  }

  near(px: number, py: number, r = 50): boolean {
    return Phaser.Math.Distance.Between(px, py, this.x, this.y) < r;
  }

  handleKeys(): void {
    if (!this.visible) return;
    const just = Phaser.Input.Keyboard.JustDown;

    if (just(this.keys.ONE)) this.power.addPip('engines');
    if (just(this.keys.TWO)) this.power.addPip('weapons');
    if (just(this.keys.THREE)) this.power.addPip('shields');
    if (just(this.keys.FOUR)) this.power.addPip('fabricators');
    if (just(this.keys.Q)) this.power.removePip('engines');
    if (just(this.keys.A)) this.power.removePip('weapons');
    if (just(this.keys.Z)) this.power.removePip('shields');
    if (just(this.keys.X)) this.power.removePip('fabricators');

    this.refresh();
  }

  refresh(): void {
    this.freeText.setText(`Free pips: ${freePips(this.state)} / Total ${this.state.totalPips}`);
    CHANNELS.forEach((ch, i) => {
      const n = this.state.pips[ch.key];
      this.pipTexts[i].setText('●'.repeat(n) + '○'.repeat(Math.max(0, 5 - n)) + ` ${n}`);
      this.pipTexts[i].setColor(Phaser.Display.Color.IntegerToColor(ch.color).rgba);
    });
  }
}
