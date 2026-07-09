import type { DemandKind, ItemType, MachineId, UpgradeEffect } from './types';

export type ShipEventMap = {
  fuelCollected: { amount: number };
  asteroidMined: { amount: number };
  enemyDestroyed: { score: number };
  shipHit: { damage: number; shielded: boolean };
  weaponFired: { weapon: 'cannon' | 'mg' };
  demandRaised: { kind: DemandKind; line: string; role: string };
  demandResolved: { kind: DemandKind };
  itemSpawned: { type: ItemType };
  machineBroken: { id: MachineId };
  machineRepaired: { id: MachineId };
  breachSpawned: { x: number; y: number };
  upgradeInstalled: { effect: UpgradeEffect };
  gameOver: { reason: string; score: number; wave: number; survivedMs: number };
  waveAdvanced: { wave: number };
  scoreChanged: { score: number };
};

type Handler<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Handler<unknown>>>();

  on<K extends keyof ShipEventMap>(event: K, handler: Handler<ShipEventMap[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const set = this.listeners.get(event)!;
    set.add(handler as Handler<unknown>);
    return () => set.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof ShipEventMap>(event: K, payload: ShipEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      (handler as Handler<ShipEventMap[K]>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const bus = new EventBus();
