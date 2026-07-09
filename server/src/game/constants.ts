import type { ItemType, MachineId } from './gameTypes.js';

export const FLOOR = { left: 56, right: 1224, top: 216, bottom: 664 };
export const PLAYER_SPEED = 180;

export const POWER_CONSOLE = { x: 160, y: 280 };
export const UPGRADE_BAY = { x: 1100, y: 520 };
export const STORAGE = { x: 460, y: 340 };

export const MACHINE_POSITIONS: Record<MachineId, { x: number; y: number }> = {
  fuel_processor: { x: 220, y: 480 },
  ingot_fabricator: { x: 420, y: 560 },
  shell_fabricator: { x: 680, y: 560 },
  ammo_fabricator: { x: 920, y: 560 },
};

export const BELTS: Record<
  string,
  { points: { x: number; y: number }[]; speed: number; acceptTypes: ItemType[] | null }
> = {
  incoming: {
    points: [
      { x: 50, y: 250 },
      { x: 200, y: 250 },
      { x: 320, y: 250 },
      { x: 400, y: 320 },
    ],
    speed: 90,
    acceptTypes: null,
  },
  shells: {
    points: [
      { x: 900, y: 300 },
      { x: 1050, y: 280 },
      { x: 1180, y: 240 },
    ],
    speed: 100,
    acceptTypes: ['heavy_shell'],
  },
  ammo: {
    points: [
      { x: 900, y: 400 },
      { x: 1050, y: 420 },
      { x: 1180, y: 460 },
    ],
    speed: 110,
    acceptTypes: ['ammo_box'],
  },
};

export const SPAWNS = [
  { x: 500, y: 420 },
  { x: 640, y: 420 },
  { x: 780, y: 420 },
];
