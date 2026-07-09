import type { GameState, UpgradeEffect } from './gameTypes.js';
import { UPGRADE_DEFS } from './gameTypes.js';

export class UpgradeSystem {
  constructor(private state: GameState) {}

  canInstall(): boolean {
    return this.state.upgrades.length < this.state.upgradeSlots;
  }

  install(effect: UpgradeEffect): boolean {
    if (!this.canInstall()) return false;
    if (this.state.upgrades.includes(effect)) return false;
    this.state.upgrades.push(effect);
    this.apply(effect);
    return true;
  }

  randomEffect(): UpgradeEffect {
    const unused = UPGRADE_DEFS.map((d) => d.effect).filter(
      (e) => !this.state.upgrades.includes(e),
    );
    if (unused.length === 0) return 'craft_speed';
    return unused[Math.floor(Math.random() * unused.length)];
  }

  labelFor(effect: UpgradeEffect): string {
    return UPGRADE_DEFS.find((d) => d.effect === effect)?.label ?? effect;
  }

  private apply(effect: UpgradeEffect): void {
    switch (effect) {
      case 'craft_speed':
        this.state.craftSpeedMult *= 1.25;
        break;
      case 'storage_capacity':
        this.state.storageCapacity += 4;
        break;
      case 'belt_speed':
        this.state.beltSpeedMult *= 1.3;
        break;
      case 'extra_pip':
        this.state.totalPips += 1;
        break;
      case 'breach_slow':
        this.state.breachSlowMult *= 1.4;
        break;
      case 'fuel_efficiency':
        this.state.fuelEfficiency *= 1.2;
        break;
    }
  }
}
