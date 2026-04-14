  import { Asset } from 'expo-asset';
import { DMSans_500Medium, DMSans_700Bold, useFonts as useDMSans } from '@expo-google-fonts/dm-sans';
import {
  LeagueSpartan_600SemiBold,
  LeagueSpartan_700Bold,
  useFonts as useLeagueSpartan,
} from '@expo-google-fonts/league-spartan';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  Platform,
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

import { AdminScreen, type AdminLeadsLoadState } from './src/components/AdminScreen';
import { BrandSurface } from './src/components/BrandSurface';
import { CelebrationConfetti } from './src/components/CelebrationConfetti';
import { EmailCaptureScreen } from './src/components/EmailCaptureScreen';
import { IntroHomeScreen } from './src/components/IntroHomeScreen';
import { ResultModal } from './src/components/ResultModal';
import { SlotReel } from './src/components/SlotReel';
import { MED_LOGO, SLOT_SYMBOLS } from './src/data/slotSymbols';
import {
  clearLeads,
  exportLeadsCsv,
  getRecentLeads,
  initDatabase,
  saveLead,
} from './src/services/leadsStorage';
import { loadSlotMachineConfig, saveSlotMachineConfig } from './src/services/slotConfigStorage';
import { BRAND_COLORS, BRAND_GRADIENTS } from './src/theme/brand';
import { LeadEntry } from './src/types/leads';
import {
  EventDay,
  GameStatus,
  ResultModalState,
  SlotMachineConfig,
  SlotSymbol,
  SpinResult,
} from './src/types/slot';
import {
  adjustAwardedPrizeCount,
  clampNonNegativeInteger,
  DEFAULT_AWARDED_PRIZE_COUNTS,
  getEventDayLabel,
  getPrizeQuotaSummary,
  reservePrizeForCurrentDay,
  validateDailyPrizeLimitChange,
} from './src/utils/prizeQuota';
import { createDefaultSlotMachineConfig } from './src/utils/slotConfig';

const WIN_MESSAGE = 'Felicitaciones! Ganaste un premio sorpresa.';
const LOSE_MESSAGE = '';
const INITIAL_REELS = [SLOT_SYMBOLS[0], SLOT_SYMBOLS[4], SLOT_SYMBOLS[8]];
const BASE_REEL_DURATION = 3200;
const REEL_DURATION_STEP = 520;
const REEL_SPIN_DELAY = 360;
const CONFETTI_VISIBLE_MS = 9700;
const LEGACY_CONFETTI_VISIBLE_MS = 2800;
const ARCADE_LIGHTS = Array.from({ length: 7 }, (_, index) => index);
const ARCADE_PULSE_DURATION = 1280;
const ARCADE_IDLE_GLOW = 0.2;
const ARCADE_LIGHT_PHASE_STEP = 0.64;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SECRET_LOGO_TAP_TARGET = 5;
const SECRET_LOGO_TAP_WINDOW_MS = 900;
const RECENT_LEADS_LIMIT = 20;
const SLOT_ENTRY_GUARD_MS = 450;
const RETURN_HOME_DELAY_MS = 220;
const RETURN_HOME_LEGACY_DELAY_MS = 32;

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

function createWinningSpinResult(): SpinResult {
  const winningSymbol = pickRandomSymbol();

  return {
    reels: [winningSymbol, winningSymbol, winningSymbol],
    isWin: true,
  };
}

function createLosingSpinResult(): SpinResult {
  const reels = [pickRandomSymbol(), pickRandomSymbol(), pickRandomSymbol()];

  while (reels[0].id === reels[1].id && reels[1].id === reels[2].id) {
    reels[2] = pickRandomSymbol([reels[0].id]);
  }

  return {
    reels,
    isWin: false,
  };
}

function createSpinResult(winProbabilityPercent: number): SpinResult {
  const winProbability = clamp(winProbabilityPercent, 0, 100) / 100;

  return Math.random() < winProbability ? createWinningSpinResult() : createLosingSpinResult();
}

function getPrizeQuotaNoticeState(config: SlotMachineConfig): {
  message: string;
  tone: AdminConfigNoticeTone;
} {
  const summary = getPrizeQuotaSummary(config);

  if (summary.isTotalExhausted) {
    return {
      message: 'Todos los premios del evento ya fueron entregados. La maquina sigue operativa, pero no dara mas premios.',
      tone: 'error',
    };
  }

  if (summary.isCurrentDayExhausted) {
    return {
      message: `${getEventDayLabel(summary.currentEventDay)} agotado. La maquina sigue operativa, pero ya no entrega premios hoy.`,
      tone: 'error',
    };
  }

  return {
    message: `${getEventDayLabel(summary.currentEventDay)} activo. Quedan ${summary.currentDayRemaining} premios hoy.`,
    tone: 'neutral',
  };
}

function getSavedPrizeQuotaNoticeState(config: SlotMachineConfig, prefix: string): {
  message: string;
  tone: AdminConfigNoticeTone;
} {
  const idleState = getPrizeQuotaNoticeState(config);

  return {
    message: `${prefix} ${idleState.message}`,
    tone: idleState.tone === 'error' ? 'error' : 'success',
  };
}

function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value.trim());
}

type LeverButtonProps = {
  compact: boolean;
  disabled: boolean;
  legacyVisualMode: boolean;
  onPress: () => void;
  spinToken: number;
};

function LeverButton({ compact, disabled, legacyVisualMode, onPress, spinToken }: LeverButtonProps) {
  const pullProgress = useSharedValue(0);

  useEffect(() => {
    if (!spinToken) {
      return () => cancelAnimation(pullProgress);
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

    return () => cancelAnimation(pullProgress);
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
          <BrandSurface
            colors={BRAND_GRADIENTS.leverMount}
            enabled={!legacyVisualMode}
            end={{ x: 0, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={[styles.leverMount, legacyVisualMode && styles.leverMountLegacy]}
          />

          <Animated.View style={[styles.leverPivot, leverPivotStyle]}>
            <BrandSurface
              colors={BRAND_GRADIENTS.metallic}
              enabled={!legacyVisualMode}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={[styles.leverRod, legacyVisualMode && styles.leverRodLegacy]}
            />
            <View style={[styles.leverKnob, legacyVisualMode && styles.leverKnobLegacy]}>
              <BrandSurface
                colors={BRAND_GRADIENTS.leverKnob}
                enabled={!legacyVisualMode}
                style={[styles.leverKnobCore, legacyVisualMode && styles.leverKnobCoreLegacy]}
              />
              <View style={[styles.leverKnobHighlight, legacyVisualMode && styles.leverKnobHighlightLegacy]} />
            </View>
          </Animated.View>

          <BrandSurface
            colors={BRAND_GRADIENTS.socket}
            enabled={!legacyVisualMode}
            end={{ x: 1, y: 1 }}
            start={{ x: 0.1, y: 0.1 }}
            style={[styles.leverSocket, legacyVisualMode && styles.leverSocketLegacy]}
          />
        </View>
      </Pressable>
    </View>
  );
}

type ArcadeBulbProps = {
  active: boolean;
  index: number;
  legacyVisualMode: boolean;
  pulse: { value: number };
  side: 'left' | 'right';
  size: number;
};

function ArcadeBulb({ active, index, legacyVisualMode, pulse, side, size }: ArcadeBulbProps) {
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

  if (legacyVisualMode) {
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
        <View
          style={[
            styles.arcadeBulb,
            styles.arcadeBulbLegacy,
            {
              borderRadius: size / 2,
              height: size,
              width: size,
            },
          ]}
        />
      </View>
    );
  }

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
  const androidApiLevel =
    Platform.OS === 'android'
      ? typeof Platform.Version === 'number'
        ? Platform.Version
        : Number.parseInt(String(Platform.Version), 10)
      : null;
  const legacyVisualMode =
    Platform.OS === 'android' && (Platform.isTV || (androidApiLevel !== null && androidApiLevel <= 28));
  const initialPrizeQuotaNoticeState = getPrizeQuotaNoticeState(createDefaultSlotMachineConfig());
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
  const [adminDeferredReady, setAdminDeferredReady] = useState(false);
  const [adminLeadsLoadState, setAdminLeadsLoadState] = useState<AdminLeadsLoadState>('idle');
  const [adminNotice, setAdminNotice] = useState('');
  const [adminConfigNotice, setAdminConfigNotice] = useState('Se aplica desde la siguiente jugada.');
  const [adminConfigNoticeTone, setAdminConfigNoticeTone] = useState<AdminConfigNoticeTone>('neutral');
  const [isSavingSlotConfig, setIsSavingSlotConfig] = useState(false);
  const [isSavingAppBlock, setIsSavingAppBlock] = useState(false);
  const [isSavingPrizeQuota, setIsSavingPrizeQuota] = useState(false);
  const [adminAppBlockNotice, setAdminAppBlockNotice] = useState('La app esta disponible para participar.');
  const [prizeQuotaNotice, setPrizeQuotaNotice] = useState(initialPrizeQuotaNoticeState.message);
  const [prizeQuotaNoticeTone, setPrizeQuotaNoticeTone] = useState<AdminConfigNoticeTone>(
    initialPrizeQuotaNoticeState.tone,
  );
  const [isExportingLeads, setIsExportingLeads] = useState(false);
  const [isClearingLeads, setIsClearingLeads] = useState(false);
  const [isResettingPrizes, setIsResettingPrizes] = useState(false);
  const [isSpinPending, setIsSpinPending] = useState(false);
  const [isReturningHome, setIsReturningHome] = useState(false);
  const [flowResetToken, setFlowResetToken] = useState(0);

  const pendingResultRef = useRef<SpinResult | null>(null);
  const completedReelsRef = useRef(0);
  const secretLogoTapCountRef = useRef(0);
  const lastSecretLogoTapAtRef = useRef(0);
  const currentStepRef = useRef<AppStep>('home');
  const slotConfigRef = useRef(slotConfig);
  const configSaveLockRef = useRef(false);
  const spinLockRef = useRef(false);
  const adminHydrationTokenRef = useRef(0);
  const adminSnapshotRequestRef = useRef(0);
  const adminDeferredTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotEntryGuardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnHomeTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const returnHomeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReturningHomeRef = useRef(false);
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
    slotConfigRef.current = slotConfig;
  }, [slotConfig]);

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
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = null;
    }

    if (!hasTriggeredConfetti) {
      return;
    }

    confettiTimeoutRef.current = setTimeout(() => {
      confettiTimeoutRef.current = null;
      setHasTriggeredConfetti(false);
    }, legacyVisualMode ? LEGACY_CONFETTI_VISIBLE_MS : CONFETTI_VISIBLE_MS);

    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = null;
      }
    };
  }, [hasTriggeredConfetti, legacyVisualMode]);

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
    }

    if (status !== 'spinning') {
      arcadePulse.value = withTiming(ARCADE_IDLE_GLOW, {
        duration: 240,
        easing: Easing.out(Easing.quad),
      });
    }

    return () => cancelAnimation(arcadePulse);
  }, [arcadePulse, status]);

  useEffect(() => {
    currentStepRef.current = currentStep;

    if (currentStep !== 'admin') {
      adminDeferredTaskRef.current?.cancel();
      adminDeferredTaskRef.current = null;
      adminHydrationTokenRef.current += 1;
      adminSnapshotRequestRef.current += 1;
      setAdminDeferredReady(false);
      setAdminLeadsLoadState('idle');
    }

    if (currentStep === 'home') {
      return;
    }

    secretLogoTapCountRef.current = 0;
    lastSecretLogoTapAtRef.current = 0;
  }, [currentStep]);

  useEffect(
    () => () => {
      adminDeferredTaskRef.current?.cancel();
      adminDeferredTaskRef.current = null;
      adminHydrationTokenRef.current += 1;
      adminSnapshotRequestRef.current += 1;
      if (returnHomeTaskRef.current) {
        returnHomeTaskRef.current.cancel();
        returnHomeTaskRef.current = null;
      }
      if (returnHomeTimeoutRef.current) {
        clearTimeout(returnHomeTimeoutRef.current);
        returnHomeTimeoutRef.current = null;
      }
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = null;
      }
      if (slotEntryGuardTimeoutRef.current) {
        clearTimeout(slotEntryGuardTimeoutRef.current);
        slotEntryGuardTimeoutRef.current = null;
      }
      cancelAnimation(arcadePulse);
    },
    [arcadePulse],
  );

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
      if (returnHomeTaskRef.current) {
        returnHomeTaskRef.current.cancel();
        returnHomeTaskRef.current = null;
      }
      if (returnHomeTimeoutRef.current) {
        clearTimeout(returnHomeTimeoutRef.current);
        returnHomeTimeoutRef.current = null;
      }
      isReturningHomeRef.current = false;
      setIsReturningHome(false);
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = null;
      }
      if (slotEntryGuardTimeoutRef.current) {
        clearTimeout(slotEntryGuardTimeoutRef.current);
        slotEntryGuardTimeoutRef.current = null;
      }
      setEmailError('');
      pendingResultRef.current = null;
      completedReelsRef.current = 0;
      spinLockRef.current = false;
      setCurrentReels(INITIAL_REELS);
      setTargetReels(INITIAL_REELS);
      setSpinToken(0);
      setIsSpinPrimed(false);
      setIsSpinPending(false);
      setStatus('idle');
      setHasTriggeredConfetti(false);
      setResultModal(createDefaultResultModal());
      setFlowResetToken((value) => value + 1);
      setCurrentStep('home');
    }
  }, [currentStep, slotConfig.appBlocked]);

  useEffect(() => {
    if (slotEntryGuardTimeoutRef.current) {
      clearTimeout(slotEntryGuardTimeoutRef.current);
      slotEntryGuardTimeoutRef.current = null;
    }

    if (currentStep !== 'slot') {
      setIsSpinPrimed(false);
      return;
    }

    setIsSpinPrimed(false);

    slotEntryGuardTimeoutRef.current = setTimeout(() => {
      slotEntryGuardTimeoutRef.current = null;
      setIsSpinPrimed(true);
    }, SLOT_ENTRY_GUARD_MS);

    return () => {
      if (slotEntryGuardTimeoutRef.current) {
        clearTimeout(slotEntryGuardTimeoutRef.current);
        slotEntryGuardTimeoutRef.current = null;
      }
    };
  }, [currentStep]);

  const ready =
    assetsReady &&
    slotConfigReady &&
    storageReady &&
    (leagueLoaded || !!leagueError) &&
    (dmLoaded || !!dmError);

  const prizeQuotaSummary = useMemo(() => getPrizeQuotaSummary(slotConfig), [slotConfig]);
  const isMachineBusy = status === 'spinning' || isSpinPending || isReturningHome;

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

  const saveLatestSlotConfig = async (mutate: (current: SlotMachineConfig) => SlotMachineConfig) => {
    if (configSaveLockRef.current) {
      throw new Error('CONFIG_SAVE_IN_PROGRESS');
    }

    configSaveLockRef.current = true;

    try {
      const nextConfig = mutate(slotConfigRef.current);
      const savedConfig = await saveSlotMachineConfig(nextConfig);

      slotConfigRef.current = savedConfig;
      setSlotConfig(savedConfig);

      return savedConfig;
    } finally {
      configSaveLockRef.current = false;
    }
  };

  const cancelReturnHomeTransition = () => {
    if (returnHomeTaskRef.current) {
      returnHomeTaskRef.current.cancel();
      returnHomeTaskRef.current = null;
    }

    if (returnHomeTimeoutRef.current) {
      clearTimeout(returnHomeTimeoutRef.current);
      returnHomeTimeoutRef.current = null;
    }

    isReturningHomeRef.current = false;
    setIsReturningHome(false);
  };

  const clearSlotTransientState = (options: { preserveModal?: boolean } = {}) => {
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = null;
    }

    if (slotEntryGuardTimeoutRef.current) {
      clearTimeout(slotEntryGuardTimeoutRef.current);
      slotEntryGuardTimeoutRef.current = null;
    }

    pendingResultRef.current = null;
    completedReelsRef.current = 0;
    spinLockRef.current = false;
    setIsSpinPrimed(false);
    setIsSpinPending(false);
    setStatus('idle');
    setHasTriggeredConfetti(false);

    if (!options.preserveModal) {
      setResultModal(createDefaultResultModal());
    }
  };

  const resetSlotState = () => {
    clearSlotTransientState();
    setCurrentReels(INITIAL_REELS);
    setTargetReels(INITIAL_REELS);
    setSpinToken(0);
  };

  const finalizeReturnHome = () => {
    cancelReturnHomeTransition();
    resetSlotState();
    setFlowResetToken((value) => value + 1);
    setCurrentStep('home');
  };

  const scheduleReturnHome = () => {
    if (isReturningHomeRef.current) {
      return;
    }

    cancelReturnHomeTransition();
    isReturningHomeRef.current = true;
    setIsReturningHome(true);
    clearSlotTransientState({ preserveModal: true });
    setResultModal((previous) => ({ ...previous, isOpen: false }));

    returnHomeTaskRef.current = InteractionManager.runAfterInteractions(() => {
      returnHomeTaskRef.current = null;

      if (!isReturningHomeRef.current) {
        return;
      }

      returnHomeTimeoutRef.current = setTimeout(() => {
        returnHomeTimeoutRef.current = null;

        if (!isReturningHomeRef.current) {
          return;
        }

        finalizeReturnHome();
      }, legacyVisualMode ? RETURN_HOME_LEGACY_DELAY_MS : RETURN_HOME_DELAY_MS);
    });
  };

  const refreshAdminSnapshot = async (sessionToken: number, keepExistingSnapshot: boolean) => {
    const requestToken = adminSnapshotRequestRef.current + 1;
    adminSnapshotRequestRef.current = requestToken;
    setAdminLeadsLoadState(keepExistingSnapshot ? 'refreshing' : 'loading');

    try {
      const recentLeads = await getRecentLeads(RECENT_LEADS_LIMIT);

      if (
        currentStepRef.current !== 'admin' ||
        adminHydrationTokenRef.current !== sessionToken ||
        adminSnapshotRequestRef.current !== requestToken
      ) {
        return;
      }

      setAdminRecentLeads(recentLeads);
      setAdminLeadsLoadState('idle');
    } catch {
      if (
        currentStepRef.current !== 'admin' ||
        adminHydrationTokenRef.current !== sessionToken ||
        adminSnapshotRequestRef.current !== requestToken
      ) {
        return;
      }

      setAdminNotice('No pudimos leer los datos guardados en este telefono.');
      setAdminLeadsLoadState('error');
    }
  };

  const openAdminScreen = () => {
    const prizeQuotaState = getPrizeQuotaNoticeState(slotConfigRef.current);
    const hasCachedSnapshot = adminRecentLeads.length > 0;
    const sessionToken = adminHydrationTokenRef.current + 1;

    adminDeferredTaskRef.current?.cancel();
    adminDeferredTaskRef.current = null;
    adminHydrationTokenRef.current = sessionToken;
    adminSnapshotRequestRef.current += 1;

    setAdminNotice('');
    setAdminConfigNotice('Se aplica desde la siguiente jugada.');
    setAdminConfigNoticeTone('neutral');
    setPrizeQuotaNotice(prizeQuotaState.message);
    setPrizeQuotaNoticeTone(prizeQuotaState.tone);
    setAdminAppBlockNotice(
      slotConfigRef.current.appBlocked
        ? 'La app esta bloqueada en este dispositivo.'
        : 'La app esta disponible para participar.',
    );
    setAdminDeferredReady(false);
    setAdminLeadsLoadState('idle');
    setCurrentStep('admin');

    adminDeferredTaskRef.current = InteractionManager.runAfterInteractions(() => {
      adminDeferredTaskRef.current = null;

      if (currentStepRef.current !== 'admin' || adminHydrationTokenRef.current !== sessionToken) {
        return;
      }

      setAdminDeferredReady(true);
      void refreshAdminSnapshot(sessionToken, hasCachedSnapshot);
    });
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
      cancelReturnHomeTransition();
      resetSlotState();
      setCurrentStep('slot');
    } catch {
      setEmailError('No pudimos guardar el correo en la base local. Intenta nuevamente.');
    } finally {
      setIsSavingLead(false);
    }
  };

  const handleGoBackHome = () => {
    const prizeQuotaState = getPrizeQuotaNoticeState(slotConfigRef.current);

    cancelReturnHomeTransition();
    setEmailError('');
    setAdminNotice('');
    setAdminConfigNotice('Se aplica desde la siguiente jugada.');
    setAdminConfigNoticeTone('neutral');
    setPrizeQuotaNotice(prizeQuotaState.message);
    setPrizeQuotaNoticeTone(prizeQuotaState.tone);
    resetSlotState();
    setFlowResetToken((value) => value + 1);
    setCurrentStep('home');
  };

  const handleProbabilityComplete = async (value: number) => {
    const nextWinProbabilityPercent = Math.round(clamp(value, 0, 100));
    const currentConfig = slotConfigRef.current;

    if (nextWinProbabilityPercent === currentConfig.winProbabilityPercent) {
      setAdminConfigNotice('Se aplica desde la siguiente jugada.');
      setAdminConfigNoticeTone('neutral');
      return;
    }

    try {
      setIsSavingSlotConfig(true);
      const nextConfig = await saveLatestSlotConfig((activeConfig) => ({
        ...activeConfig,
        winProbabilityPercent: nextWinProbabilityPercent,
      }));

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
    if (value === slotConfigRef.current.appBlocked) {
      return;
    }

    try {
      setIsSavingAppBlock(true);
      await saveLatestSlotConfig((activeConfig) => ({
        ...activeConfig,
        appBlocked: value,
      }));

      setAdminAppBlockNotice(
        value ? 'Bloqueo activado en este dispositivo.' : 'Bloqueo desactivado. La app vuelve a estar abierta.',
      );
    } catch {
      setAdminAppBlockNotice('No pudimos guardar el bloqueo de la app.');
    } finally {
      setIsSavingAppBlock(false);
    }
  };

  const handleCurrentEventDayChange = async (day: EventDay) => {
    if (day === slotConfigRef.current.currentEventDay) {
      const prizeQuotaState = getPrizeQuotaNoticeState(slotConfigRef.current);
      setPrizeQuotaNotice(prizeQuotaState.message);
      setPrizeQuotaNoticeTone(prizeQuotaState.tone);
      return;
    }

    try {
      setIsSavingPrizeQuota(true);

      const nextConfig = await saveLatestSlotConfig((activeConfig) => ({
        ...activeConfig,
        currentEventDay: day,
      }));
      const nextNoticeState = getSavedPrizeQuotaNoticeState(nextConfig, `${getEventDayLabel(day)} activado.`);

      setPrizeQuotaNotice(nextNoticeState.message);
      setPrizeQuotaNoticeTone(nextNoticeState.tone);
    } catch {
      setPrizeQuotaNotice('No pudimos cambiar el dia activo en este dispositivo.');
      setPrizeQuotaNoticeTone('error');
    } finally {
      setIsSavingPrizeQuota(false);
    }
  };

  const handleDailyPrizeLimitComplete = async (day: EventDay, value: number) => {
    const normalizedLimit = clampNonNegativeInteger(value);
    const currentConfig = slotConfigRef.current;

    if (normalizedLimit === currentConfig.dailyPrizeLimits[day]) {
      const prizeQuotaState = getPrizeQuotaNoticeState(currentConfig);
      setPrizeQuotaNotice(prizeQuotaState.message);
      setPrizeQuotaNoticeTone(prizeQuotaState.tone);
      return;
    }

    const validationError = validateDailyPrizeLimitChange(currentConfig, day, normalizedLimit);

    if (validationError) {
      setPrizeQuotaNotice(validationError);
      setPrizeQuotaNoticeTone('error');
      return;
    }

    try {
      setIsSavingPrizeQuota(true);

      const nextConfig = await saveLatestSlotConfig((activeConfig) => ({
        ...activeConfig,
        dailyPrizeLimits: {
          ...activeConfig.dailyPrizeLimits,
          [day]: normalizedLimit,
        },
      }));
      const nextNoticeState = getSavedPrizeQuotaNoticeState(nextConfig, `${getEventDayLabel(day)} guardado.`);

      setPrizeQuotaNotice(nextNoticeState.message);
      setPrizeQuotaNoticeTone(nextNoticeState.tone);
    } catch {
      setPrizeQuotaNotice('No pudimos guardar el cupo diario en este dispositivo.');
      setPrizeQuotaNoticeTone('error');
    } finally {
      setIsSavingPrizeQuota(false);
    }
  };

  const handleAwardedPrizeCountAdjust = async (delta: -1 | 1) => {
    const currentConfig = slotConfigRef.current;
    const day = currentConfig.currentEventDay;
    const draftConfig = adjustAwardedPrizeCount(currentConfig, day, delta);

    if (draftConfig === currentConfig) {
      return;
    }

    try {
      setIsSavingPrizeQuota(true);

      const nextConfig = await saveLatestSlotConfig((activeConfig) =>
        adjustAwardedPrizeCount(activeConfig, activeConfig.currentEventDay, delta),
      );
      const nextNoticeState = getSavedPrizeQuotaNoticeState(nextConfig, `Conteo de ${getEventDayLabel(day)} actualizado.`);

      setPrizeQuotaNotice(nextNoticeState.message);
      setPrizeQuotaNoticeTone(nextNoticeState.tone);
    } catch {
      setPrizeQuotaNotice('No pudimos actualizar el conteo de premios en este dispositivo.');
      setPrizeQuotaNoticeTone('error');
    } finally {
      setIsSavingPrizeQuota(false);
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
    if (isExportingLeads || isClearingLeads || isResettingPrizes) {
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

  const handleSpin = async () => {
    if (currentStep !== 'slot' || !isSpinPrimed || isMachineBusy || spinLockRef.current) {
      return;
    }

    spinLockRef.current = true;
    setIsSpinPending(true);
    let didStartSpin = false;

    try {
      let result = createSpinResult(slotConfigRef.current.winProbabilityPercent);

      if (result.isWin) {
        try {
          const nextConfig = await saveLatestSlotConfig((activeConfig) => {
            const reservedConfig = reservePrizeForCurrentDay(activeConfig);

            if (!reservedConfig) {
              throw new Error('PRIZE_QUOTA_EXHAUSTED');
            }

            return reservedConfig;
          });
          const nextNoticeState = getSavedPrizeQuotaNoticeState(nextConfig, 'Premio reservado.');

          setPrizeQuotaNotice(nextNoticeState.message);
          setPrizeQuotaNoticeTone(nextNoticeState.tone);
        } catch (error) {
          const errorCode = error instanceof Error ? error.message : '';

          if (errorCode === 'PRIZE_QUOTA_EXHAUSTED') {
            const prizeQuotaState = getPrizeQuotaNoticeState(slotConfigRef.current);

            setPrizeQuotaNotice(prizeQuotaState.message);
            setPrizeQuotaNoticeTone(prizeQuotaState.tone);
          } else if (errorCode === 'CONFIG_SAVE_IN_PROGRESS') {
            setPrizeQuotaNotice(
              'Todavia estamos guardando un ajuste local. Esta jugada queda sin premio para evitar duplicados.',
            );
            setPrizeQuotaNoticeTone('error');
          } else {
            setPrizeQuotaNotice(
              'No pudimos reservar el premio en este dispositivo. Esta jugada queda sin premio para evitar inconsistencias.',
            );
            setPrizeQuotaNoticeTone('error');
          }

          result = createLosingSpinResult();
        }
      }

      pendingResultRef.current = result;
      completedReelsRef.current = 0;

      setTargetReels(result.reels);
      setResultModal((prev) => ({ ...prev, isOpen: false }));
      setStatus('spinning');
      setHasTriggeredConfetti(false);
      setSpinToken((value) => value + 1);
      didStartSpin = true;
    } finally {
      if (!didStartSpin) {
        spinLockRef.current = false;
      }

      setIsSpinPending(false);
    }
  };

  const confirmLeadReset = () =>
    new Promise<boolean>((resolve) => {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        resolve(window.confirm('Esto borrara todos los mails guardados en este dispositivo. Quieres continuar?'));
        return;
      }

      Alert.alert(
        'Borrar registros',
        'Esto borrara todos los mails guardados en este dispositivo. Esta accion no se puede deshacer.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Borrar',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
        {
          cancelable: true,
          onDismiss: () => resolve(false),
        },
      );
    });

  const handleClearLeads = async () => {
    if (isClearingLeads || isExportingLeads || isResettingPrizes) {
      return;
    }

    const shouldClear = await confirmLeadReset();

    if (!shouldClear) {
      return;
    }

    setAdminNotice('');
    setIsClearingLeads(true);

    try {
      await clearLeads();
      adminSnapshotRequestRef.current += 1;
      setAdminRecentLeads([]);
      setAdminLeadsLoadState('idle');
      setAdminNotice('Todos los mails fueron borrados de este dispositivo.');
    } catch {
      setAdminNotice('No pudimos borrar los mails guardados en este dispositivo.');
    } finally {
      setIsClearingLeads(false);
    }
  };

  const confirmPrizeReset = () =>
    new Promise<boolean>((resolve) => {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        resolve(window.confirm('Esto reiniciara a 0 los premios entregados en este dispositivo. Quieres continuar?'));
        return;
      }

      Alert.alert(
        'Resetear premios',
        'Esto reiniciara a 0 los premios entregados en este dispositivo. Esta accion no se puede deshacer.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Resetear',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
        {
          cancelable: true,
          onDismiss: () => resolve(false),
        },
      );
    });

  const handleResetPrizeCounts = async () => {
    if (isResettingPrizes || isClearingLeads || isExportingLeads) {
      return;
    }

    const shouldReset = await confirmPrizeReset();

    if (!shouldReset) {
      return;
    }

    setAdminNotice('');
    setIsResettingPrizes(true);

    try {
      const nextConfig = await saveLatestSlotConfig((activeConfig) => ({
        ...activeConfig,
        awardedPrizeCounts: { ...DEFAULT_AWARDED_PRIZE_COUNTS },
      }));
      const nextNoticeState = getSavedPrizeQuotaNoticeState(nextConfig, 'Premios entregados reiniciados.');

      setPrizeQuotaNotice(nextNoticeState.message);
      setPrizeQuotaNoticeTone(nextNoticeState.tone);
      setAdminNotice('Los premios entregados volvieron a 0 en este dispositivo.');
    } catch {
      setAdminNotice('No pudimos reiniciar el conteo de premios en este dispositivo.');
    } finally {
      setIsResettingPrizes(false);
    }
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
    scheduleReturnHome();
  };

  const statusCopy =
    status === 'spinning'
      ? ''
      : '';
  const machineDepthX = layout.compact ? 10 : 22;
  const machineDepthY = layout.compact ? 14 : 24;
  const sideLightSize = layout.compact ? 10 : 14;

  if (storageError) {
    return (
      <View style={[styles.loadingScreen, legacyVisualMode && styles.loadingScreenLegacy]}>
        <BrandSurface
          colors={BRAND_GRADIENTS.page}
          enabled={!legacyVisualMode}
          style={[StyleSheet.absoluteFillObject, legacyVisualMode && styles.pageBackdropLegacy]}
        />
        <View style={[styles.loadingCard, legacyVisualMode && styles.loadingCardLegacy]}>
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
            <BrandSurface
              colors={BRAND_GRADIENTS.primaryButton}
              enabled={!legacyVisualMode}
              style={[styles.retryButton, legacyVisualMode && styles.retryButtonLegacy]}
            >
              <Text style={styles.retryButtonText}>REINTENTAR</Text>
            </BrandSurface>
          </Pressable>
        </View>
        <StatusBar style="dark" />
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.loadingScreen, legacyVisualMode && styles.loadingScreenLegacy]}>
        <BrandSurface
          colors={BRAND_GRADIENTS.page}
          enabled={!legacyVisualMode}
          style={[StyleSheet.absoluteFillObject, legacyVisualMode && styles.pageBackdropLegacy]}
        />
        <View style={[styles.loadingCard, legacyVisualMode && styles.loadingCardLegacy]}>
          <Image source={MED_LOGO} resizeMode="contain" style={styles.loadingLogo} />
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.loadingTitle}>Preparando la maquina MED...</Text>
          <Text style={styles.loadingBody}>Cargando branding, premios, ajustes y animaciones.</Text>
        </View>
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <BrandSurface
        colors={BRAND_GRADIENTS.page}
        enabled={!legacyVisualMode}
        style={[StyleSheet.absoluteFillObject, legacyVisualMode && styles.pageBackdropLegacy]}
      />
      {!legacyVisualMode ? <View style={[styles.backgroundBloom, styles.backgroundBloomPrimary]} /> : null}
      {!legacyVisualMode ? <View style={[styles.backgroundBloom, styles.backgroundBloomSecondary]} /> : null}
      {!legacyVisualMode ? <View style={[styles.backgroundBloom, styles.backgroundBloomTertiary]} /> : null}

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
            legacyVisualMode={legacyVisualMode}
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
            legacyVisualMode={legacyVisualMode}
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
            awardedPrizeCounts={slotConfig.awardedPrizeCounts}
            compact={layout.compact}
            currentEventDay={slotConfig.currentEventDay}
            deferredReady={adminDeferredReady}
            dailyPrizeLimits={slotConfig.dailyPrizeLimits}
            isClearingLeads={isClearingLeads}
            isExporting={isExportingLeads}
            isSavingAppBlock={isSavingAppBlock}
            isSavingPrizeQuota={isSavingPrizeQuota}
            isSavingProbability={isSavingSlotConfig}
            isResettingPrizes={isResettingPrizes}
            legacyVisualMode={legacyVisualMode}
            leadsLoadState={adminLeadsLoadState}
            lockNoticeMessage={adminAppBlockNotice}
            noticeMessage={adminNotice}
            onAwardedCountAdjust={handleAwardedPrizeCountAdjust}
            onAppBlockChange={handleAppBlockChange}
            onBack={handleGoBackHome}
            onCurrentEventDayChange={handleCurrentEventDayChange}
            onDailyPrizeLimitComplete={handleDailyPrizeLimitComplete}
            onClearLeads={handleClearLeads}
            onExport={handleExportLeads}
            onProbabilityComplete={handleProbabilityComplete}
            onResetPrizes={handleResetPrizeCounts}
            panelWidth={layout.emailPanelWidth}
            prizeQuotaNoticeMessage={prizeQuotaNotice}
            prizeQuotaNoticeTone={prizeQuotaNoticeTone}
            prizeQuotaSummary={prizeQuotaSummary}
            probabilityNoticeMessage={adminConfigNotice}
            probabilityNoticeTone={adminConfigNoticeTone}
            recentLeads={adminRecentLeads}
            reducedEffects={legacyVisualMode}
            winProbabilityPercent={slotConfig.winProbabilityPercent}
          />
        ) : null}

        {currentStep === 'slot' ? (
          <Fragment key={`slot-session-${flowResetToken}`}>
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
                  {!legacyVisualMode ? (
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
                  ) : null}

                  <BrandSurface
                    colors={BRAND_GRADIENTS.machineDepth}
                    enabled={!legacyVisualMode}
                    end={{ x: 1, y: 1 }}
                    start={{ x: 0, y: 0 }}
                    style={[
                      styles.machineDepthPlate,
                      legacyVisualMode && styles.machineDepthPlateLegacy,
                      {
                        borderRadius: layout.machineRadius + 8,
                        bottom: 0,
                        left: machineDepthX,
                        right: 0,
                        top: machineDepthY,
                      },
                    ]}
                  />

                  <BrandSurface
                    colors={BRAND_GRADIENTS.machineShell}
                    enabled={!legacyVisualMode}
                    end={{ x: 1, y: 1 }}
                    start={{ x: 0, y: 0 }}
                    style={[
                      styles.machineShell,
                      legacyVisualMode && styles.machineShellLegacy,
                      {
                        borderRadius: layout.machineRadius,
                        paddingHorizontal: layout.machineShellHorizontalPadding,
                        paddingVertical: layout.machineShellVerticalPadding,
                        width: layout.frameWidth,
                      },
                    ]}
                  >
                    {!legacyVisualMode ? (
                      <BrandSurface
                        colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.05)', 'transparent']}
                        style={styles.machineGlossTop}
                      />
                    ) : null}

                    <View style={[styles.machineEdgeStrip, styles.machineEdgeStripLeft]}>
                      {ARCADE_LIGHTS.map((light) => (
                        <ArcadeBulb
                          active={status === 'spinning'}
                          index={light}
                          key={`left-light-${light}`}
                          legacyVisualMode={legacyVisualMode}
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
                          legacyVisualMode={legacyVisualMode}
                          pulse={arcadePulse}
                          side="right"
                          size={sideLightSize}
                        />
                      ))}
                    </View>

                    <BrandSurface
                      colors={BRAND_GRADIENTS.machineCore}
                      enabled={!legacyVisualMode}
                      style={[
                        styles.machineCore,
                        legacyVisualMode && styles.machineCoreLegacy,
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
                              legacyVisualMode && styles.reelFrameLegacy,
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
                              legacyVisualMode={legacyVisualMode}
                            />
                          </View>
                        ))}
                      </View>
                    </BrandSurface>
                  </BrandSurface>
                </View>

                <LeverButton
                  compact={layout.compact}
                  disabled={!isSpinPrimed || isMachineBusy}
                  legacyVisualMode={legacyVisualMode}
                  onPress={() => {
                    void handleSpin();
                  }}
                  spinToken={spinToken}
                />
              </View>
            </View>

            <View style={styles.footerCopy}>
              {statusCopy ? <Text style={styles.statusCopy}>{statusCopy}</Text> : null}
            </View>
          </Fragment>
        ) : null}
      </ScrollView>

      <CelebrationConfetti
        active={hasTriggeredConfetti}
        burstKey={confettiBurstKey}
        key={`confetti-${flowResetToken}`}
        reducedEffects={legacyVisualMode}
      />

      <ResultModal
        disableTransitions={legacyVisualMode}
        isOpen={resultModal.isOpen}
        key={`result-modal-${flowResetToken}`}
        legacyVisualMode={legacyVisualMode}
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
  machineDepthPlateLegacy: {
    backgroundColor: '#17468d',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
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
  machineShellLegacy: {
    backgroundColor: '#2466c1',
    borderColor: '#0d3b7d',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
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
  arcadeBulbLegacy: {
    backgroundColor: '#dbeafe',
    borderColor: '#aac8ef',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  machineCore: {
    padding: 12,
    overflow: 'hidden',
  },
  machineCoreLegacy: {
    backgroundColor: '#1b4e9b',
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
  reelFrameLegacy: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderWidth: 1,
    borderColor: '#c7dbf6',
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
  leverMountLegacy: {
    backgroundColor: '#0e3568',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
  leverRodLegacy: {
    backgroundColor: '#d6e2ef',
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
  leverSocketLegacy: {
    backgroundColor: '#9db3c8',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderWidth: 1,
    borderColor: '#5a6f8a',
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
  leverKnobLegacy: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderWidth: 1,
    borderColor: '#0a3978',
  },
  leverKnobCore: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  leverKnobCoreLegacy: {
    backgroundColor: '#4f9cff',
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
  leverKnobHighlightLegacy: {
    backgroundColor: 'rgba(255,255,255,0.22)',
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
  loadingScreenLegacy: {
    backgroundColor: BRAND_COLORS.pageMid,
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
  loadingCardLegacy: {
    backgroundColor: BRAND_COLORS.surface,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderWidth: 1,
    borderColor: '#c7dbf6',
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
  retryButtonLegacy: {
    backgroundColor: BRAND_COLORS.primary,
    borderWidth: 1,
    borderColor: BRAND_COLORS.primaryStrong,
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
  pageBackdropLegacy: {
    backgroundColor: BRAND_COLORS.pageMid,
  },
});
