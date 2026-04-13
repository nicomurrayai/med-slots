import { EventDay, PrizeDayValues, PrizeQuotaSummary, SlotMachineConfig } from '../types/slot';

export const EVENT_DAYS = [1, 2, 3] as const satisfies readonly EventDay[];
export const DEFAULT_EVENT_DAY: EventDay = 1;

export const DEFAULT_DAILY_PRIZE_LIMITS: PrizeDayValues = {
  1: 90,
  2: 120,
  3: 15,
};

export const DEFAULT_AWARDED_PRIZE_COUNTS: PrizeDayValues = {
  1: 0,
  2: 0,
  3: 0,
};

export function getEventDayLabel(day: EventDay) {
  return `Dia ${day}`;
}

export function clampNonNegativeInteger(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

export function normalizeEventDay(value: unknown): EventDay {
  const numericValue = Number(value);

  if (numericValue === 1 || numericValue === 2 || numericValue === 3) {
    return numericValue;
  }

  return DEFAULT_EVENT_DAY;
}

export function normalizePrizeDayValues(value: unknown, fallback: PrizeDayValues): PrizeDayValues {
  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }

  const candidate = value as Record<string, unknown>;
  const nextValues = { ...fallback };

  EVENT_DAYS.forEach((day) => {
    const rawValue = candidate[String(day)];
    nextValues[day] =
      rawValue === undefined ? fallback[day] : clampNonNegativeInteger(Number(rawValue));
  });

  return nextValues;
}

export function getPrizeQuotaSummary(config: Pick<SlotMachineConfig, 'awardedPrizeCounts' | 'currentEventDay' | 'dailyPrizeLimits'>): PrizeQuotaSummary {
  const currentDayLimit = config.dailyPrizeLimits[config.currentEventDay];
  const currentDayAwarded = config.awardedPrizeCounts[config.currentEventDay];
  const totalLimit = EVENT_DAYS.reduce((sum, day) => sum + config.dailyPrizeLimits[day], 0);
  const totalAwarded = EVENT_DAYS.reduce((sum, day) => sum + config.awardedPrizeCounts[day], 0);
  const currentDayRemaining = Math.max(currentDayLimit - currentDayAwarded, 0);
  const totalRemaining = Math.max(totalLimit - totalAwarded, 0);

  return {
    currentDayAwarded,
    currentDayLimit,
    currentDayRemaining,
    currentEventDay: config.currentEventDay,
    isCurrentDayExhausted: currentDayRemaining <= 0,
    isTotalExhausted: totalRemaining <= 0,
    totalAwarded,
    totalLimit,
    totalRemaining,
  };
}

export function canAwardPrize(config: Pick<SlotMachineConfig, 'awardedPrizeCounts' | 'currentEventDay' | 'dailyPrizeLimits'>) {
  const summary = getPrizeQuotaSummary(config);

  return !summary.isCurrentDayExhausted && !summary.isTotalExhausted;
}

export function validateDailyPrizeLimitChange(
  config: Pick<SlotMachineConfig, 'awardedPrizeCounts'>,
  day: EventDay,
  nextLimit: number,
) {
  const normalizedLimit = clampNonNegativeInteger(nextLimit);
  const awardedCount = config.awardedPrizeCounts[day];

  if (normalizedLimit < awardedCount) {
    return `No puedes guardar un cupo menor a los ${awardedCount} premios ya entregados en ${getEventDayLabel(day)}.`;
  }

  return null;
}

export function adjustAwardedPrizeCount(config: SlotMachineConfig, day: EventDay, delta: number): SlotMachineConfig {
  const nextCount = Math.min(
    config.dailyPrizeLimits[day],
    Math.max(0, config.awardedPrizeCounts[day] + Math.trunc(delta)),
  );

  if (nextCount === config.awardedPrizeCounts[day]) {
    return config;
  }

  return {
    ...config,
    awardedPrizeCounts: {
      ...config.awardedPrizeCounts,
      [day]: nextCount,
    },
  };
}

export function reservePrizeForCurrentDay(config: SlotMachineConfig) {
  if (!canAwardPrize(config)) {
    return null;
  }

  return adjustAwardedPrizeCount(config, config.currentEventDay, 1);
}
