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

export type DemandKind =
  | 'engines'
  | 'weapons'
  | 'shields'
  | 'shells'
  | 'ammo';

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

export const ITEM_COLORS: Record<ItemType, number> = {
  fuel_orb: 0x44ddff,
  raw_chunk: 0xb8860b,
  upgrade_module: 0xff66cc,
  ingot: 0xc0c0c0,
  heavy_shell: 0xff8844,
  ammo_box: 0xffdd44,
};

export const ITEM_LABELS: Record<ItemType, string> = {
  fuel_orb: 'Fuel Orb',
  raw_chunk: 'Raw Material',
  upgrade_module: 'Upgrade',
  ingot: 'Ingot',
  heavy_shell: 'Heavy Shell',
  ammo_box: 'Ammo Box',
};

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

export const MACHINE_LABELS: Record<MachineId, string> = {
  fuel_processor: 'Fuel Processor',
  ingot_fabricator: 'Ingot Fabricator',
  shell_fabricator: 'Shell Fabricator',
  ammo_fabricator: 'Ammo Fabricator',
};

export const UPGRADE_DEFS: { effect: UpgradeEffect; label: string; desc: string }[] = [
  { effect: 'craft_speed', label: 'Overclock', desc: 'Fabricators craft 25% faster' },
  { effect: 'storage_capacity', label: 'Expand Bay', desc: '+4 storage capacity' },
  { effect: 'belt_speed', label: 'Belt Grease', desc: 'Conveyors move 30% faster' },
  { effect: 'extra_pip', label: 'Capacitor', desc: '+1 power pip' },
  { effect: 'breach_slow', label: 'Sealant', desc: 'Breaches spread 40% slower' },
  { effect: 'fuel_efficiency', label: 'Injector', desc: 'Engines burn 20% less fuel' },
];
