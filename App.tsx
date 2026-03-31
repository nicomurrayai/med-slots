import { Asset } from 'expo-asset';
import { DMSans_500Medium, DMSans_700Bold, useFonts as useDMSans } from '@expo-google-fonts/dm-sans';
import {
  LeagueSpartan_600SemiBold,
  LeagueSpartan_700Bold,
  useFonts as useLeagueSpartan,
} from '@expo-google-fonts/league-spartan';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CelebrationConfetti } from './src/components/CelebrationConfetti';
import { ResultModal } from './src/components/ResultModal';
import { SlotReel } from './src/components/SlotReel';
import { MED_LOGO, SLOT_SYMBOLS } from './src/data/slotSymbols';
import { GameStatus, ResultModalState, SlotSymbol, SpinResult } from './src/types/slot';

const WIN_MESSAGE = 'Felicitaciones! Ganaste un premio sorpresa.';
const LOSE_MESSAGE = 'Segui intentando.';
const WIN_PROBABILITY = 0.18;
const INITIAL_REELS = [SLOT_SYMBOLS[0], SLOT_SYMBOLS[4], SLOT_SYMBOLS[8]];
const BASE_REEL_DURATION = 3200;
const REEL_DURATION_STEP = 520;
const REEL_SPIN_DELAY = 360;
const CONFETTI_VISIBLE_MS = 9700;
const ARCADE_LIGHTS = Array.from({ length: 7 }, (_, index) => index);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pickRandomSymbol(excludedIds: string[] = []) {
  const pool = SLOT_SYMBOLS.filter((symbol) => !excludedIds.includes(symbol.id));
  return pool[Math.floor(Math.random() * pool.length)] ?? SLOT_SYMBOLS[0];
}

function createSpinResult(): SpinResult {
  // Slightly bias wins so the promo moment is visible without requiring hundreds of spins.
  if (Math.random() < WIN_PROBABILITY) {
    const winningSymbol = pickRandomSymbol();

    return {
      reels: [winningSymbol, winningSymbol, winningSymbol],
      isWin: true,
    };
  }

  const reels = [pickRandomSymbol(), pickRandomSymbol(), pickRandomSymbol()];

  while (reels[0].id === reels[1].id && reels[1].id === reels[2].id) {
    reels[2] = pickRandomSymbol([reels[0].id]);
  }

  return {
    reels,
    isWin: false,
  };
}

type LeverButtonProps = {
  compact: boolean;
  disabled: boolean;
  onPress: () => void;
  spinToken: number;
};

function LeverButton({ compact, disabled, onPress, spinToken }: LeverButtonProps) {
  const pullProgress = useSharedValue(0);

  useEffect(() => {
    if (!spinToken) {
      return;
    }

    pullProgress.value = 0;
    pullProgress.value = withSequence(
      withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(-0.07, {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0.02, {
        duration: 210,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(0, {
        duration: 180,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, [pullProgress, spinToken]);

  const leverPivotStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(pullProgress.value, [-0.07, 0, 1], [-6, 0, 180])}deg` },
      { scaleY: interpolate(pullProgress.value, [-0.07, 0, 1], [1.005, 1, 0.94]) },
    ],
  }));

  return (
    <View style={[styles.leverWrap, compact && styles.leverWrapCompact]}>
      <Pressable
        accessibilityLabel="Tirar la palanca"
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.leverPressable,
          compact && styles.leverPressableCompact,
          pressed && !disabled && styles.leverPressed,
        ]}
      >
        <View style={styles.leverBase}>
          {/* Static Mount connected to machine */}
          <LinearGradient
            colors={['#0e3568', '#408df5', '#0e3568']}
            end={{ x: 0, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.leverMount}
          />
          
          {/* Rotating Rod and Knob */}
          <Animated.View style={[styles.leverPivot, leverPivotStyle]}>
            <LinearGradient
              colors={['#e0e8f0', '#b0c4de', '#e0e8f0']}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={styles.leverRod}
            />
            <View style={styles.leverKnob}>
              <LinearGradient
                colors={['#ff4b3e', '#d32f2f', '#9a0007']}
                style={styles.leverKnobCore}
              />
              <View style={styles.leverKnobHighlight} />
            </View>
          </Animated.View>

          {/* Static Silver Sphere over the rod */}
          <LinearGradient
            colors={['#ffffff', '#a8bbce', '#5a6f8a']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0.1, y: 0.1 }}
            style={styles.leverSocket}
          />
        </View>
      </Pressable>
    </View>
  );
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const [assetsReady, setAssetsReady] = useState(false);
  const [currentReels, setCurrentReels] = useState<SlotSymbol[]>(INITIAL_REELS);
  const [targetReels, setTargetReels] = useState<SlotSymbol[]>(INITIAL_REELS);
  const [spinToken, setSpinToken] = useState(0);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  const [confettiBurstKey, setConfettiBurstKey] = useState(0);
  const [resultModal, setResultModal] = useState<ResultModalState>({
    isOpen: false,
    variant: 'lose',
    message: '',
  });

  const pendingResultRef = useRef<SpinResult | null>(null);
  const completedReelsRef = useRef(0);

  const [leagueLoaded, leagueError] = useLeagueSpartan({
    LeagueSpartan_600SemiBold,
    LeagueSpartan_700Bold,
  });
  const [dmLoaded, dmError] = useDMSans({
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    let active = true;

    Asset.loadAsync([MED_LOGO, ...SLOT_SYMBOLS.map((symbol) => symbol.imageSource)])
      .catch(() => null)
      .finally(() => {
        if (active) {
          setAssetsReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasTriggeredConfetti) {
      return;
    }

    const timeout = setTimeout(() => {
      setHasTriggeredConfetti(false);
    }, CONFETTI_VISIBLE_MS);

    return () => clearTimeout(timeout);
  }, [hasTriggeredConfetti]);

  const ready = assetsReady && (leagueLoaded || !!leagueError) && (dmLoaded || !!dmError);

  const layout = useMemo(() => {
    const pageWidth = Math.min(width, 1280);
    const compact = pageWidth < 900;
    const frameWidth = clamp(compact ? pageWidth - 28 : pageWidth - 160, 300, compact ? 420 : 860);
    const innerPadding = compact ? 18 : 28;
    const reelGap = compact ? 10 : 18;
    const reelWidth = (frameWidth - innerPadding * 2 - reelGap * 2) / 3;
    const reelHeight = clamp(compact ? reelWidth * 1.52 : reelWidth * 1.28, 128, 236);

    return {
      compact,
      frameWidth,
      headlineWidth: compact ? 320 : 920,
      logoSize: compact ? 96 : 148,
      machineRadius: compact ? 34 : 50,
      pageHorizontal: compact ? 14 : 28,
      pageVertical: compact ? 24 : 42,
      reelGap,
      reelHeight,
      reelWidth,
      subtitleSize: compact ? 16 : 20,
      titleSize: compact ? 28 : 54,
    };
  }, [width]);

  const handleSpin = () => {
    if (status === 'spinning') {
      return;
    }

    const result = createSpinResult();
    pendingResultRef.current = result;
    completedReelsRef.current = 0;

    setTargetReels(result.reels);
    setResultModal((prev) => ({ ...prev, isOpen: false }));
    setStatus('spinning');
    setHasTriggeredConfetti(false);
    setSpinToken((value) => value + 1);
  };

  const handleReelComplete = () => {
    completedReelsRef.current += 1;

    if (completedReelsRef.current < currentReels.length) {
      return;
    }

    const result = pendingResultRef.current;

    if (!result) {
      setStatus('idle');
      return;
    }

    setCurrentReels(result.reels);
    setStatus(result.isWin ? 'win' : 'lose');
    setResultModal({
      isOpen: true,
      variant: result.isWin ? 'win' : 'lose',
      message: result.isWin ? WIN_MESSAGE : LOSE_MESSAGE,
    });

    if (result.isWin) {
      setHasTriggeredConfetti(true);
      setConfettiBurstKey((value) => value + 1);
    }
  };

  const closeModal = () => {
    setResultModal((prev) => ({ ...prev, isOpen: false }));
  };

  const statusCopy =
    status === 'spinning'
      ? 'Tus equipos ya estan girando.'
      : 'Tres iguales desbloquean un premio sorpresa.';
  const machineDepthX = layout.compact ? 10 : 22;
  const machineDepthY = layout.compact ? 14 : 24;
  const sideLightSize = layout.compact ? 12 : 16;
  const reelInset = layout.compact ? 12 : 16;
  const reelViewportHeight = layout.reelHeight - reelInset;
  const reelViewportWidth = layout.reelWidth - reelInset;

  if (!ready) {
    return (
      <LinearGradient colors={['#f8fbff', '#d7ecff', '#eef6ff']} style={styles.loadingScreen}>
        <View style={styles.loadingCard}>
          <Image source={MED_LOGO} resizeMode="contain" style={styles.loadingLogo} />
          <ActivityIndicator color="#1253ab" size="large" />
          <Text style={styles.loadingTitle}>Preparando la maquina MED...</Text>
          <Text style={styles.loadingBody}>Cargando branding, premios y animaciones.</Text>
        </View>
        <StatusBar style="dark" />
      </LinearGradient>
    );
  }

  return (
    <View style={styles.page}>
      <LinearGradient colors={['#ffffff', '#f4f9ff', '#dfeeff']} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.backgroundBloom, styles.backgroundBloomTwo]} />

      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            minHeight: height,
            paddingHorizontal: layout.pageHorizontal,
            paddingVertical: layout.pageVertical,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, layout.compact && styles.heroCompact]}>
          <View style={[styles.heroIntro, { maxWidth: layout.headlineWidth }]}>
            <Image
              source={MED_LOGO}
              resizeMode="contain"
              style={[
                styles.heroLogo,
                {
                  height: layout.logoSize,
                  width: layout.logoSize,
                },
              ]}
            />
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}
              style={[
                styles.heroTitle,
                {
                  fontSize: layout.titleSize,
                  lineHeight: layout.compact ? 32 : 58,
                },
              ]}
            >
              GANA PREMIOS AL INSTANTE
            </Text>
            <Text
              style={[
                styles.heroTitle,
                {
                  fontSize: layout.titleSize,
                  lineHeight: layout.compact ? 32 : 58,
                },
              ]}
            >
              JUGÁ AHORA
            </Text>
          </View>
        </View>

        <View style={styles.machineStage}>
          <View style={styles.machineAssembly}>
            <View
              style={[
                styles.machineCabinet,
                {
                  paddingBottom: machineDepthY,
                  paddingRight: machineDepthX,
                  width: layout.frameWidth + machineDepthX,
                },
              ]}
            >
              <View
                style={[
                  styles.machineDepthShadow,
                  {
                    bottom: 4,
                    left: machineDepthX + 12,
                    right: 10,
                    top: machineDepthY + 26,
                  },
                ]}
              />
              <LinearGradient
                colors={['#072860', '#0e478f', '#051f4e']}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={[
                  styles.machineDepthPlate,
                  {
                    borderRadius: layout.machineRadius + 8,
                    bottom: 0,
                    left: machineDepthX,
                    right: 0,
                    top: machineDepthY,
                  },
                ]}
              />
              <LinearGradient
                colors={['#327de0', '#2563ba', '#1a4f9e']}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={[
                  styles.machineShell,
                  {
                    borderRadius: layout.machineRadius,
                    width: layout.frameWidth,
                  },
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.05)', 'transparent']}
                  style={styles.machineGlossTop}
                />

                <View style={[styles.machineEdgeStrip, styles.machineEdgeStripLeft]}>
                  {ARCADE_LIGHTS.map((light) => (
                    <View
                      key={`left-light-${light}`}
                      style={[
                        styles.arcadeBulb,
                        {
                          borderRadius: sideLightSize / 2,
                          height: sideLightSize,
                          width: sideLightSize,
                        },
                      ]}
                    />
                  ))}
                </View>

                <View style={[styles.machineEdgeStrip, styles.machineEdgeStripRight]}>
                  {ARCADE_LIGHTS.map((light) => (
                    <View
                      key={`right-light-${light}`}
                      style={[
                        styles.arcadeBulb,
                        {
                          borderRadius: sideLightSize / 2,
                          height: sideLightSize,
                          width: sideLightSize,
                        },
                      ]}
                    />
                  ))}
                </View>

                <LinearGradient
                  colors={['#1c4a91', '#255ebd', '#1c4a91']}
                  style={[
                    styles.machineCore,
                    {
                      borderRadius: layout.machineRadius - 12,
                      margin: 16,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.reelsRow,
                      {
                        gap: layout.reelGap,
                        paddingHorizontal: layout.compact ? 12 : 16,
                        paddingVertical: layout.compact ? 12 : 16,
                      },
                    ]}
                  >
                    {currentReels.map((symbol, index) => (
                      <View
                        key={index}
                        style={[
                          styles.reelFrame,
                          {
                            borderRadius: layout.reelWidth * 0.12,
                            height: layout.reelHeight,
                            width: layout.reelWidth,
                          },
                        ]}
                      >
                        <SlotReel
                          duration={BASE_REEL_DURATION + index * REEL_DURATION_STEP}
                          onSpinComplete={handleReelComplete}
                          pendingSymbol={targetReels[index]}
                          reelHeight={layout.reelHeight}
                          reelWidth={layout.reelWidth}
                          spinDelay={index * REEL_SPIN_DELAY}
                          spinToken={spinToken}
                          symbol={symbol}
                        />
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </LinearGradient>
            </View>

            <LeverButton
              compact={layout.compact}
              disabled={status === 'spinning'}
              onPress={handleSpin}
              spinToken={spinToken}
            />
          </View>
        </View>

        <View style={styles.footerCopy}>
          <Text style={[styles.spinInstruction, { fontSize: layout.compact ? 30 : 38 }]}>
            TIRA DE LA PALANCA
          </Text>
          <Text style={styles.statusCopy}>{statusCopy}</Text>
        </View>
      </ScrollView>

      <CelebrationConfetti active={hasTriggeredConfetti} burstKey={confettiBurstKey} />

      <ResultModal
        isOpen={resultModal.isOpen}
        message={resultModal.message}
        onClose={closeModal}
        title={resultModal.variant === 'win' ? 'Resultado ganador' : 'Resultado de la tirada'}
        variant={resultModal.variant}
      />

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f8fbff',
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  backgroundBloom: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.55,
  },
  backgroundBloomTwo: {
    width: 420,
    height: 420,
    bottom: -120,
    right: -140,
    backgroundColor: '#cce0ff',
  },
  hero: {
    width: '100%',
    maxWidth: 1180,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 34,
  },
  heroCompact: {
    flexDirection: 'column',
    gap: 18,
    marginBottom: 26,
  },
  heroIntro: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: {
    marginBottom: 18,
  },
  badgeLabel: {
    fontFamily: 'DMSans_700Bold',
    color: '#0f4fa8',
    letterSpacing: 2.6,
    marginBottom: 12,
    textAlign: 'center',
  },
  heroTitle: {
    fontFamily: 'LeagueSpartan_700Bold',
    color: '#0f4fa8',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: 'DMSans_500Medium',
    color: '#335379',
    marginTop: 12,
    maxWidth: 560,
    textAlign: 'center',
  },
  machineStage: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  machineAssembly: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  machineCabinet: {
    position: 'relative',
  },
  machineDepthShadow: {
    position: 'absolute',
    borderRadius: 48,
    backgroundColor: 'rgba(4, 27, 67, 0.24)',
    shadowColor: '#0a2c72',
    shadowOpacity: 0.22,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  machineDepthPlate: {
    position: 'absolute',
    shadowColor: '#0a2c72',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  machineShell: {
    paddingVertical: 24,
    paddingHorizontal: 22,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#0a2c72',
    shadowOpacity: 0.32,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 22 },
    elevation: 18,
  },
  machineGlossTop: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 76,
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
  },
  machineEdgeStrip: {
    position: 'absolute',
    top: 42,
    bottom: 42,
    justifyContent: 'space-between',
  },
  machineEdgeStripLeft: {
    left: 14,
  },
  machineEdgeStripRight: {
    right: 14,
  },
  arcadeBulb: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#ffffff',
    shadowOpacity: 0.75,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  machineRim: {
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  machineCore: {
    padding: 12,
    overflow: 'hidden',
  },
  reelsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelFrame: {
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  leverWrap: {
    position: 'absolute',
    right: -130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leverWrapCompact: {
    position: 'relative',
    right: 0,
    marginTop: 18,
  },
  leverPressable: {
    alignItems: 'center',
    gap: 16,
  },
  leverPressableCompact: {
    flexDirection: 'row',
    gap: 14,
  },
  leverPressed: {
    transform: [{ scale: 0.98 }],
  },
  leverBase: {
    width: 104,
    height: 214,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  leverMount: {
    position: 'absolute',
    top: 130,
    left: -40,
    width: 70,
    height: 48,
    borderRadius: 8,
    borderBottomLeftRadius: 16,
    borderTopLeftRadius: 16,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    shadowColor: '#0a2c72',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  leverPivot: {
    position: 'absolute',
    top: 62,
    width: 132,
    height: 180,
    alignItems: 'center',
  },
  leverRod: {
    position: 'absolute',
    top: -20,
    width: 14,
    height: 120,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#9eb5d0',
  },
  leverSocket: {
    position: 'absolute',
    top: 130,
    left: 14,
    width: 46,
    height: 46,
    borderRadius:600,
    shadowColor: '#16386c',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  leverKnob: {
    position: 'absolute',
    top: -72,
    width: 58,
    height: 58,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#8c130a',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  leverKnobCore: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  leverKnobHighlight: {
    position: 'absolute',
    top: 8,
    left: 10,
    width: 18,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.38)',
    transform: [{ rotate: '-18deg' }],
  },
  footerCopy: {
    alignItems: 'center',
    gap: 8,
  },
  spinInstruction: {
    fontFamily: 'LeagueSpartan_700Bold',
    color: '#0f4fa8',
    letterSpacing: 1.8,
    textAlign: 'center',
  },
  statusCopy: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: '#3a5a83',
    textAlign: 'center',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 32,
    paddingVertical: 34,
    paddingHorizontal: 26,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#0f4fa8',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  loadingLogo: {
    width: 92,
    height: 92,
  },
  loadingTitle: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 26,
    textAlign: 'center',
    color: '#0f4fa8',
  },
  loadingBody: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#47668f',
  },
});
