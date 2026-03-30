import { ImageSourcePropType } from 'react-native';

export type GameStatus = 'idle' | 'spinning' | 'win' | 'lose';

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
