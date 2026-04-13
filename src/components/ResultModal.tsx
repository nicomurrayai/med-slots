import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

type ResultModalProps = {
  isOpen: boolean;
  legacyVisualMode?: boolean;
  message: string;
  onClose: () => void;
  title: string;
  variant: 'win' | 'lose';
};

export function ResultModal({
  isOpen,
  legacyVisualMode = false,
  message,
  onClose,
  title,
  variant,
}: ResultModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(180)} style={styles.overlay}>
      <Animated.View
        entering={SlideInDown.springify().damping(18)}
        exiting={SlideOutDown.duration(180)}
        style={[styles.cardWrap, legacyVisualMode && styles.cardWrapLegacy]}
      >
        <View style={[styles.cardAccent, variant === 'win' ? styles.cardAccentWin : styles.cardAccentLose]} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.body}>{message}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.button,
              !message && styles.buttonWithTitleGap,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>Volver al inicio</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    zIndex: 30,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#072a63',
    shadowOpacity: 0.26,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 16 },
    elevation: 18,
  },
  cardWrapLegacy: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderWidth: 1,
    borderColor: '#bfd6f6',
  },
  cardAccent: {
    height: 10,
  },
  cardAccentWin: {
    backgroundColor: '#0f73ff',
  },
  cardAccentLose: {
    backgroundColor: '#88a9ce',
  },
  card: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 28,
    paddingVertical: 30,
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    letterSpacing: 2.2,
    color: '#5a7ea8',
    marginBottom: 12,
    textAlign: 'center',
  },
  title: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 32,
    color: '#0f4fa8',
    textAlign: 'center',
  },
  body: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 17,
    lineHeight: 25,
    color: '#36567e',
    marginTop: 12,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    minWidth: 150,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#0f4fa8',
    alignItems: 'center',
  },
  buttonWithTitleGap: {
    marginTop: 18,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: '#ffffff',
  },
});
