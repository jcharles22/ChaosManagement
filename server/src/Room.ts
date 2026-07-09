import { WebSocket } from 'ws';
import { GameWorld } from './game/GameWorld.js';
import type { ClientMessage, CrewRole, ServerMessage } from './types.js';

export class Room {
  readonly code: string;
  private world = new GameWorld();
  private sockets = new Map<string, WebSocket>();

  constructor(code: string) {
    this.code = code;
  }

  isEmpty(): boolean {
    return this.world.isEmpty();
  }

  isFull(): boolean {
    return this.world.isFull();
  }

  addPlayer(ws: WebSocket, name: string): string {
    const id = this.world.addPlayer(ws, name);
    this.sockets.set(id, ws);
    return id;
  }

  removePlayer(id: string): void {
    this.world.removePlayer(id);
    this.sockets.delete(id);
    if (this.world.isStarted()) {
      this.broadcast({ type: 'player_left', leftPlayerId: id });
    }
  }

  setReady(id: string): void {
    this.world.setReady(id);
  }

  allReady(): boolean {
    return this.world.allReady();
  }

  startGame(): void {
    this.world.start();
    this.broadcast({ type: 'start' });
  }

  isStarted(): boolean {
    return this.world.isStarted();
  }

  applyInput(id: string, msg: ClientMessage): void {
    if (msg.type === 'input') {
      this.world.applyInput(id, {
        move: msg.move,
        interactDown: msg.interactDown,
        interactUp: msg.interactUp,
        interactHeld: msg.interactHeld,
      });
    }
    if (msg.type === 'power' && msg.channel && msg.delta) {
      this.world.applyPower(id, msg.channel, msg.delta);
    }
    if (msg.type === 'power_console' && msg.open !== undefined) {
      this.world.setPowerConsole(id, msg.open);
    }
  }

  tick(dt: number): void {
    if (!this.world.isStarted()) return;
    this.world.update(dt);
    this.broadcast({ type: 'world', snapshot: this.world.getSnapshot() });
  }

  getPlayerRole(id: string): CrewRole | undefined {
    return this.world.getPlayerRole(id);
  }

  broadcastState(): void {
    if (this.world.isStarted()) {
      this.broadcast({ type: 'world', snapshot: this.world.getSnapshot() });
      return;
    }
    const snap = this.world.getSnapshot();
    this.broadcast({
      type: 'state',
      players: snap.players.map(({ id, name, role, x, y, ready }) => ({
        id,
        name,
        role,
        x,
        y,
        ready,
      })),
    });
  }

  send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.sockets.values()) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  }
}
