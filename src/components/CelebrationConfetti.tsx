import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type CelebrationConfettiProps = {
  active: boolean;
  burstKey: number;
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
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.quad),
      }),
    );
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
}: CelebrationConfettiProps) {
  const { height, width } = useWindowDimensions();

  const pieces = useMemo(() => {
    const palette = ['#ff784b', '#ffd25b', '#18b8ff', '#0f53aa', '#7de2ff', '#ff4f9a', '#22d1a8'];
    const waveCount = 3;
    const piecesPerWave = 34;

    return Array.from({ length: waveCount * piecesPerWave }).map((_, index) => {
      const wave = Math.floor(index / piecesPerWave);
      const localIndex = index % piecesPerWave;
      const spread = width / piecesPerWave;
      const centerOffset = ((localIndex % 5) - 2) * 7;
      const travelStrength = 60 + (localIndex % 7) * 18 + wave * 16;
      const direction = localIndex % 2 === 0 ? 1 : -1;

      return {
        color: palette[index % palette.length],
        delay: wave * 220 + (localIndex % 6) * 38,
        duration: 2800 + wave * 340 + (localIndex % 8) * 48,
        id: `${burstKey}-${index}`,
        left: localIndex * spread + centerOffset,
        rotationBoost: direction * (540 + (localIndex % 9) * 42 + wave * 30),
        size: 8 + (localIndex % 6) * 1.4 + wave,
        startTop: -60 - wave * 30 - (localIndex % 4) * 8,
        tilt: direction * (10 + (localIndex % 4) * 8),
        travel: direction * travelStrength,
      };
    });
  }, [burstKey, width]);

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
