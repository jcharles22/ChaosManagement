import Phaser from 'phaser';
import {
  clearSession,
  createClient,
  setSession,
  type GameClient,
} from '../network/GameClient';
import type { PlayerState } from '../network/types';
import { SERVER_URL } from '../network/config';
import type { CrewRole } from '../core/types';

const ROLE_LABELS: Record<CrewRole, string> = {
  captain: 'Captain — power & repairs',
  heavy_gunner: 'Heavy Gunner — shells',
  mg_gunner: 'MG Gunner — ammo',
};

export class LobbyScene extends Phaser.Scene {
  private client!: GameClient;
  private playerId: string | null = null;
  private roomCode: string | null = null;
  private role: CrewRole | null = null;
  private players: PlayerState[] = [];
  private ready = false;
  private mode: 'menu' | 'host' | 'join' = 'menu';
  private statusText!: Phaser.GameObjects.Text;
  private playerListText!: Phaser.GameObjects.Text;
  private codeText!: Phaser.GameObjects.Text;
  private nameValue = 'Engineer';
  private joinCodeValue = '';
  private unsubMessage: (() => void) | null = null;
  private uiObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Lobby');
  }

  create(): void {
    clearSession();
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0a0e14);
    this.mode = 'menu';
    this.playerId = null;
    this.roomCode = null;
    this.role = null;
    this.players = [];
    this.ready = false;
    this.uiObjects = [];

    this.nameValue = localStorage.getItem('cm_player_name') ?? 'Engineer';
    this.joinCodeValue = '';

    this.add
      .text(width / 2, 60, 'ONLINE CREW LOBBY', {
        fontFamily: 'Courier New, monospace',
        fontSize: '28px',
        color: '#7ec8e8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(width / 2, 110, `Server: ${SERVER_URL}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#667788',
      })
      .setOrigin(0.5);

    this.codeText = this.add
      .text(width / 2, 150, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '22px',
        color: '#88ffaa',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.playerListText = this.add
      .text(width / 2, 280, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#ccddee',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    this.showMainMenu();

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.mode !== 'menu') {
        this.leaveRoom();
      } else {
        this.scene.start('Menu');
      }
    });
  }

  private showMainMenu(): void {
    this.clearUi();
    const { width } = this.scale;

    const nameLabel = this.addText(width / 2, 200, `Your name: ${this.nameValue}  (click to change)`, '#99aabb', 14);
    nameLabel.setInteractive({ useHandCursor: true });
    nameLabel.on('pointerdown', () => {
      const next = window.prompt('Enter your name:', this.nameValue);
      if (next?.trim()) {
        this.nameValue = next.trim().slice(0, 16);
        localStorage.setItem('cm_player_name', this.nameValue);
        this.showMainMenu();
      }
    });
    this.uiObjects.push(nameLabel);

    const createBtn = this.addText(width / 2, 280, '[ CREATE GAME — host a room ]', '#88ffaa', 16);
    createBtn.setInteractive({ useHandCursor: true });
    createBtn.on('pointerdown', () => this.hostGame());
    this.uiObjects.push(createBtn);

    const joinBtn = this.addText(width / 2, 330, '[ JOIN GAME — enter room code ]', '#88ccff', 16);
    joinBtn.setInteractive({ useHandCursor: true });
    joinBtn.on('pointerdown', () => this.showJoinForm());
    this.uiObjects.push(joinBtn);

    const soloBtn = this.addText(width / 2, 400, '[ SOLO — play offline ]', '#aa9988', 14);
    soloBtn.setInteractive({ useHandCursor: true });
    soloBtn.on('pointerdown', () => this.scene.start('Engineering'));
    this.uiObjects.push(soloBtn);

    const backBtn = this.addText(width / 2, 460, '[ BACK ]', '#667788', 13);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('Menu'));
    this.uiObjects.push(backBtn);

    this.addText(width / 2, 560, '2–3 players online · ESC to go back', '#556677', 11);
  }

  private showJoinForm(): void {
    this.clearUi();
    const { width } = this.scale;

    const code = window.prompt('Enter 6-character room code:', this.joinCodeValue);
    if (!code?.trim()) {
      this.showMainMenu();
      return;
    }
    this.joinCodeValue = code.trim().toUpperCase();
    this.joinGame(this.joinCodeValue);
  }

  private async hostGame(): Promise<void> {
    this.setStatus('Connecting to server...');
    try {
      this.client = createClient();
      await this.client.connect();
      this.unsubMessage = this.client.onMessage((msg) => this.onServerMessage(msg));
      this.client.createRoom(this.nameValue);
      this.mode = 'host';
    } catch (err) {
      this.setStatus(err instanceof Error ? err.message : 'Connection failed');
      this.time.delayedCall(2000, () => this.showMainMenu());
    }
  }

  private async joinGame(code: string): Promise<void> {
    this.setStatus('Connecting to server...');
    try {
      this.client = createClient();
      await this.client.connect();
      this.unsubMessage = this.client.onMessage((msg) => this.onServerMessage(msg));
      this.client.joinRoom(code, this.nameValue);
      this.mode = 'join';
    } catch (err) {
      this.setStatus(err instanceof Error ? err.message : 'Connection failed');
      this.time.delayedCall(2000, () => this.showMainMenu());
    }
  }

  private onServerMessage(msg: import('../network/types').ServerMessage): void {
    if (msg.type === 'error') {
      this.setStatus(msg.message ?? 'Error');
      this.time.delayedCall(2500, () => {
        this.leaveRoom();
        this.showMainMenu();
      });
      return;
    }

    if (msg.type === 'joined') {
      this.playerId = msg.playerId ?? null;
      this.roomCode = msg.code ?? null;
      this.role = msg.role ?? null;
      this.setStatus(`Joined as ${ROLE_LABELS[this.role!] ?? this.role}`);
      this.codeText.setText(this.roomCode ? `ROOM CODE: ${this.roomCode}` : '');
      this.showLobbyUi();
      return;
    }

    if (msg.type === 'state' && msg.players) {
      this.players = msg.players;
      this.updatePlayerList();
      return;
    }

    if (msg.type === 'player_left') {
      this.ready = false;
      this.setStatus('A player left — waiting for crew...');
      return;
    }

    if (msg.type === 'start') {
      if (!this.playerId || !this.roomCode || !this.role) return;
      setSession({
        client: this.client,
        playerId: this.playerId,
        role: this.role,
        roomCode: this.roomCode,
        players: this.players,
      });
      this.unsubMessage?.();
      this.unsubMessage = null;
      this.scene.start('Engineering', { multiplayer: true });
    }
  }

  private showLobbyUi(): void {
    this.clearUi();
    const { width } = this.scale;

    const readyBtn = this.addText(width / 2, 380, '[ READY UP ]', '#88ffaa', 18);
    readyBtn.setInteractive({ useHandCursor: true });
    readyBtn.on('pointerdown', () => {
      if (this.ready) return;
      this.ready = true;
      this.client.setReady();
      readyBtn.setText('[ WAITING FOR CREW... ]');
      readyBtn.setColor('#667788');
    });
    this.uiObjects.push(readyBtn);

    const leaveBtn = this.addText(width / 2, 440, '[ LEAVE ROOM ]', '#ff8866', 14);
    leaveBtn.setInteractive({ useHandCursor: true });
    leaveBtn.on('pointerdown', () => this.leaveRoom());
    this.uiObjects.push(leaveBtn);

    this.updatePlayerList();
    this.addText(
      width / 2,
      520,
      'Invite 1–2 friends · Everyone must ready up',
      '#778899',
      12,
    );
  }

  private updatePlayerList(): void {
    const lines = this.players.map((p) => {
      const you = p.id === this.playerId ? ' (you)' : '';
      const status = p.ready ? '✓ READY' : '… waiting';
      return `${p.name}${you} — ${ROLE_LABELS[p.role]} — ${status}`;
    });
    while (lines.length < 3) {
      lines.push('— empty slot —');
    }
    this.playerListText.setText(lines.join('\n'));
  }

  private leaveRoom(): void {
    this.unsubMessage?.();
    this.unsubMessage = null;
    this.client?.disconnect();
    this.playerId = null;
    this.roomCode = null;
    this.role = null;
    this.players = [];
    this.ready = false;
    this.mode = 'menu';
    this.codeText.setText('');
    this.playerListText.setText('');
    this.showMainMenu();
  }

  private setStatus(text: string): void {
    this.statusText.setText(text);
  }

  private addText(
    x: number,
    y: number,
    content: string,
    color: string,
    size: number,
  ): Phaser.GameObjects.Text {
    const t = this.add
      .text(x, y, content, {
        fontFamily: 'Courier New, monospace',
        fontSize: `${size}px`,
        color,
      })
      .setOrigin(0.5);
    return t;
  }

  private clearUi(): void {
    for (const obj of this.uiObjects) obj.destroy();
    this.uiObjects = [];
  }

  shutdown(): void {
    this.input.keyboard?.off('keydown-ESC');
    this.clearUi();
  }
}
