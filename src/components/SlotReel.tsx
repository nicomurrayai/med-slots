import { useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { BrandSurface } from './BrandSurface';
import { SLOT_SYMBOLS } from '../data/slotSymbols';
import { SlotSymbol } from '../types/slot';

type SlotReelProps = {
  duration: number;
  legacyVisualMode?: boolean;
  onSpinComplete: () => void;
  pendingSymbol: SlotSymbol;
  reelHeight: number;
  reelWidth: number;
  spinDelay: number;
  spinToken: number;
  symbol: SlotSymbol;
};

const STRIP_REPEAT_COUNT = 5;
const STRIP_START_COPY = 1;
const MINIMUM_FULL_LOOPS = 2;
const EXTRA_SPIN_ROWS = 4;
const REEL_STRIP = Array.from({ length: STRIP_REPEAT_COUNT }).flatMap(() => SLOT_SYMBOLS);

function getBaseSymbolIndex(symbolId: string) {
  return SLOT_SYMBOLS.findIndex((item) => item.id === symbolId);
}

function getStableStripIndex(symbolId: string) {
  const baseIndex = getBaseSymbolIndex(symbolId);
  return (STRIP_START_COPY * SLOT_SYMBOLS.length) + Math.max(baseIndex, 0);
}

function getLandingStripIndex(currentIndex: number, targetSymbolId: string) {
  const minimumIndex = currentIndex + (SLOT_SYMBOLS.length * MINIMUM_FULL_LOOPS) + EXTRA_SPIN_ROWS;

  for (let index = minimumIndex; index < REEL_STRIP.length; index += 1) {
    if (REEL_STRIP[index]?.id === targetSymbolId) {
      return index;
    }
  }

  return getStableStripIndex(targetSymbolId);
}

export function SlotReel({
  duration,
  legacyVisualMode = false,
  onSpinComplete,
  pendingSymbol,
  reelHeight,
  reelWidth,
  spinDelay,
  spinToken,
  symbol,
}: SlotReelProps) {
  const currentSymbolRef = useRef(symbol);
  const currentIndexRef = useRef(getStableStripIndex(symbol.id));
  const lastSpinToken = useRef(0);
  const offset = useSharedValue(-currentIndexRef.current * reelHeight);

  useEffect(() => {
    offset.value = -currentIndexRef.current * reelHeight;
  }, [offset, reelHeight]);

  useEffect(() => {
    if (lastSpinToken.current !== 0) {
      return;
    }

    currentSymbolRef.current = symbol;
    currentIndexRef.current = getStableStripIndex(symbol.id);
    offset.value = -currentIndexRef.current * reelHeight;
  }, [offset, reelHeight, symbol]);

  useEffect(() => {
    if (!spinToken || lastSpinToken.current === spinToken) {
      return;
    }

    lastSpinToken.current = spinToken;
    const startIndex = currentIndexRef.current;
    const landingIndex = getLandingStripIndex(startIndex, pendingSymbol.id);
    const resetIndex = getStableStripIndex(pendingSymbol.id);

    cancelAnimation(offset);
    offset.value = -startIndex * reelHeight;
    offset.value = withDelay(
      spinDelay,
      withTiming(
        -landingIndex * reelHeight,
        {
          duration,
          easing: Easing.bezier(0.16, 0.88, 0.2, 1),
        },
        (finished) => {
          if (!finished) {
            return;
          }

          currentIndexRef.current = resetIndex;
          currentSymbolRef.current = pendingSymbol;
          offset.value = -resetIndex * reelHeight;
          runOnJS(onSpinComplete)();
        },
      ),
    );

    return () => cancelAnimation(offset);
  }, [duration, offset, onSpinComplete, pendingSymbol, reelHeight, spinDelay, spinToken]);

  useEffect(
    () => () => {
      cancelAnimation(offset);
    },
    [offset],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <View
      style={[
        styles.shell,
        legacyVisualMode && styles.shellLegacy,
        {
          borderRadius: reelWidth * 0.12,
          height: reelHeight,
          width: reelWidth,
        },
      ]}
    >
      <Animated.View style={animatedStyle}>
        {REEL_STRIP.map((item, index) => (
          <View
            key={`${item.id}-${index}`}
            style={[
              styles.symbolCell,
              {
                height: reelHeight,
                width: reelWidth,
              },
            ]}
          >
            <Image fadeDuration={0} source={item.imageSource} resizeMode="contain" style={styles.symbolImage} />
          </View>
        ))}
      </Animated.View>
      {!legacyVisualMode ? (
        <BrandSurface
          colors={['rgba(8, 28, 60, 0.35)', 'transparent', 'transparent', 'rgba(8, 28, 60, 0.35)']}
          locations={[0, 0.18, 0.82, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  shellLegacy: {
    backgroundColor: '#dfeafe',
  },
  symbolCell: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
  },
  symbolImage: {
    width: '92%',
    height: '92%',
  },
});
