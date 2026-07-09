import { WebSocket } from 'ws';
import type { ClientMessage, CrewRole, PlayerState, ServerMessage } from './types.js';

const ROLES: CrewRole[] = ['captain', 'heavy_gunner', 'mg_gunner'];
const SPAWNS = [
  { x: 500, y: 420 },
  { x: 640, y: 420 },
  { x: 780, y: 420 },
];
const FLOOR = { left: 56, right: 1224, top: 216, bottom: 664 };
const SPEED = 180;
const TICK_DT = 1 / 20;

interface RoomPlayer {
  id: string;
  name: string;
  role: CrewRole;
  x: number;
  y: number;
  ready: boolean;
  ws: WebSocket;
  move: { x: number; y: number };
}

export class Room {
  readonly code: string;
  private players = new Map<string, RoomPlayer>();
  started = false;

  constructor(code: string) {
    this.code = code;
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  isFull(): boolean {
    return this.players.size >= 3;
  }

  addPlayer(ws: WebSocket, name: string): string {
    const id = crypto.randomUUID();
    const role = this.nextRole();
    const spawn = SPAWNS[this.players.size] ?? SPAWNS[0];
    this.players.set(id, {
      id,
      name: name.slice(0, 16) || 'Engineer',
      role,
      x: spawn.x,
      y: spawn.y,
      ready: false,
      ws,
      move: { x: 0, y: 0 },
    });
    this.broadcastState();
    return id;
  }

  removePlayer(id: string): void {
    if (!this.players.delete(id)) return;
    this.started = false;
    for (const p of this.players.values()) {
      p.ready = false;
    }
    this.broadcast({ type: 'player_left', leftPlayerId: id });
    this.broadcastState();
  }

  setReady(id: string): void {
    const p = this.players.get(id);
    if (!p) return;
    p.ready = true;
    this.broadcastState();
  }

  allReady(): boolean {
    return this.players.size === 3 && [...this.players.values()].every((p) => p.ready);
  }

  startGame(): void {
    this.started = true;
    this.broadcast({ type: 'start' });
  }

  applyInput(id: string, msg: ClientMessage): void {
    const p = this.players.get(id);
    if (!p || !this.started) return;
    if (msg.move) {
      p.move.x = clamp(msg.move.x, -1, 1);
      p.move.y = clamp(msg.move.y, -1, 1);
    }
  }

  tick(): void {
    if (!this.started) return;
    for (const p of this.players.values()) {
      const { x: mx, y: my } = p.move;
      if (mx === 0 && my === 0) continue;
      const len = Math.hypot(mx, my) || 1;
      p.x += (mx / len) * SPEED * TICK_DT;
      p.y += (my / len) * SPEED * TICK_DT;
      p.x = clamp(p.x, FLOOR.left, FLOOR.right);
      p.y = clamp(p.y, FLOOR.top, FLOOR.bottom);
    }
    this.broadcastState();
  }

  getPlayerState(): PlayerState[] {
    return [...this.players.values()].map(({ id, name, role, x, y, ready }) => ({
      id,
      name,
      role,
      x,
      y,
      ready,
    }));
  }

  private nextRole(): CrewRole {
    const used = new Set([...this.players.values()].map((p) => p.role));
    return ROLES.find((r) => !used.has(r)) ?? 'captain';
  }

  private broadcastState(): void {
    this.broadcast({ type: 'state', players: this.getPlayerState() });
  }

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(data);
      }
    }
  }

  send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
