import type { GameState, ActiveDemand } from '../core/GameState';
import type { DemandKind } from '../core/types';
import { bus } from '../core/EventBus';

interface LinePool {
  kind: DemandKind;
  role: string;
  lines: string[];
}

const POOLS: LinePool[] = [
  {
    kind: 'engines',
    role: 'Captain',
    lines: [
      'I need more pips to engines!',
      'We are drifting — juice the thrusters!',
      'Pilot here: engines are starving!',
    ],
  },
  {
    kind: 'weapons',
    role: 'Captain',
    lines: [
      'Reroute power to weapons!',
      'Guns are soft — give me weapon pips!',
      'Captain: weapons need power NOW!',
    ],
  },
  {
    kind: 'shields',
    role: 'Captain',
    lines: [
      'Boost shields!',
      'Shields are flickering — more pips!',
      'Incoming rocks — raise the shields!',
    ],
  },
  {
    kind: 'shells',
    role: 'Heavy Gunner',
    lines: [
      "I'm dry! Get more shells on the conveyor!",
      'Heavy cannon empty — feed me shells!',
      'Big gun hungry. Shells. Yesterday.',
    ],
  },
  {
    kind: 'ammo',
    role: 'MG Gunner',
    lines: [
      'Need more belt-fed ammo! Hurry!',
      'Machine gun chewing air — ammo boxes!',
      'MG dry! Load the belts!',
    ],
  },
];

export class IntercomSystem {
  state: GameState;
  private cooldown = 4;
  private timer = 2;

  constructor(state: GameState) {
    this.state = state;
  }

  update(dt: number): void {
    this.timer -= dt;
    for (const d of this.state.demands) {
      d.ageMs += dt * 1000;
      d.urgency = Math.min(1, d.ageMs / 12000 + 0.25);
    }

    // Auto-resolve when conditions met
    this.state.demands = this.state.demands.filter((d) => {
      if (this.isSatisfied(d)) {
        bus.emit('demandResolved', { kind: d.kind });
        return false;
      }
      return true;
    });

    if (this.timer <= 0 && this.state.demands.length < 3) {
      this.raiseDemand();
      this.timer = this.cooldown + Math.random() * 3;
      this.cooldown = Math.max(2.2, this.cooldown - 0.08);
    }
  }

  raiseDemand(forced?: DemandKind): void {
    const needed = this.pickKind(forced);
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
    bus.emit('demandRaised', { kind: demand.kind, line, role: demand.role });
  }

  /** Penalty multipliers when demands ignored */
  ignoredPenalty(kind: DemandKind): number {
    const d = this.state.demands.find((x) => x.kind === kind);
    if (!d) return 0;
    return d.urgency;
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

  private pickKind(forced?: DemandKind): LinePool | null {
    if (forced) return POOLS.find((p) => p.kind === forced) ?? null;

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
