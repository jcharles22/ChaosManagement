import type { GameState } from '../core/GameState';
import { freePips } from '../core/GameState';
import type { PowerChannel } from '../core/types';

export class PowerSystem {
  state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  addPip(channel: PowerChannel): boolean {
    if (freePips(this.state) <= 0) return false;
    this.state.pips[channel] += 1;
    return true;
  }

  removePip(channel: PowerChannel): boolean {
    if (this.state.pips[channel] <= 0) return false;
    this.state.pips[channel] -= 1;
    return true;
  }

  fabricatorsPowered(): boolean {
    return this.state.pips.fabricators >= 1;
  }

  /** 0–1 multipliers for Asteroids AI */
  engineMult(): number {
    return 0.45 + this.state.pips.engines * 0.18;
  }

  weaponMult(): number {
    return 0.35 + this.state.pips.weapons * 0.2;
  }

  shieldMult(): number {
    return Math.min(0.85, this.state.pips.shields * 0.18);
  }

  fuelDrainPerSec(): number {
    const base = 0.35 + this.state.pips.engines * 0.25;
    return base / this.state.fuelEfficiency;
  }
}
