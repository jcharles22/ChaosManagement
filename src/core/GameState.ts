import type { DemandKind, PowerChannel, UpgradeEffect } from './types';

export interface ActiveDemand {
  kind: DemandKind;
  role: string;
  line: string;
  urgency: number;
  ageMs: number;
}

export interface GameState {
  integrity: number;
  maxIntegrity: number;
  fuel: number;
  maxFuel: number;
  heavyShells: number;
  ammoBoxes: number;
  score: number;
  wave: number;
  elapsedMs: number;
  totalPips: number;
  pips: Record<PowerChannel, number>;
  demands: ActiveDemand[];
  upgrades: UpgradeEffect[];
  upgradeSlots: number;
  storageCapacity: number;
  beltSpeedMult: number;
  craftSpeedMult: number;
  breachSlowMult: number;
  fuelEfficiency: number;
  alive: boolean;
  gameOverReason: string;
}

export function createInitialState(): GameState {
  return {
    integrity: 100,
    maxIntegrity: 100,
    fuel: 60,
    maxFuel: 100,
    heavyShells: 4,
    ammoBoxes: 8,
    score: 0,
    wave: 1,
    elapsedMs: 0,
    totalPips: 8,
    pips: {
      engines: 2,
      weapons: 2,
      shields: 2,
      fabricators: 2,
    },
    demands: [],
    upgrades: [],
    upgradeSlots: 3,
    storageCapacity: 8,
    beltSpeedMult: 1,
    craftSpeedMult: 1,
    breachSlowMult: 1,
    fuelEfficiency: 1,
    alive: true,
    gameOverReason: '',
  };
}

export function allocatedPips(state: GameState): number {
  return state.pips.engines + state.pips.weapons + state.pips.shields + state.pips.fabricators;
}

export function freePips(state: GameState): number {
  return state.totalPips - allocatedPips(state);
}

/** Hull integrity restored when a breach is fully sealed (scales with breach severity). */
export function healIntegrityFromBreach(breachSize: number): number {
  const maxSize = 56;
  return 8 + (breachSize / maxSize) * 12;
}
