import Phaser from 'phaser';

interface GameOverData {
  reason: string;
  score: number;
  wave: number;
  survivedMs: number;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0a0e14);

    const secs = Math.floor((data.survivedMs ?? 0) / 1000);
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;

    this.add
      .text(width / 2, 160, 'SHIFT OVER', {
        fontFamily: 'Courier New, monospace',
        fontSize: '40px',
        color: '#ff6688',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 230, data.reason || 'Systems offline.', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#ccbbaa',
        align: 'center',
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        340,
        `SCORE  ${data.score ?? 0}\nWAVE   ${data.wave ?? 1}\nTIME   ${mins}m ${rem}s`,
        {
          fontFamily: 'Courier New, monospace',
          fontSize: '18px',
          color: '#88aacc',
          align: 'center',
          lineSpacing: 10,
        },
      )
      .setOrigin(0.5);

    this.add
      .text(width / 2, 460, "The bridge had fun. You had a migraine.", {
        fontFamily: 'Courier New, monospace',
        fontSize: '13px',
        color: '#778899',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    const again = this.add
      .text(width / 2, 540, '[ E / ENTER — ANOTHER SHIFT ]', {
        fontFamily: 'Courier New, monospace',
        fontSize: '15px',
        color: '#88ffaa',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const go = () => this.scene.start('Engineering');
    const menu = () => this.scene.start('Menu');
    again.on('pointerdown', go);
    this.input.keyboard!.on('keydown-ENTER', go);
    this.input.keyboard!.on('keydown-E', go);
    this.input.keyboard!.on('keydown-ESC', menu);

    this.add
      .text(width / 2, 590, 'ESC — Main menu', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#556677',
      })
      .setOrigin(0.5);
  }
}
