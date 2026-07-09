import type { GameState, ActiveDemand, DemandKind } from './gameTypes.js';

interface LinePool {
  kind: DemandKind;
  role: string;
  lines: string[];
}

const POOLS: LinePool[] = [
  {
    kind: 'engines',
    role: 'Captain',
    lines: ['I need more pips to engines!', 'We are drifting — juice the thrusters!'],
  },
  {
    kind: 'weapons',
    role: 'Captain',
    lines: ['Reroute power to weapons!', 'Guns are soft — give me weapon pips!'],
  },
  {
    kind: 'shields',
    role: 'Captain',
    lines: ['Boost shields!', 'Shields are flickering — more pips!'],
  },
  {
    kind: 'shells',
    role: 'Heavy Gunner',
    lines: ["I'm dry! Get more shells on the conveyor!", 'Heavy cannon empty — feed me shells!'],
  },
  {
    kind: 'ammo',
    role: 'MG Gunner',
    lines: ['Need more belt-fed ammo! Hurry!', 'MG dry! Load the belts!'],
  },
];

export class IntercomSystem {
  private cooldown = 4;
  private timer = 2;
  private onRaised: (kind: DemandKind, line: string, role: string) => void;

  constructor(
    private state: GameState,
    onRaised: (kind: DemandKind, line: string, role: string) => void,
  ) {
    this.onRaised = onRaised;
  }

  update(dt: number): void {
    this.timer -= dt;
    for (const d of this.state.demands) {
      d.ageMs += dt * 1000;
      d.urgency = Math.min(1, d.ageMs / 12000 + 0.25);
    }

    this.state.demands = this.state.demands.filter((d) => !this.isSatisfied(d));

    if (this.timer <= 0 && this.state.demands.length < 3) {
      this.raiseDemand();
      this.timer = this.cooldown + Math.random() * 3;
      this.cooldown = Math.max(2.2, this.cooldown - 0.08);
    }
  }

  ignoredPenalty(kind: DemandKind): number {
    const d = this.state.demands.find((x) => x.kind === kind);
    return d?.urgency ?? 0;
  }

  private isSatisfied(d: ActiveDemand): boolean {
    switch (d.kind) {
      case 'engines':
        return this.state.pips.engines >= 3;
      case 'weapons':
        return this.state.pips.weapons >= 3;
      case 'shields':
        return this.state.pips.shields >= 3;
      case 'shells':
        return this.state.heavyShells >= 3;
      case 'ammo':
        return this.state.ammoBoxes >= 4;
      default:
        return false;
    }
  }

  private raiseDemand(): void {
    const needed = this.pickKind();
    if (!needed) return;
    if (this.state.demands.some((d) => d.kind === needed.kind)) return;
    const line = needed.lines[Math.floor(Math.random() * needed.lines.length)];
    const demand: ActiveDemand = {
      kind: needed.kind,
      role: needed.role,
      line,
      urgency: 0.3,
      ageMs: 0,
    };
    this.state.demands.push(demand);
    this.onRaised(demand.kind, line, demand.role);
  }

  private pickKind(): LinePool | null {
    const weighted: LinePool[] = [];
    for (const p of POOLS) {
      if (this.state.demands.some((d) => d.kind === p.kind)) continue;
      let w = 1;
      if (p.kind === 'engines' && this.state.pips.engines < 2) w += 2;
      if (p.kind === 'weapons' && this.state.pips.weapons < 2) w += 2;
      if (p.kind === 'shields' && this.state.pips.shields < 2) w += 2;
      if (p.kind === 'shells' && this.state.heavyShells < 2) w += 3;
      if (p.kind === 'ammo' && this.state.ammoBoxes < 3) w += 3;
      for (let i = 0; i < w; i++) weighted.push(p);
    }
    if (weighted.length === 0) return null;
    return weighted[Math.floor(Math.random() * weighted.length)];
  }
}
