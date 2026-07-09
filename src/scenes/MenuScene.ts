import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0a0e14);

    // Atmosphere
    const g = this.add.graphics();
    for (let i = 0; i < 80; i++) {
      g.fillStyle(0x334455, Phaser.Math.FloatBetween(0.2, 0.8));
      g.fillCircle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 2),
      );
    }

    this.add
      .text(width / 2, 140, 'CHAOS MANAGEMENT', {
        fontFamily: 'Courier New, monospace',
        fontSize: '42px',
        color: '#7ec8e8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 195, 'Engineering Deck', {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        color: '#ff8866',
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        280,
        "Someone else is playing the fun arcade shooter.\nYou're the poor engineer keeping their ship alive.",
        {
          fontFamily: 'Courier New, monospace',
          fontSize: '14px',
          color: '#99aabb',
          align: 'center',
          lineSpacing: 8,
        },
      )
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        370,
        '① Grab items from the incoming belt / STORAGE\n② DROP IN (green) on the matching machine\n③ TAKE OUT (orange) when done — shells/ammo go to the RIGHT belts\n④ Power console + seal breaches when the bridge screams',
        {
          fontFamily: 'Courier New, monospace',
          fontSize: '13px',
          color: '#99aabb',
          align: 'center',
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5);

    const start = this.add
      .text(width / 2, 500, '[ E / ENTER / CLICK — START ]', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#88ffaa',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tweens.add({
      targets: start,
      alpha: 0.4,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    const go = () => this.scene.start('Lobby');
    start.on('pointerdown', go);
    this.input.keyboard!.on('keydown-ENTER', go);
    this.input.keyboard!.on('keydown-E', go);
    this.input.keyboard!.on('keydown-SPACE', go);

    this.add
      .text(width / 2, 580, 'WASD move · E interact · Online: create/join a 3-player room', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#556677',
      })
      .setOrigin(0.5);
  }
}
