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

## Online multiplayer

- Up to **3 players** per room with roles: Captain, Heavy Gunner, MG Gunner
- **Server-authoritative** — one shared ship simulation runs on your game server; all clients see the same fuel, hull, belts, machines, breaches, and bridge feed
- Clients send movement + interact input (~20×/sec); server broadcasts world state at 20 Hz with WebSocket compression

## Deploy

### Server → Oracle Cloud (free, always-on) — recommended

The repo includes a GitHub Action that deploys to an Oracle Always Free VM on every push to `main` (when `server/` changes).

**One-time VM setup** (Ubuntu):

```bash
# Node 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git

# Clone and build
git clone https://github.com/jcharles22/ChaosManagement.git ~/ChaosManagement
cd ~/ChaosManagement/server && npm ci && npm run build

# Install systemd service (edit User/WorkingDirectory if not ubuntu)
sudo cp ~/ChaosManagement/scripts/chaos-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now chaos-server

# Optional: nginx WebSocket proxy (see scripts/nginx-ws.example.conf)
sudo certbot --nginx -d game.yourdomain.com   # for wss://
```

**GitHub secrets** for auto-deploy: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`

WebSocket endpoint: `wss://game.yourdomain.com/ws` (or your VM IP if not using nginx)

### Server → Render (alternative)

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

> Render free tier sleeps when idle — Oracle Always Free is better for low-latency multiplayer.

### Client → Cloudflare Pages (free)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → connect repo
2. Settings:

| Setting | Value |
|---------|--------|
| Build command | `npm install && npm run build` |
| Build output directory | `dist` |

3. **Environment variable** (Production):

```
VITE_SERVER_URL = wss://game.yourdomain.com/ws
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
