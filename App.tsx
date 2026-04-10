  import { Asset } from 'expo-asset';
import { DMSans_500Medium, DMSans_700Bold, useFonts as useDMSans } from '@expo-google-fonts/dm-sans';
import {
  LeagueSpartan_600SemiBold,
  LeagueSpartan_700Bold,
  useFonts as useLeagueSpartan,
} from '@expo-google-fonts/league-spartan';
import * as Sharing from 'expo-sharing';
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
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AdminScreen } from './src/components/AdminScreen';
import { CelebrationConfetti } from './src/components/CelebrationConfetti';
import { EmailCaptureScreen } from './src/components/EmailCaptureScreen';
import { IntroHomeScreen } from './src/components/IntroHomeScreen';
import { ResultModal } from './src/components/ResultModal';
import { SlotReel } from './src/components/SlotReel';
import { MED_LOGO, SLOT_SYMBOLS } from './src/data/slotSymbols';
import {
  exportLeadsCsv,
  getRecentLeads,
  initDatabase,
  saveLead,
} from './src/services/leadsStorage';
import { loadSlotMachineConfig, saveSlotMachineConfig } from './src/services/slotConfigStorage';
import { BRAND_COLORS, BRAND_GRADIENTS } from './src/theme/brand';
import { LeadEntry } from './src/types/leads';
import { GameStatus, ResultModalState, SlotMachineConfig, SlotSymbol, SpinResult } from './src/types/slot';
import { createDefaultSlotMachineConfig } from './src/utils/slotConfig';

const WIN_MESSAGE = 'Felicitaciones! Ganaste un premio sorpresa.';
const LOSE_MESSAGE = '';
const INITIAL_REELS = [SLOT_SYMBOLS[0], SLOT_SYMBOLS[4], SLOT_SYMBOLS[8]];
const BASE_REEL_DURATION = 3200;
const REEL_DURATION_STEP = 520;
const REEL_SPIN_DELAY = 360;
const CONFETTI_VISIBLE_MS = 9700;
const ARCADE_LIGHTS = Array.from({ length: 7 }, (_, index) => index);
const ARCADE_PULSE_DURATION = 1280;
const ARCADE_IDLE_GLOW = 0.2;
const ARCADE_LIGHT_PHASE_STEP = 0.64;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SECRET_LOGO_TAP_TARGET = 5;
const SECRET_LOGO_TAP_WINDOW_MS = 900;
const RECENT_LEADS_LIMIT = 20;
const SLOT_ENTRY_GUARD_MS = 450;

type AppStep = 'home' | 'leadCapture' | 'slot' | 'admin';
type AdminConfigNoticeTone = 'neutral' | 'success' | 'error';

function createDefaultResultModal(): ResultModalState {
  return {
    isOpen: false,
    variant: 'lose',
    message: '',
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pickRandomSymbol(excludedIds: string[] = []) {
  const pool = SLOT_SYMBOLS.filter((symbol) => !excludedIds.includes(symbol.id));
  return pool[Math.floor(Math.random() * pool.length)] ?? SLOT_SYMBOLS[0];
}

function createSpinResult(winProbabilityPercent: number): SpinResult {
  const winProbability = clamp(winProbabilityPercent, 0, 100) / 100;

  if (Math.random() < winProbability) {
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

function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value.trim());
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

  const leverWrapStyle = compact
    ? {
        right: -88,
        transform: [{ translateY: -84 }, { scale: 0.86 }],
      }
    : {
        right: -130,
        transform: [{ translateY: -107 }],
      };

  return (
    <View style={[styles.leverWrap, leverWrapStyle]}>
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
          <LinearGradient
            colors={BRAND_GRADIENTS.leverMount}
            end={{ x: 0, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.leverMount}
          />

          <Animated.View style={[styles.leverPivot, leverPivotStyle]}>
            <LinearGradient
              colors={BRAND_GRADIENTS.metallic}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={styles.leverRod}
            />
            <View style={styles.leverKnob}>
              <LinearGradient colors={BRAND_GRADIENTS.leverKnob} style={styles.leverKnobCore} />
              <View style={styles.leverKnobHighlight} />
            </View>
          </Animated.View>

          <LinearGradient
            colors={BRAND_GRADIENTS.socket}
            end={{ x: 1, y: 1 }}
            start={{ x: 0.1, y: 0.1 }}
            style={styles.leverSocket}
          />
        </View>
      </Pressable>
    </View>
  );
}

type ArcadeBulbProps = {
  active: boolean;
  index: number;
  pulse: { value: number };
  side: 'left' | 'right';
  size: number;
};

function ArcadeBulb({ active, index, pulse, side, size }: ArcadeBulbProps) {
  const phase =
    (side === 'left' ? index : ARCADE_LIGHTS.length - 1 - index) * ARCADE_LIGHT_PHASE_STEP +
    (side === 'right' ? Math.PI / 2.8 : 0);

  const bulbStyle = useAnimatedStyle(() => {
    const wave = 0.5 + 0.5 * Math.sin((pulse.value * Math.PI * 2) + phase);
    const intensity = active ? 0.24 + wave * 0.56 : 0.16 + pulse.value * 0.28;

    return {
      opacity: 0.44 + intensity * 0.38,
      transform: [{ scale: 0.96 + intensity * 0.1 }],
      backgroundColor: interpolateColor(
        intensity,
        [0, 0.55, 1],
        ['#7891b8', '#e4efff', '#d7ebff'],
      ),
      borderColor: interpolateColor(
        intensity,
        [0, 1],
        ['rgba(255,255,255,0.4)', 'rgba(235,245,255,0.92)'],
      ),
    };
  }, [active, phase]);

  const haloStyle = useAnimatedStyle(() => {
    const wave = 0.5 + 0.5 * Math.sin((pulse.value * Math.PI * 2) + phase);
    const intensity = active ? 0.24 + wave * 0.56 : 0.16 + pulse.value * 0.28;

    return {
      opacity: intensity * 0.28,
      transform: [{ scale: 1 + intensity * 0.5 }],
    };
  }, [active, phase]);

  return (
    <View
      style={[
        styles.arcadeBulbSlot,
        {
          height: size + 12,
          width: size + 12,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.arcadeBulbHalo,
          {
            borderRadius: (size + 8) / 2,
            height: size + 8,
            width: size + 8,
          },
          haloStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.arcadeBulb,
          {
            borderRadius: size / 2,
            height: size,
            width: size,
          },
          bulbStyle,
        ]}
      />
    </View>
  );
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const [assetsReady, setAssetsReady] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [storageRetryToken, setStorageRetryToken] = useState(0);
  const [slotConfig, setSlotConfig] = useState<SlotMachineConfig>(createDefaultSlotMachineConfig);
  const [slotConfigReady, setSlotConfigReady] = useState(false);
  const [currentStep, setCurrentStep] = useState<AppStep>('home');
  const [capturedEmail, setCapturedEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [currentReels, setCurrentReels] = useState<SlotSymbol[]>(INITIAL_REELS);
  const [targetReels, setTargetReels] = useState<SlotSymbol[]>(INITIAL_REELS);
  const [spinToken, setSpinToken] = useState(0);
  const [isSpinPrimed, setIsSpinPrimed] = useState(false);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  const [confettiBurstKey, setConfettiBurstKey] = useState(0);
  const [resultModal, setResultModal] = useState<ResultModalState>(createDefaultResultModal);
  const [adminRecentLeads, setAdminRecentLeads] = useState<LeadEntry[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminNotice, setAdminNotice] = useState('');
  const [adminConfigNotice, setAdminConfigNotice] = useState('Se aplica desde la siguiente jugada.');
  const [adminConfigNoticeTone, setAdminConfigNoticeTone] = useState<AdminConfigNoticeTone>('neutral');
  const [isSavingSlotConfig, setIsSavingSlotConfig] = useState(false);
  const [isSavingAppBlock, setIsSavingAppBlock] = useState(false);
  const [adminAppBlockNotice, setAdminAppBlockNotice] = useState('La app esta disponible para participar.');
  const [isExportingLeads, setIsExportingLeads] = useState(false);

  const pendingResultRef = useRef<SpinResult | null>(null);
  const completedReelsRef = useRef(0);
  const secretLogoTapCountRef = useRef(0);
  const lastSecretLogoTapAtRef = useRef(0);
  const arcadePulse = useSharedValue(ARCADE_IDLE_GLOW);

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
    let active = true;

    setSlotConfigReady(false);

    loadSlotMachineConfig()
      .then((storedConfig) => {
        if (!active) {
          return;
        }

        setSlotConfig(storedConfig);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        const fallbackConfig = createDefaultSlotMachineConfig();
        setSlotConfig(fallbackConfig);
      })
      .finally(() => {
        if (active) {
          setSlotConfigReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    setStorageReady(false);
    setStorageError('');

    initDatabase()
      .then(() => {
        if (active) {
          setStorageReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setStorageError('No pudimos preparar la base local del dispositivo.');
        }
      });

    return () => {
      active = false;
    };
  }, [storageRetryToken]);

  useEffect(() => {
    if (!hasTriggeredConfetti) {
      return;
    }

    const timeout = setTimeout(() => {
      setHasTriggeredConfetti(false);
    }, CONFETTI_VISIBLE_MS);

    return () => clearTimeout(timeout);
  }, [hasTriggeredConfetti]);

  useEffect(() => {
    cancelAnimation(arcadePulse);

    if (status === 'spinning') {
      arcadePulse.value = 0;
      arcadePulse.value = withRepeat(
        withTiming(1, {
          duration: ARCADE_PULSE_DURATION,
          easing: Easing.linear,
        }),
        -1,
        false,
      );

      return () => cancelAnimation(arcadePulse);
    }

    arcadePulse.value = withTiming(ARCADE_IDLE_GLOW, {
      duration: 240,
      easing: Easing.out(Easing.quad),
    });
  }, [arcadePulse, status]);

  useEffect(() => {
    if (currentStep === 'home') {
      return;
    }

    secretLogoTapCountRef.current = 0;
    lastSecretLogoTapAtRef.current = 0;
  }, [currentStep]);

  useEffect(() => {
    setAdminAppBlockNotice(
      slotConfig.appBlocked
        ? 'La app esta bloqueada en este dispositivo.'
        : 'La app esta disponible para participar.',
    );
  }, [slotConfig.appBlocked]);

  useEffect(() => {
    if (!slotConfig.appBlocked) {
      return;
    }

    if (currentStep === 'leadCapture' || currentStep === 'slot') {
      setEmailError('');
      resetSlotState();
      setCurrentStep('home');
    }
  }, [currentStep, slotConfig.appBlocked]);

  useEffect(() => {
    if (currentStep !== 'slot') {
      setIsSpinPrimed(false);
      return;
    }

    setIsSpinPrimed(false);

    const timer = setTimeout(() => {
      setIsSpinPrimed(true);
    }, SLOT_ENTRY_GUARD_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [currentStep]);

  const ready =
    assetsReady &&
    slotConfigReady &&
    storageReady &&
    (leagueLoaded || !!leagueError) &&
    (dmLoaded || !!dmError);

  const layout = useMemo(() => {
    const pageWidth = Math.min(width, 1280);
    const compact = pageWidth < 900;
    const frameWidth = clamp(compact ? pageWidth - 28 : pageWidth - 160, 300, compact ? 420 : 860);
    const machineShellHorizontalPadding = compact ? 14 : 22;
    const machineShellVerticalPadding = compact ? 20 : 24;
    const machineCoreMargin = compact ? 10 : 16;
    const machineCorePadding = compact ? 8 : 12;
    const innerPadding = compact ? 8 : 24;
    const reelGap = compact ? 10 : 18;
    const reelLaneWidth =
      frameWidth -
      machineShellHorizontalPadding * 2 -
      machineCoreMargin * 2 -
      machineCorePadding * 2;
    const reelWidth = (reelLaneWidth - innerPadding * 2 - reelGap * 2) / 3;
    const reelHeight = clamp(compact ? reelWidth * 1.86 : reelWidth * 1.36, 132, compact ? 210 : 276);

    return {
      compact,
      emailPanelWidth: clamp(compact ? pageWidth - 18 : pageWidth - 150, 320, compact ? 470 : 1040),
      frameWidth,
      headlineWidth: compact ? 320 : 920,
      homePanelWidth: clamp(compact ? pageWidth - 18 : pageWidth - 160, 320, compact ? 470 : 980),
      logoSize: compact ? 96 : 148,
      machineCoreMargin,
      machineCorePadding,
      machineRadius: compact ? 34 : 50,
      machineShellHorizontalPadding,
      machineShellVerticalPadding,
      pageHorizontal: compact ? 14 : 28,
      pageVertical: compact ? 24 : 42,
      reelGap,
      reelHeight,
      reelWidth,
      reelsHorizontalPadding: innerPadding,
      subtitleSize: compact ? 16 : 20,
      titleSize: compact ? 28 : 54,
    };
  }, [width]);

  const resetSlotState = () => {
    pendingResultRef.current = null;
    completedReelsRef.current = 0;
    setCurrentReels(INITIAL_REELS);
    setTargetReels(INITIAL_REELS);
    setSpinToken(0);
    setStatus('idle');
    setHasTriggeredConfetti(false);
    setResultModal(createDefaultResultModal());
  };

  const refreshAdminSnapshot = async () => {
    setAdminLoading(true);

    try {
      const recentLeads = await getRecentLeads(RECENT_LEADS_LIMIT);
      setAdminRecentLeads(recentLeads);
    } catch {
      setAdminNotice('No pudimos leer los datos guardados en este telefono.');
    } finally {
      setAdminLoading(false);
    }
  };

  const openAdminScreen = async () => {
    setAdminNotice('');
    setAdminConfigNotice('Se aplica desde la siguiente jugada.');
    setAdminConfigNoticeTone('neutral');
    setAdminAppBlockNotice(
      slotConfig.appBlocked
        ? 'La app esta bloqueada en este dispositivo.'
        : 'La app esta disponible para participar.',
    );
    setCurrentStep('admin');
    await refreshAdminSnapshot();
  };

  const handleOpenLeadCapture = () => {
    if (slotConfig.appBlocked) {
      return;
    }

    setEmailError('');
    setCurrentStep('leadCapture');
  };

  const handleEmailChange = (value: string) => {
    setCapturedEmail(value);

    if (emailError) {
      setEmailError('');
    }
  };

  const handleEmailSubmit = async () => {
    if (isSavingLead) {
      return;
    }

    const normalizedEmail = capturedEmail.trim();

    if (!isValidEmail(normalizedEmail)) {
      setEmailError('Ingresa un correo valido para activar la maquina.');
      return;
    }

    if (!storageReady) {
      setEmailError(storageError || 'La base local todavia no esta lista en este dispositivo.');
      return;
    }

    try {
      setIsSavingLead(true);
      await saveLead(normalizedEmail);
      setCapturedEmail(normalizedEmail);
      setEmailError('');
      resetSlotState();
      setCurrentStep('slot');
    } catch {
      setEmailError('No pudimos guardar el correo en la base local. Intenta nuevamente.');
    } finally {
      setIsSavingLead(false);
    }
  };

  const handleGoBackHome = () => {
    setEmailError('');
    setAdminNotice('');
    setAdminConfigNotice('Se aplica desde la siguiente jugada.');
    setAdminConfigNoticeTone('neutral');
    setCurrentStep('home');
  };

  const handleProbabilityComplete = async (value: number) => {
    const nextWinProbabilityPercent = Math.round(clamp(value, 0, 100));

    if (nextWinProbabilityPercent === slotConfig.winProbabilityPercent) {
      setAdminConfigNotice('Se aplica desde la siguiente jugada.');
      setAdminConfigNoticeTone('neutral');
      return;
    }

    try {
      setIsSavingSlotConfig(true);

      const nextConfig = await saveSlotMachineConfig({
        ...slotConfig,
        winProbabilityPercent: nextWinProbabilityPercent,
      });

      setSlotConfig(nextConfig);
      setAdminConfigNotice('Guardado en este dispositivo.');
      setAdminConfigNoticeTone('success');
    } catch {
      setAdminConfigNotice('No pudimos guardar este ajuste.');
      setAdminConfigNoticeTone('error');
    } finally {
      setIsSavingSlotConfig(false);
    }
  };

  const handleAppBlockChange = async (value: boolean) => {
    if (value === slotConfig.appBlocked) {
      return;
    }

    try {
      setIsSavingAppBlock(true);

      const nextConfig = await saveSlotMachineConfig({
        ...slotConfig,
        appBlocked: value,
      });

      setSlotConfig(nextConfig);
      setAdminAppBlockNotice(
        value ? 'Bloqueo activado en este dispositivo.' : 'Bloqueo desactivado. La app vuelve a estar abierta.',
      );
    } catch {
      setAdminAppBlockNotice('No pudimos guardar el bloqueo de la app.');
    } finally {
      setIsSavingAppBlock(false);
    }
  };

  const handleSecretLogoPress = () => {
    const now = Date.now();
    const withinSequenceWindow = now - lastSecretLogoTapAtRef.current <= SECRET_LOGO_TAP_WINDOW_MS;

    secretLogoTapCountRef.current = withinSequenceWindow ? secretLogoTapCountRef.current + 1 : 1;
    lastSecretLogoTapAtRef.current = now;

    if (secretLogoTapCountRef.current < SECRET_LOGO_TAP_TARGET) {
      return;
    }

    secretLogoTapCountRef.current = 0;
    lastSecretLogoTapAtRef.current = 0;
    void openAdminScreen();
  };

  const handleExportLeads = async () => {
    if (isExportingLeads) {
      return;
    }

    setAdminNotice('');
    setIsExportingLeads(true);

    try {
      const exportResult = await exportLeadsCsv();
      const sharingAvailable = await Sharing.isAvailableAsync();

      if (sharingAvailable) {
        await Sharing.shareAsync(exportResult.fileUri, {
          dialogTitle: 'Exportar leads MED',
          mimeType: 'text/csv',
        });
      }

      setAdminNotice(
        sharingAvailable
          ? `CSV listo con ${exportResult.totalLeads} registros.`
          : `CSV generado en el dispositivo: ${exportResult.fileName}`,
      );
    } catch {
      setAdminNotice('No pudimos generar el archivo CSV en este dispositivo.');
    } finally {
      setIsExportingLeads(false);
    }
  };

  const handleSpin = () => {
    if (currentStep !== 'slot' || !isSpinPrimed || status === 'spinning') {
      return;
    }

    const result = createSpinResult(slotConfig.winProbabilityPercent);
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
    resetSlotState();
    setCurrentStep('home');
  };

  const statusCopy =
    status === 'spinning'
      ? 'Tus equipos ya estan girando.'
      : '';
  const machineDepthX = layout.compact ? 10 : 22;
  const machineDepthY = layout.compact ? 14 : 24;
  const sideLightSize = layout.compact ? 10 : 14;

  if (storageError) {
    return (
      <LinearGradient colors={BRAND_GRADIENTS.page} style={styles.loadingScreen}>
        <View style={styles.loadingCard}>
          <Image source={MED_LOGO} resizeMode="contain" style={styles.loadingLogo} />
          <Text style={styles.loadingTitle}>No pudimos iniciar la base local</Text>
          <Text style={styles.loadingBody}>
            Reintenta antes de usar la app para asegurarnos de que todos los correos se guarden offline.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => setStorageRetryToken((value) => value + 1)}
            style={({ pressed }) => [styles.retryPressable, pressed && styles.retryPressed]}
          >
            <LinearGradient colors={BRAND_GRADIENTS.primaryButton} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>REINTENTAR</Text>
            </LinearGradient>
          </Pressable>
        </View>
        <StatusBar style="dark" />
      </LinearGradient>
    );
  }

  if (!ready) {
    return (
      <LinearGradient colors={BRAND_GRADIENTS.page} style={styles.loadingScreen}>
        <View style={styles.loadingCard}>
          <Image source={MED_LOGO} resizeMode="contain" style={styles.loadingLogo} />
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.loadingTitle}>Preparando la maquina MED...</Text>
          <Text style={styles.loadingBody}>Cargando branding, premios, ajustes y animaciones.</Text>
        </View>
        <StatusBar style="dark" />
      </LinearGradient>
    );
  }

  return (
    <View style={styles.page}>
      <LinearGradient colors={BRAND_GRADIENTS.page} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.backgroundBloom, styles.backgroundBloomPrimary]} />
      <View style={[styles.backgroundBloom, styles.backgroundBloomSecondary]} />
      <View style={[styles.backgroundBloom, styles.backgroundBloomTertiary]} />

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
        {currentStep === 'home' ? (
          <IntroHomeScreen
            compact={layout.compact}
            isAppBlocked={slotConfig.appBlocked}
            lockedMessage="Acercate mas tarde para participar."
            logoSize={layout.logoSize}
            onContinue={handleOpenLeadCapture}
            onLogoPress={handleSecretLogoPress}
            panelWidth={layout.homePanelWidth}
            titleSize={layout.titleSize}
          />
        ) : null}

        {currentStep === 'leadCapture' ? (
          <EmailCaptureScreen
            compact={layout.compact}
            disabled={isSavingLead}
            email={capturedEmail}
            errorMessage={emailError}
            onBack={handleGoBackHome}
            onChangeEmail={handleEmailChange}
            onSubmit={handleEmailSubmit}
            panelWidth={layout.emailPanelWidth}
            submitLabel={isSavingLead ? 'GUARDANDO...' : 'Registrarme'}
          />
        ) : null}

        {currentStep === 'admin' ? (
          <AdminScreen
            appBlocked={slotConfig.appBlocked}
            compact={layout.compact}
            isExporting={isExportingLeads}
            isLoading={adminLoading}
            isSavingAppBlock={isSavingAppBlock}
            isSavingProbability={isSavingSlotConfig}
            lockNoticeMessage={adminAppBlockNotice}
            noticeMessage={adminNotice}
            onAppBlockChange={handleAppBlockChange}
            onBack={handleGoBackHome}
            onExport={handleExportLeads}
            onProbabilityComplete={handleProbabilityComplete}
            panelWidth={layout.emailPanelWidth}
            probabilityNoticeMessage={adminConfigNotice}
            probabilityNoticeTone={adminConfigNoticeTone}
            recentLeads={adminRecentLeads}
            winProbabilityPercent={slotConfig.winProbabilityPercent}
          />
        ) : null}

        {currentStep === 'slot' ? (
          <>
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
                    colors={BRAND_GRADIENTS.machineDepth}
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
                    colors={BRAND_GRADIENTS.machineShell}
                    end={{ x: 1, y: 1 }}
                    start={{ x: 0, y: 0 }}
                    style={[
                      styles.machineShell,
                      {
                        borderRadius: layout.machineRadius,
                        paddingHorizontal: layout.machineShellHorizontalPadding,
                        paddingVertical: layout.machineShellVerticalPadding,
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
                        <ArcadeBulb
                          active={status === 'spinning'}
                          index={light}
                          key={`left-light-${light}`}
                          pulse={arcadePulse}
                          side="left"
                          size={sideLightSize}
                        />
                      ))}
                    </View>

                    <View style={[styles.machineEdgeStrip, styles.machineEdgeStripRight]}>
                      {ARCADE_LIGHTS.map((light) => (
                        <ArcadeBulb
                          active={status === 'spinning'}
                          index={light}
                          key={`right-light-${light}`}
                          pulse={arcadePulse}
                          side="right"
                          size={sideLightSize}
                        />
                      ))}
                    </View>

                    <LinearGradient
                      colors={BRAND_GRADIENTS.machineCore}
                      style={[
                        styles.machineCore,
                        {
                          borderRadius: layout.machineRadius - 12,
                          margin: layout.machineCoreMargin,
                          padding: layout.machineCorePadding,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.reelsRow,
                          {
                            gap: layout.reelGap,
                            paddingHorizontal: layout.reelsHorizontalPadding,
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
                  disabled={!isSpinPrimed || status === 'spinning'}
                  onPress={handleSpin}
                  spinToken={spinToken}
                />
              </View>
            </View>

            <View style={styles.footerCopy}>
              {statusCopy ? <Text style={styles.statusCopy}>{statusCopy}</Text> : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      <CelebrationConfetti active={hasTriggeredConfetti} burstKey={confettiBurstKey} />

      <ResultModal
        isOpen={resultModal.isOpen}
        message={resultModal.message}
        onClose={closeModal}
        title={resultModal.variant === 'win' ? 'Ganaste' : 'Perdiste'}
        variant={resultModal.variant}
      />

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BRAND_COLORS.pageTop,
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  backgroundBloom: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.7,
  },
  backgroundBloomPrimary: {
    width: 460,
    height: 460,
    top: -140,
    right: -120,
    backgroundColor: BRAND_COLORS.bloomPrimary,
  },
  backgroundBloomSecondary: {
    width: 380,
    height: 380,
    bottom: -100,
    left: -90,
    backgroundColor: BRAND_COLORS.bloomSecondary,
  },
  backgroundBloomTertiary: {
    width: 300,
    height: 300,
    top: '34%',
    left: '38%',
    backgroundColor: BRAND_COLORS.bloomTertiary,
    opacity: 0.32,
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
    color: BRAND_COLORS.primary,
    letterSpacing: 2.6,
    marginBottom: 12,
    textAlign: 'center',
  },
  heroTitle: {
    fontFamily: 'LeagueSpartan_700Bold',
    color: BRAND_COLORS.primary,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: 'DMSans_500Medium',
    color: BRAND_COLORS.textSecondary,
    marginTop: 12,
    maxWidth: 680,
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
    position: 'relative',
  },
  machineCabinet: {
    position: 'relative',
  },
  machineDepthShadow: {
    position: 'absolute',
    borderRadius: 48,
    backgroundColor: 'rgba(4, 27, 67, 0.24)',
    shadowColor: BRAND_COLORS.shadowStrong,
    shadowOpacity: 0.22,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  machineDepthPlate: {
    position: 'absolute',
    shadowColor: BRAND_COLORS.shadowStrong,
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
    shadowColor: BRAND_COLORS.shadowStrong,
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
    left: 8,
  },
  machineEdgeStripRight: {
    right: 8,
  },
  arcadeBulbSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  arcadeBulbHalo: {
    position: 'absolute',
    backgroundColor: 'rgba(225, 240, 255, 0.72)',
  },
  arcadeBulb: {
    backgroundColor: '#e7f1ff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#d7ebff',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
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
    backgroundColor: BRAND_COLORS.white,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  leverWrap: {
    position: 'absolute',
    top: '50%',
    alignItems: 'center',
    justifyContent: 'center',
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
    shadowColor: BRAND_COLORS.shadowStrong,
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
    borderRadius: 600,
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
    shadowColor: BRAND_COLORS.primary,
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
    color: BRAND_COLORS.primary,
    letterSpacing: 1.8,
    textAlign: 'center',
  },
  statusCopy: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: BRAND_COLORS.textSecondary,
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
    shadowColor: BRAND_COLORS.primary,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  loadingLogo: {
    width: 92,
    height: 92,
  },
  retryPressable: {
    width: '100%',
  },
  retryPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.985 }],
  },
  retryButton: {
    width: '100%',
    minHeight: 64,
    justifyContent: 'center',
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 20,
    color: BRAND_COLORS.white,
    textAlign: 'center',
  },
  loadingTitle: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 26,
    textAlign: 'center',
    color: BRAND_COLORS.primary,
  },
  loadingBody: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#47668f',
  },
});
