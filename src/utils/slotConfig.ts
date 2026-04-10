import { SlotMachineConfig } from '../types/slot';

export const DEFAULT_WIN_PROBABILITY_PERCENT = 25;

export function clampWinProbabilityPercent(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_WIN_PROBABILITY_PERCENT;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function createDefaultSlotMachineConfig(): SlotMachineConfig {
  return {
    appBlocked: false,
    winProbabilityPercent: DEFAULT_WIN_PROBABILITY_PERCENT,
  };
}

export function normalizeSlotMachineConfig(config: unknown): SlotMachineConfig {
  if (!config || typeof config !== 'object') {
    return createDefaultSlotMachineConfig();
  }

  const candidate = config as Partial<Record<keyof SlotMachineConfig, unknown>>;

  return {
    appBlocked: Boolean(candidate.appBlocked),
    winProbabilityPercent: clampWinProbabilityPercent(Number(candidate.winProbabilityPercent)),
  };
}
