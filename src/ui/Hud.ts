import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import { UPGRADE_DEFS } from '../core/types';

export class Hud {
  container: Phaser.GameObjects.Container;
  private integrityBar: Phaser.GameObjects.Rectangle;
  private fuelBar: Phaser.GameObjects.Rectangle;
  private statsText: Phaser.GameObjects.Text;
  private pipText: Phaser.GameObjects.Text;
  private upgradeText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private state: GameState;

  constructor(scene: Phaser.Scene, state: GameState) {
    this.state = state;

    const panel = scene.add.rectangle(0, 0, 400, 70, 0x0a1018, 0.8);
    panel.setStrokeStyle(1, 0x334455);

    const intLabel = scene.add
      .text(-185, -22, 'HULL', {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#8899aa',
      })
      .setOrigin(0, 0.5);
    const intBg = scene.add.rectangle(-100, -22, 120, 10, 0x222833).setOrigin(0, 0.5);
    this.integrityBar = scene.add.rectangle(-100, -22, 120, 10, 0x44ff88).setOrigin(0, 0.5);

    const fuelLabel = scene.add
      .text(-185, 0, 'FUEL', {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#8899aa',
      })
      .setOrigin(0, 0.5);
    const fuelBg = scene.add.rectangle(-100, 0, 120, 10, 0x222833).setOrigin(0, 0.5);
    this.fuelBar = scene.add.rectangle(-100, 0, 120, 10, 0x44aaff).setOrigin(0, 0.5);

    this.statsText = scene.add
      .text(40, -18, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#c8d8e8',
      })
      .setOrigin(0, 0.5);

    this.pipText = scene.add
      .text(40, 4, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#a0b0c0',
      })
      .setOrigin(0, 0.5);

    this.upgradeText = scene.add
      .text(-185, 22, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#ff88cc',
      })
      .setOrigin(0, 0.5);

    this.hintText = scene.add
      .text(0, 55, 'Pick up → green DROP IN → orange TAKE OUT → right belts', {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#88aa77',
      })
      .setOrigin(0.5);

    this.container = scene.add.container(1080, 50, [
      panel,
      intLabel,
      intBg,
      this.integrityBar,
      fuelLabel,
      fuelBg,
      this.fuelBar,
      this.statsText,
      this.pipText,
      this.upgradeText,
      this.hintText,
    ]);
    this.container.setDepth(150);
    this.container.setScrollFactor(0);
  }

  update(): void {
    const s = this.state;
    this.integrityBar.width = 120 * (s.integrity / s.maxIntegrity);
    this.integrityBar.setFillStyle(s.integrity < 30 ? 0xff4455 : s.integrity < 60 ? 0xffaa44 : 0x44ff88);
    this.fuelBar.width = 120 * (s.fuel / s.maxFuel);
    this.statsText.setText(
      `SHELLS ${s.heavyShells}  AMMO ${s.ammoBoxes}\nWAVE ${s.wave}  SCORE ${s.score}`,
    );
    this.pipText.setText(
      `E${s.pips.engines} W${s.pips.weapons} S${s.pips.shields} F${s.pips.fabricators}`,
    );
    const ups = s.upgrades
      .map((e) => UPGRADE_DEFS.find((d) => d.effect === e)?.label ?? e)
      .join(' · ');
    this.upgradeText.setText(ups ? `UPGRADES: ${ups}` : 'UPGRADES: (none)');
  }
}
