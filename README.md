# Chaos Management — Engineering Deck

Someone else is playing a fun arcade shooter. You're the poor engineer keeping their ship alive.

## Run locally (solo)

```bash
npm install
npm run dev
```

Open the URL Vite prints (default http://localhost:5173).

## Run locally (online test with friends)

**Terminal 1 — game server:**
```bash
cd server
npm install
npm run dev
```

**Terminal 2 — client:**
```bash
cp .env.example .env.local   # or create .env.local manually
npm install
npm run dev
```

Open 3 browser tabs → **Create game** in tab 1 → share the room code → **Join** from tabs 2 and 3 → all **Ready up**.

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| E | Interact (pick up, deposit, open consoles) |
| Hold E | Repair breaches / broken machines |
| 1–4 | Add power pips (engines / weapons / shields / fabricators) |
| Q / A / Z / X | Remove pips from those channels |
| Enter / Space | Start from menu |

## Online multiplayer (v1)

- Up to **3 players** per room with roles: Captain, Heavy Gunner, MG Gunner
- **Movement is synced** across all clients via the game server
- Ship systems (belts, machines, fuel) still run locally per client for now

## Deploy

### Server → Render (free)

1. Push this repo to GitHub
2. [Render](https://render.com) → **New Web Service** → connect repo
3. Settings:

| Setting | Value |
|---------|--------|
| Root directory | `server` |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Instance type | Free |

4. Note your URL: `https://your-app.onrender.com`
5. WebSocket endpoint: `wss://your-app.onrender.com/ws`

### Client → Cloudflare Pages (free)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → connect repo
2. Settings:

| Setting | Value |
|---------|--------|
| Build command | `npm install && npm run build` |
| Build output directory | `dist` |

3. **Environment variable** (Production):

```
VITE_SERVER_URL = wss://your-app.onrender.com/ws
```

4. Deploy → share your `*.pages.dev` URL with friends

> `VITE_*` variables are baked in at build time. Redeploy Pages after changing the server URL.

## Loop

- Watch the **bridge feed** (AI Asteroids). Collections spawn items on your incoming belt.
- Process fuel orbs and raw materials through fabricators.
- Send heavy shells and ammo boxes down the right-side belts to feed the guns.
- Reallocate power when the captain yells. Seal breaches when they hit rocks.
- Install upgrade modules at the upgrade bay.

Survive escalating waves. Hull zero or prolonged fuel starvation ends the shift.
