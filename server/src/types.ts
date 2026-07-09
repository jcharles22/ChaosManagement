import type {
  CrewRole,
  ItemType,
  MachineId,
  PowerChannel,
} from './game/gameTypes.js';
import type { GameState } from './game/gameTypes.js';

export type { CrewRole, ItemType, MachineId, PowerChannel };

export interface PlayerState {
  id: string;
  name: string;
  role: CrewRole;
  x: number;
  y: number;
  ready: boolean;
  repairing?: boolean;
  carried?: ItemType[];
  powerConsoleOpen?: boolean;
}

export interface SimBodyNet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 'asteroid' | 'enemy' | 'fuel' | 'bullet';
  hp: number;
  size?: number;
  weapon?: 'cannon' | 'mg';
  life?: number;
}

export interface ShipStateNet {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  alive: boolean;
}

export interface WorldSnapshot {
  tick: number;
  serverTime: number;
  ship: GameState;
  players: PlayerState[];
  belts: {
    id: string;
    blocked: boolean;
    items: { id: string; type: ItemType; progress: number }[];
  }[];
  storage: { capacity: number; items: { id: string; type: ItemType }[] };
  machines: {
    id: MachineId;
    broken: boolean;
    crafting: boolean;
    progress: number;
    repairProgress: number;
    powered: boolean;
    inputItems: { id: string; type: ItemType }[];
    outputItems: { id: string; type: ItemType }[];
  }[];
  breaches: { id: string; x: number; y: number; size: number }[];
  floorItems: { id: string; type: ItemType; x: number; y: number }[];
  asteroids: { ship: ShipStateNet; bodies: SimBodyNet[] };
  gameOver?: { reason: string; score: number; wave: number; survivedMs: number };
  events?: string[];
}

export interface ClientMessage {
  type: 'create' | 'join' | 'ready' | 'input' | 'power' | 'power_console';
  code?: string;
  name?: string;
  move?: { x: number; y: number };
  interactDown?: boolean;
  interactUp?: boolean;
  interactHeld?: boolean;
  channel?: PowerChannel;
  delta?: 1 | -1;
  open?: boolean;
}

export interface ServerMessage {
  type: 'joined' | 'error' | 'state' | 'start' | 'player_left' | 'world';
  playerId?: string;
  code?: string;
  role?: CrewRole;
  message?: string;
  players?: PlayerState[];
  leftPlayerId?: string;
  snapshot?: WorldSnapshot;
}
