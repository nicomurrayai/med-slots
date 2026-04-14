import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { BRAND_CONFETTI_COLORS } from '../theme/brand';

type CelebrationConfettiProps = {
  active: boolean;
  burstKey: number;
  reducedEffects?: boolean;
};

type ConfettiPieceProps = {
  color: string;
  delay: number;
  duration: number;
  height: number;
  left: number;
  rotationBoost: number;
  size: number;
  startTop: number;
  tilt: number;
  travel: number;
};

function ConfettiPiece({
  color,
  delay,
  duration,
  height,
  left,
  rotationBoost,
  size,
  startTop,
  tilt,
  travel,
}: ConfettiPieceProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.quad),
      }),
    );

    return () => cancelAnimation(progress);
  }, [delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [startTop, height + 260]);
    const translateX = interpolate(progress.value, [0, 0.45, 1], [0, travel * 0.7, travel]);
    const rotate = interpolate(progress.value, [0, 1], [tilt, rotationBoost]);
    const opacity = interpolate(progress.value, [0, 0.08, 0.84, 1], [0, 1, 1, 0]);

    return {
      opacity,
      transform: [
        { translateY },
        { translateX },
        { rotate: `${rotate}deg` },
        { scale: interpolate(progress.value, [0, 0.18, 1], [0.3, 1.12, 0.8]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        animatedStyle,
        {
          backgroundColor: color,
          height: size * 2.2,
          left,
          top: -42,
          width: size,
        },
      ]}
    />
  );
}

export const CelebrationConfetti = memo(function CelebrationConfetti({
  active,
  burstKey,
  reducedEffects = false,
}: CelebrationConfettiProps) {
  const { height, width } = useWindowDimensions();

  const pieces = useMemo(() => {
    const waveCount = reducedEffects ? 2 : 3;
    const piecesPerWave = reducedEffects ? 14 : 34;

    return Array.from({ length: waveCount * piecesPerWave }).map((_, index) => {
      const wave = Math.floor(index / piecesPerWave);
      const localIndex = index % piecesPerWave;
      const spread = width / piecesPerWave;
      const centerOffset = ((localIndex % 5) - 2) * 7;
      const travelStrength =
        (reducedEffects ? 42 : 60) +
        (localIndex % 7) * (reducedEffects ? 10 : 18) +
        wave * (reducedEffects ? 10 : 16);
      const direction = localIndex % 2 === 0 ? 1 : -1;

      return {
        color: BRAND_CONFETTI_COLORS[index % BRAND_CONFETTI_COLORS.length],
        delay: wave * (reducedEffects ? 160 : 220) + (localIndex % 6) * (reducedEffects ? 26 : 38),
        duration:
          (reducedEffects ? 1600 : 2800) +
          wave * (reducedEffects ? 180 : 340) +
          (localIndex % 8) * (reducedEffects ? 28 : 48),
        id: `${burstKey}-${index}`,
        left: localIndex * spread + centerOffset,
        rotationBoost:
          direction *
          ((reducedEffects ? 300 : 540) +
            (localIndex % 9) * (reducedEffects ? 24 : 42) +
            wave * (reducedEffects ? 18 : 30)),
        size: (reducedEffects ? 6 : 8) + (localIndex % 6) * (reducedEffects ? 1 : 1.4) + wave,
        startTop: -60 - wave * (reducedEffects ? 18 : 30) - (localIndex % 4) * 8,
        tilt: direction * (10 + (localIndex % 4) * 8),
        travel: direction * travelStrength,
      };
    });
  }, [burstKey, reducedEffects, width]);

  if (!active) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {pieces.map((piece) => (
        <ConfettiPiece
          key={piece.id}
          color={piece.color}
          delay={piece.delay}
          duration={piece.duration}
          height={height}
          left={piece.left}
          rotationBoost={piece.rotationBoost}
          size={piece.size}
          startTop={piece.startTop}
          tilt={piece.tilt}
          travel={piece.travel}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
    borderRadius: 999,
  },
});
