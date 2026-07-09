export type ItemType =
  | 'fuel_orb'
  | 'raw_chunk'
  | 'upgrade_module'
  | 'ingot'
  | 'heavy_shell'
  | 'ammo_box';

export type PowerChannel = 'engines' | 'weapons' | 'shields' | 'fabricators';

export type MachineId =
  | 'fuel_processor'
  | 'ingot_fabricator'
  | 'shell_fabricator'
  | 'ammo_fabricator';

export type DemandKind = 'engines' | 'weapons' | 'shields' | 'shells' | 'ammo';

export type CrewRole = 'captain' | 'heavy_gunner' | 'mg_gunner';

export type UpgradeEffect =
  | 'craft_speed'
  | 'storage_capacity'
  | 'belt_speed'
  | 'extra_pip'
  | 'breach_slow'
  | 'fuel_efficiency';

export interface Recipe {
  input: ItemType;
  inputCount: number;
  output: ItemType | 'ship_fuel';
  outputCount: number;
  craftTimeMs: number;
}

export const MACHINE_RECIPES: Record<MachineId, Recipe> = {
  fuel_processor: {
    input: 'fuel_orb',
    inputCount: 1,
    output: 'ship_fuel',
    outputCount: 8,
    craftTimeMs: 1800,
  },
  ingot_fabricator: {
    input: 'raw_chunk',
    inputCount: 1,
    output: 'ingot',
    outputCount: 1,
    craftTimeMs: 2200,
  },
  shell_fabricator: {
    input: 'ingot',
    inputCount: 2,
    output: 'heavy_shell',
    outputCount: 1,
    craftTimeMs: 2800,
  },
  ammo_fabricator: {
    input: 'ingot',
    inputCount: 1,
    output: 'ammo_box',
    outputCount: 2,
    craftTimeMs: 2000,
  },
};

export const UPGRADE_DEFS: { effect: UpgradeEffect; label: string }[] = [
  { effect: 'craft_speed', label: 'Overclock' },
  { effect: 'storage_capacity', label: 'Expand Bay' },
  { effect: 'belt_speed', label: 'Belt Grease' },
  { effect: 'extra_pip', label: 'Capacitor' },
  { effect: 'breach_slow', label: 'Sealant' },
  { effect: 'fuel_efficiency', label: 'Injector' },
];

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
    pips: { engines: 2, weapons: 2, shields: 2, fabricators: 2 },
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

export function freePips(state: GameState): number {
  const used =
    state.pips.engines + state.pips.weapons + state.pips.shields + state.pips.fabricators;
  return state.totalPips - used;
}

export function healIntegrityFromBreach(breachSize: number): number {
  const maxSize = 56;
  return 8 + (breachSize / maxSize) * 12;
}
