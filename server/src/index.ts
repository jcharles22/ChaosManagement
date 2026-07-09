import http from 'http';
import { WebSocketServer } from 'ws';
import { Room } from './Room.js';
import type { ClientMessage } from './types.js';

const PORT = Number(process.env.PORT) || 3001;
const rooms = new Map<string, Room>();

const server = http.createServer((_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  });
  res.end('Chaos Management game server — connect via WebSocket at /ws');
});

const wss = new WebSocketServer({ server, path: '/ws' });

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getOrCreateRoom(code: string): Room {
  let room = rooms.get(code);
  if (!room) {
    room = new Room(code);
    rooms.set(code, room);
  }
  return room;
}

function cleanupRoom(code: string): void {
  const room = rooms.get(code);
  if (room?.isEmpty()) rooms.delete(code);
}

wss.on('connection', (ws) => {
  let room: Room | null = null;
  let playerId: string | null = null;
  let roomCode: string | null = null;

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return;
    }

    if (msg.type === 'create') {
      let code = generateCode();
      while (rooms.has(code)) code = generateCode();
      room = getOrCreateRoom(code);
      roomCode = code;
      playerId = room.addPlayer(ws, msg.name ?? 'Captain');
      room.send(ws, {
        type: 'joined',
        playerId: playerId!,
        code,
        role: room.getPlayerRole(playerId!),
      });
      room.broadcastState();
      return;
    }

    if (msg.type === 'join') {
      const code = (msg.code ?? '').toUpperCase().trim();
      room = rooms.get(code) ?? null;
      if (!room || room.isFull()) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: room ? 'Room is full (3/3)' : 'Room not found',
          }),
        );
        return;
      }
      if (room.isStarted()) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game already in progress' }));
        return;
      }
      roomCode = code;
      playerId = room.addPlayer(ws, msg.name ?? 'Engineer');
      room.send(ws, {
        type: 'joined',
        playerId: playerId!,
        code,
        role: room.getPlayerRole(playerId!),
      });
      room.broadcastState();
      return;
    }

    if (!room || !playerId) return;

    if (msg.type === 'ready') {
      room.setReady(playerId);
      room.broadcastState();
      if (room.allReady()) room.startGame();
      return;
    }

    if (msg.type === 'input' || msg.type === 'power' || msg.type === 'power_console') {
      room.applyInput(playerId, msg);
    }
  });

  ws.on('close', () => {
    if (room && playerId) {
      room.removePlayer(playerId);
      room.broadcastState();
      if (roomCode) cleanupRoom(roomCode);
    }
  });
});

setInterval(() => {
  for (const room of rooms.values()) room.tick(1 / 30);
}, 33);

server.listen(PORT, () => {
  console.log(`Chaos Management server listening on port ${PORT}`);
});
