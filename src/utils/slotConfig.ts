import { SlotMachineConfig } from '../types/slot';
import {
  DEFAULT_AWARDED_PRIZE_COUNTS,
  DEFAULT_DAILY_PRIZE_LIMITS,
  DEFAULT_EVENT_DAY,
  EVENT_DAYS,
  normalizeEventDay,
  normalizePrizeDayValues,
} from './prizeQuota';

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
    awardedPrizeCounts: { ...DEFAULT_AWARDED_PRIZE_COUNTS },
    currentEventDay: DEFAULT_EVENT_DAY,
    dailyPrizeLimits: { ...DEFAULT_DAILY_PRIZE_LIMITS },
    winProbabilityPercent: DEFAULT_WIN_PROBABILITY_PERCENT,
  };
}

export function normalizeSlotMachineConfig(config: unknown): SlotMachineConfig {
  if (!config || typeof config !== 'object') {
    return createDefaultSlotMachineConfig();
  }

  const candidate = config as Partial<Record<keyof SlotMachineConfig, unknown>>;
  const dailyPrizeLimits = normalizePrizeDayValues(candidate.dailyPrizeLimits, DEFAULT_DAILY_PRIZE_LIMITS);
  const awardedPrizeCounts = normalizePrizeDayValues(candidate.awardedPrizeCounts, DEFAULT_AWARDED_PRIZE_COUNTS);

  EVENT_DAYS.forEach((day) => {
    awardedPrizeCounts[day] = Math.min(awardedPrizeCounts[day], dailyPrizeLimits[day]);
  });

  return {
    appBlocked: Boolean(candidate.appBlocked),
    awardedPrizeCounts,
    currentEventDay: normalizeEventDay(candidate.currentEventDay),
    dailyPrizeLimits,
    winProbabilityPercent: clampWinProbabilityPercent(Number(candidate.winProbabilityPercent)),
  };
}
