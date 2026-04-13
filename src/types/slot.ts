import { ImageSourcePropType } from 'react-native';

export type GameStatus = 'idle' | 'spinning' | 'win' | 'lose';

export type EventDay = 1 | 2 | 3;

export type PrizeDayValues = Record<EventDay, number>;

export type PrizeQuotaSummary = {
  currentDayAwarded: number;
  currentDayLimit: number;
  currentDayRemaining: number;
  currentEventDay: EventDay;
  isCurrentDayExhausted: boolean;
  isTotalExhausted: boolean;
  totalAwarded: number;
  totalLimit: number;
  totalRemaining: number;
};

export type ResultModalState = {
  isOpen: boolean;
  message: string;
  variant: 'win' | 'lose';
};

export type SlotSymbol = {
  id: string;
  imageSource: ImageSourcePropType;
  label: string;
};

export type SpinResult = {
  isWin: boolean;
  reels: SlotSymbol[];
};

export type SlotMachineConfig = {
  appBlocked: boolean;
  awardedPrizeCounts: PrizeDayValues;
  currentEventDay: EventDay;
  dailyPrizeLimits: PrizeDayValues;
  winProbabilityPercent: number;
};
