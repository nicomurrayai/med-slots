import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

type BrandSurfaceProps = {
  children?: ReactNode;
  colors: readonly [string, string, ...string[]];
  enabled?: boolean;
  end?: { x: number; y: number };
  locations?: readonly [number, number, ...number[]];
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  start?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
};

export function BrandSurface({
  children,
  colors,
  enabled = true,
  end,
  locations,
  pointerEvents,
  start,
  style,
}: BrandSurfaceProps) {
  if (!enabled) {
    return (
      <View pointerEvents={pointerEvents} style={style}>
        {children}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={colors}
      end={end}
      locations={locations}
      pointerEvents={pointerEvents}
      start={start}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
