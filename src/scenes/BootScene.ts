import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0e14);
    const t = this.add
      .text(640, 360, 'SPINNING UP REACTOR…', {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        color: '#6a9abb',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: t,
      alpha: 0.3,
      duration: 400,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.scene.start('Menu'),
    });
  }
}
