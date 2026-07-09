export type CrewRole = 'captain' | 'heavy_gunner' | 'mg_gunner';

export interface PlayerState {
  id: string;
  name: string;
  role: CrewRole;
  x: number;
  y: number;
  ready: boolean;
}

export interface ClientMessage {
  type: 'create' | 'join' | 'ready' | 'input';
  code?: string;
  name?: string;
  move?: { x: number; y: number };
}

export interface ServerMessage {
  type: 'joined' | 'error' | 'state' | 'start' | 'player_left';
  playerId?: string;
  code?: string;
  role?: CrewRole;
  message?: string;
  players?: PlayerState[];
  leftPlayerId?: string;
}
