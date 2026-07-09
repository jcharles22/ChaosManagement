import type { PowerChannel } from '../core/types';
import { SERVER_URL } from './config';
import type { ClientMessage, PlayerState, ServerMessage } from './types';

type MessageHandler = (msg: ServerMessage) => void;

export class GameClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private _connected = false;

  get connected(): boolean {
    return this._connected;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const ws = new WebSocket(SERVER_URL);
      this.ws = ws;

      ws.onopen = () => {
        this._connected = true;
        resolve();
      };

      ws.onerror = () => {
        reject(new Error(`Could not connect to ${SERVER_URL}`));
      };

      ws.onclose = () => {
        this._connected = false;
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as ServerMessage;
          for (const h of this.handlers) h(msg);
        } catch {
          // ignore malformed messages
        }
      };
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  createRoom(name: string): void {
    this.send({ type: 'create', name });
  }

  joinRoom(code: string, name: string): void {
    this.send({ type: 'join', code: code.toUpperCase().trim(), name });
  }

  setReady(): void {
    this.send({ type: 'ready' });
  }

  sendInput(input: {
    move: { x: number; y: number };
    interactDown?: boolean;
    interactUp?: boolean;
    interactHeld?: boolean;
  }): void {
    this.send({ type: 'input', ...input });
  }

  sendPower(channel: PowerChannel, delta: 1 | -1): void {
    this.send({ type: 'power', channel, delta });
  }

  setPowerConsole(open: boolean): void {
    this.send({ type: 'power_console', open });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this._connected = false;
    this.handlers.clear();
  }
}

export interface MultiplayerSession {
  client: GameClient;
  playerId: string;
  role: import('../core/types').CrewRole;
  roomCode: string;
  players: PlayerState[];
}

let session: MultiplayerSession | null = null;

export function setSession(s: MultiplayerSession): void {
  session = s;
}

export function getSession(): MultiplayerSession | null {
  return session;
}

export function clearSession(): void {
  session?.client.disconnect();
  session = null;
}

export function createClient(): GameClient {
  return new GameClient();
}
