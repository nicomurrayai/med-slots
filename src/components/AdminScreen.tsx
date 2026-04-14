import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BrandSurface } from './BrandSurface';
import { PrizeQuotaSection } from './PrizeQuotaSection';
import { LeadEntry } from '../types/leads';
import { EventDay, PrizeDayValues, PrizeQuotaSummary } from '../types/slot';
import { BRAND_COLORS, BRAND_GRADIENTS } from '../theme/brand';
import { formatLeadTimestamp } from '../utils/leads';

export type AdminLeadsLoadState = 'idle' | 'loading' | 'refreshing' | 'error';

type AdminScreenProps = {
  appBlocked: boolean;
  awardedPrizeCounts: PrizeDayValues;
  compact: boolean;
  currentEventDay: EventDay;
  deferredReady: boolean;
  dailyPrizeLimits: PrizeDayValues;
  isClearingLeads: boolean;
  isExporting: boolean;
  isResettingPrizes: boolean;
  isSavingAppBlock: boolean;
  isSavingPrizeQuota: boolean;
  isSavingProbability: boolean;
  leadsLoadState: AdminLeadsLoadState;
  legacyVisualMode?: boolean;
  lockNoticeMessage: string;
  noticeMessage: string;
  onAwardedCountAdjust: (delta: -1 | 1) => void;
  onBack: () => void;
  onAppBlockChange: (value: boolean) => void;
  onClearLeads: () => void;
  onCurrentEventDayChange: (day: EventDay) => void;
  onDailyPrizeLimitComplete: (day: EventDay, value: number) => void;
  onExport: () => void;
  onProbabilityComplete: (value: number) => void;
  onResetPrizes: () => void;
  panelWidth: number;
  prizeQuotaNoticeMessage: string;
  prizeQuotaNoticeTone: 'neutral' | 'success' | 'error';
  prizeQuotaSummary: PrizeQuotaSummary;
  probabilityNoticeMessage: string;
  probabilityNoticeTone: 'neutral' | 'success' | 'error';
  recentLeads: LeadEntry[];
  reducedEffects?: boolean;
  winProbabilityPercent: number;
};

type SectionCardProps = {
  children: ReactNode;
  legacyVisualMode?: boolean;
  reducedEffects?: boolean;
  title: string;
};

function SectionCard({ children, legacyVisualMode = false, reducedEffects = false, title }: SectionCardProps) {
  return (
    <View
      style={[
        styles.sectionCard,
        legacyVisualMode && styles.sectionCardLegacy,
        reducedEffects && styles.sectionCardReduced,
      ]}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function clampPercent(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function ProbabilityControlSection({
  compact,
  isSaving,
  legacyVisualMode,
  noticeMessage,
  noticeTone,
  onComplete,
  reducedEffects,
  winProbabilityPercent,
}: {
  compact: boolean;
  isSaving: boolean;
  legacyVisualMode: boolean;
  noticeMessage: string;
  noticeTone: 'neutral' | 'success' | 'error';
  onComplete: (value: number) => void;
  reducedEffects: boolean;
  winProbabilityPercent: number;
}) {
  const [draftValue, setDraftValue] = useState(winProbabilityPercent);
  const [inputValue, setInputValue] = useState(String(winProbabilityPercent));
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    setDraftValue(winProbabilityPercent);
    setInputValue(String(winProbabilityPercent));
  }, [winProbabilityPercent]);

  useEffect(() => {
    if (!isSaving && noticeTone === 'error') {
      setDraftValue(winProbabilityPercent);
      setInputValue(String(winProbabilityPercent));
    }
  }, [isSaving, noticeTone, winProbabilityPercent]);

  const commitDraftValue = (value: number) => {
    const nextValue = clampPercent(value);
    setDraftValue(nextValue);
    setInputValue(String(nextValue));
    void onComplete(nextValue);
  };

  const commitInputValue = () => {
    if (isSaving) {
      return;
    }

    const nextValue = inputValue.trim() === '' ? winProbabilityPercent : clampPercent(Number(inputValue));
    commitDraftValue(nextValue);
  };

  const handleInputChange = (value: string) => {
    const digitsOnly = value.replace(/[^\d]/g, '').slice(0, 3);

    if (!digitsOnly) {
      setInputValue('');
      return;
    }

    const nextValue = clampPercent(Number(digitsOnly));
    setDraftValue(nextValue);
    setInputValue(String(nextValue));
  };

  const isDirty = draftValue !== winProbabilityPercent;
  const displayNoticeMessage = isDirty ? 'Se aplica desde la siguiente jugada.' : noticeMessage;
  const displayNoticeTone = isDirty ? 'neutral' : noticeTone;

  return (
    <SectionCard legacyVisualMode={legacyVisualMode} reducedEffects={reducedEffects} title="Probabilidad">
      <Text style={styles.probabilityCopy}>Define el % de premio que la maquina intentara dar.</Text>

      <View style={styles.probabilityControlsColumn}>
        <View
          style={[
            styles.probabilityMeter,
            styles.probabilityMeterMain,
            reducedEffects && styles.probabilityMeterReduced,
          ]}
        >
          <Text style={styles.probabilityValue}>{draftValue}%</Text>
          <Text style={styles.probabilityHint}>Actual</Text>
        </View>

        <View
          style={[
            styles.probabilityMeter,
            styles.probabilityInputCard,
            reducedEffects && styles.probabilityMeterReduced,
          ]}
        >
          <Text style={styles.probabilityInputLabel}>Nuevo</Text>
          <View style={styles.probabilityInputWrap}>
            <TextInput
              accessibilityLabel="Porcentaje de premio"
              editable={!isSaving}
              keyboardType="number-pad"
              maxLength={3}
              onBlur={() => {
                if (skipBlurCommitRef.current) {
                  skipBlurCommitRef.current = false;
                  return;
                }

                commitInputValue();
              }}
              onChangeText={handleInputChange}
              onSubmitEditing={() => {
                skipBlurCommitRef.current = true;
                commitInputValue();
              }}
              selectTextOnFocus
              style={[styles.probabilityInput, isSaving && styles.probabilityInputDisabled]}
              value={inputValue}
            />
            <Text style={styles.probabilityInputSuffix}>%</Text>
          </View>
        </View>
      </View>

      <Text
        style={[
          styles.probabilityStatus,
          displayNoticeTone === 'success' && styles.probabilityStatusSuccess,
          displayNoticeTone === 'error' && styles.probabilityStatusError,
        ]}
      >
        {isSaving ? 'Guardando ajuste...' : displayNoticeMessage}
      </Text>
    </SectionCard>
  );
}

function AppBlockSection({
  compact,
  appBlocked,
  isSaving,
  legacyVisualMode,
  noticeMessage,
  onChange,
  reducedEffects,
}: {
  compact: boolean;
  appBlocked: boolean;
  isSaving: boolean;
  legacyVisualMode: boolean;
  noticeMessage: string;
  onChange: (value: boolean) => void;
  reducedEffects: boolean;
}) {
  return (
    <SectionCard legacyVisualMode={legacyVisualMode} reducedEffects={reducedEffects} title="Acceso">
      <View style={styles.toggleColumn}>
        <View style={styles.toggleCopy}>
          <Text style={styles.toggleTitle}>App bloqueada</Text>
        </View>

        <Switch
          accessibilityLabel="Bloquear app"
          disabled={isSaving}
          onValueChange={onChange}
          thumbColor={appBlocked ? BRAND_COLORS.white : '#f4f3f4'}
          trackColor={{ false: '#c2d2e6', true: BRAND_COLORS.primary }}
          value={appBlocked}
        />
      </View>

      <Text style={styles.toggleStatus}>{isSaving ? 'Guardando bloqueo...' : noticeMessage}</Text>
    </SectionCard>
  );
}

function RecentLeadsSection({
  compact,
  leadsLoadState,
  legacyVisualMode,
  recentLeads,
  reducedEffects,
}: {
  compact: boolean;
  leadsLoadState: AdminLeadsLoadState;
  legacyVisualMode: boolean;
  recentLeads: LeadEntry[];
  reducedEffects: boolean;
}) {
  const isInitialLoading = leadsLoadState === 'loading';
  const isRefreshing = leadsLoadState === 'refreshing';

  return (
    <SectionCard legacyVisualMode={legacyVisualMode} reducedEffects={reducedEffects} title="Registros">
      {isInitialLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="small" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      ) : null}

      {isRefreshing ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="small" />
          <Text style={styles.loadingText}>Actualizando...</Text>
        </View>
      ) : null}

      {!isInitialLoading && recentLeads.length === 0 ? (
        <View style={[styles.emptyState, reducedEffects && styles.emptyStateReduced]}>
          <Text style={styles.emptyTitle}>Sin registros.</Text>
        </View>
      ) : null}

      {!isInitialLoading && recentLeads.length > 0 ? (
        <View style={styles.leadsList}>
          {recentLeads.map((lead) => (
            <View
              key={lead.id}
              style={[
                styles.leadRow,
                compact && styles.leadRowCompact,
                reducedEffects && styles.leadRowReduced,
              ]}
            >
              <View style={styles.leadRowHeader}>
                <Text numberOfLines={1} style={styles.leadEmail}>
                  {lead.email}
                </Text>
                <Text style={styles.leadId}>#{lead.id}</Text>
              </View>
              <Text style={styles.leadDate}>{formatLeadTimestamp(lead.capturedAtMs)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </SectionCard>
  );
}

function AdminActionsSection({
  isClearingLeads,
  isExporting,
  isResettingPrizes,
  legacyVisualMode,
  noticeMessage,
  onClearLeads,
  onExport,
  onResetPrizes,
  reducedEffects,
}: {
  isClearingLeads: boolean;
  isExporting: boolean;
  isResettingPrizes: boolean;
  legacyVisualMode: boolean;
  noticeMessage: string;
  onClearLeads: () => void;
  onExport: () => void;
  onResetPrizes: () => void;
  reducedEffects: boolean;
}) {
  const isBusy = isExporting || isClearingLeads || isResettingPrizes;

  return (
    <SectionCard legacyVisualMode={legacyVisualMode} reducedEffects={reducedEffects} title="Datos">
      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onExport}
        style={({ pressed }) => [
          styles.actionButtonPressable,
          pressed && !isBusy && styles.actionButtonPressed,
          isBusy && styles.actionButtonDisabled,
        ]}
      >
        <BrandSurface
          colors={BRAND_GRADIENTS.primaryButton}
          enabled={!(legacyVisualMode || reducedEffects)}
          style={[
            styles.actionButton,
            (legacyVisualMode || reducedEffects) && styles.actionButtonLegacy,
            reducedEffects && styles.actionButtonReduced,
          ]}
        >
          <Text style={styles.actionButtonText}>{isExporting ? 'EXPORTANDO...' : 'EXPORTAR CSV'}</Text>
        </BrandSurface>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onClearLeads}
        style={({ pressed }) => [
          styles.secondaryActionPressable,
          pressed && !isBusy && styles.secondaryActionPressed,
          isBusy && styles.actionButtonDisabled,
        ]}
      >
        <View style={[styles.secondaryActionButton, reducedEffects && styles.secondaryActionButtonReduced]}>
          <Text style={styles.secondaryActionText}>{isClearingLeads ? 'BORRANDO...' : 'RESETEAR MAILS'}</Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onResetPrizes}
        style={({ pressed }) => [
          styles.secondaryActionPressable,
          pressed && !isBusy && styles.secondaryActionPressed,
          isBusy && styles.actionButtonDisabled,
        ]}
      >
        <View style={[styles.secondaryActionButton, reducedEffects && styles.secondaryActionButtonReduced]}>
          <Text style={styles.secondaryActionText}>
            {isResettingPrizes ? 'RESETEANDO...' : 'RESETEAR PREMIOS'}
          </Text>
        </View>
      </Pressable>

      {!!noticeMessage ? <Text style={styles.noticeMessage}>{noticeMessage}</Text> : null}
    </SectionCard>
  );
}

export function AdminScreen({
  appBlocked,
  awardedPrizeCounts,
  compact,
  currentEventDay,
  deferredReady,
  dailyPrizeLimits,
  isClearingLeads,
  isExporting,
  isResettingPrizes,
  isSavingAppBlock,
  isSavingPrizeQuota,
  isSavingProbability,
  leadsLoadState,
  legacyVisualMode = false,
  lockNoticeMessage,
  noticeMessage,
  onAwardedCountAdjust,
  onBack,
  onAppBlockChange,
  onClearLeads,
  onCurrentEventDayChange,
  onDailyPrizeLimitComplete,
  onExport,
  onProbabilityComplete,
  onResetPrizes,
  panelWidth,
  prizeQuotaNoticeMessage,
  prizeQuotaNoticeTone,
  prizeQuotaSummary,
  probabilityNoticeMessage,
  probabilityNoticeTone,
  recentLeads,
  reducedEffects = false,
  winProbabilityPercent,
}: AdminScreenProps) {
  const useReducedEffects = reducedEffects || legacyVisualMode;
  const cardBody = (
    <>
      <View style={[styles.headerColumn, useReducedEffects && styles.headerColumnReduced]}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>PANEL OCULTO</Text>
          <Text style={[styles.title, compact && styles.titleCompact]}>AJUSTES</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            useReducedEffects && styles.backButtonReduced,
            pressed && styles.backPressed,
          ]}
        >
          <Text style={styles.backText}>VOLVER</Text>
        </Pressable>
      </View>

      <ProbabilityControlSection
        compact={compact}
        isSaving={isSavingProbability}
        legacyVisualMode={legacyVisualMode}
        noticeMessage={probabilityNoticeMessage}
        noticeTone={probabilityNoticeTone}
        onComplete={onProbabilityComplete}
        reducedEffects={useReducedEffects}
        winProbabilityPercent={winProbabilityPercent}
      />
      <AppBlockSection
        compact={compact}
        appBlocked={appBlocked}
        isSaving={isSavingAppBlock}
        legacyVisualMode={legacyVisualMode}
        noticeMessage={lockNoticeMessage}
        onChange={onAppBlockChange}
        reducedEffects={useReducedEffects}
      />

      {deferredReady ? (
        <>
          <PrizeQuotaSection
            awardedPrizeCounts={awardedPrizeCounts}
            currentEventDay={currentEventDay}
            dailyPrizeLimits={dailyPrizeLimits}
            isSaving={isSavingPrizeQuota}
            noticeMessage={prizeQuotaNoticeMessage}
            noticeTone={prizeQuotaNoticeTone}
            onAwardedCountAdjust={onAwardedCountAdjust}
            onCurrentEventDayChange={onCurrentEventDayChange}
            onDailyPrizeLimitComplete={onDailyPrizeLimitComplete}
            prizeQuotaSummary={prizeQuotaSummary}
            reducedEffects={useReducedEffects}
          />
          <RecentLeadsSection
            compact={compact}
            leadsLoadState={leadsLoadState}
            legacyVisualMode={legacyVisualMode}
            recentLeads={recentLeads}
            reducedEffects={useReducedEffects}
          />
          <AdminActionsSection
            isClearingLeads={isClearingLeads}
            isExporting={isExporting}
            isResettingPrizes={isResettingPrizes}
            legacyVisualMode={legacyVisualMode}
            noticeMessage={noticeMessage}
            onClearLeads={onClearLeads}
            onExport={onExport}
            onResetPrizes={onResetPrizes}
            reducedEffects={useReducedEffects}
          />
        </>
      ) : null}
    </>
  );

  return (
    <View style={styles.stage}>
      {!useReducedEffects ? <View style={[styles.cardShadow, { maxWidth: panelWidth }]} /> : null}

      {useReducedEffects ? (
        <View style={[styles.card, styles.cardLegacy, styles.cardReduced, { maxWidth: panelWidth }]}>{cardBody}</View>
      ) : (
        <BrandSurface colors={BRAND_GRADIENTS.card} style={[styles.card, { maxWidth: panelWidth }]}>
          {cardBody}
        </BrandSurface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardShadow: {
    position: 'absolute',
    alignSelf: 'center',
    width: '100%',
    height: '92%',
    borderRadius: 42,
    backgroundColor: BRAND_COLORS.primaryGlow,
    shadowColor: BRAND_COLORS.shadowStrong,
    shadowOpacity: 0.16,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 24 },
    elevation: 12,
  },
  card: {
    width: '100%',
    borderRadius: 42,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.stroke,
    gap: 12,
  },
  cardLegacy: {
    backgroundColor: BRAND_COLORS.surface,
    borderColor: '#c4d9f6',
  },
  cardReduced: {
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 10,
    backgroundColor: '#f4f8fc',
    borderColor: '#cfdded',
  },
  headerColumn: {
    flexDirection: 'column',
    gap: 16,
  },
  headerColumnReduced: {
    gap: 12,
  },
  headerCopy: {
    width: '100%',
  },
  kicker: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    letterSpacing: 2.1,
    color: BRAND_COLORS.primary,
  },
  title: {
    marginTop: 8,
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 24,
    lineHeight: 26,
    color: BRAND_COLORS.textPrimary,
  },
  titleCompact: {
    fontSize: 20,
    lineHeight: 22,
  },
  probabilityCopy: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 18,
    color: BRAND_COLORS.textSecondary,
  },
  probabilityMeter: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: BRAND_COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: BRAND_COLORS.strokeStrong,
    alignItems: 'center',
    gap: 6,
  },
  probabilityMeterReduced: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f7fbff',
    borderColor: '#d5e1ed',
  },
  probabilityControlsColumn: {
    flexDirection: 'column',
    gap: 14,
  },
  probabilityMeterMain: {
    width: '100%',
  },
  probabilityInputCard: {
    width: '100%',
    justifyContent: 'center',
  },
  probabilityValue: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 44,
    color: BRAND_COLORS.primary,
  },
  probabilityHint: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    letterSpacing: 0.8,
    color: BRAND_COLORS.textSecondary,
    textAlign: 'center',
  },
  probabilityInputLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: BRAND_COLORS.textSecondary,
    letterSpacing: 0.4,
  },
  probabilityInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  probabilityInput: {
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.strokeStrong,
    backgroundColor: BRAND_COLORS.white,
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 28,
    color: BRAND_COLORS.textPrimary,
    textAlign: 'center',
  },
  probabilityInputDisabled: {
    opacity: 0.7,
  },
  probabilityInputSuffix: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 28,
    color: BRAND_COLORS.primary,
  },
  probabilityStatus: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: BRAND_COLORS.textSecondary,
  },
  probabilityStatusSuccess: {
    color: BRAND_COLORS.primaryStrong,
  },
  probabilityStatusError: {
    color: '#b14141',
  },
  toggleColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 16,
  },
  toggleCopy: {
    width: '100%',
  },
  toggleTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: BRAND_COLORS.textPrimary,
  },
  toggleStatus: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: BRAND_COLORS.textSecondary,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  backButtonReduced: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#d8e6f6',
  },
  backPressed: {
    opacity: 0.82,
  },
  backText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: BRAND_COLORS.primaryStrong,
    letterSpacing: 0.8,
  },
  sectionCard: {
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: BRAND_COLORS.stroke,
    gap: 10,
  },
  sectionCardLegacy: {
    backgroundColor: BRAND_COLORS.surfaceSoft,
    borderColor: '#d3e4fb',
  },
  sectionCardReduced: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#eef4fa',
    borderColor: '#d5e1ed',
  },
  sectionTitle: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 19,
    color: BRAND_COLORS.textPrimary,
  },
  loadingState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  loadingText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: BRAND_COLORS.textSecondary,
  },
  emptyState: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: BRAND_COLORS.surfaceSoft,
  },
  emptyStateReduced: {
    backgroundColor: '#f7fbff',
    borderColor: '#d5e1ed',
    borderWidth: 1,
  },
  emptyTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: BRAND_COLORS.textPrimary,
  },
  leadsList: {
    gap: 12,
  },
  leadRow: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: BRAND_COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: BRAND_COLORS.stroke,
    gap: 6,
  },
  leadRowReduced: {
    borderRadius: 18,
    backgroundColor: '#f7fbff',
    borderColor: '#d5e1ed',
  },
  leadRowCompact: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  leadRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leadEmail: {
    flex: 1,
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: BRAND_COLORS.textPrimary,
  },
  leadId: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: BRAND_COLORS.primary,
  },
  leadDate: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: BRAND_COLORS.textSecondary,
  },
  actionButtonPressable: {
    width: '100%',
  },
  actionButtonPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.985 }],
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButton: {
    minHeight: 72,
    borderRadius: 24,
    justifyContent: 'center',
    paddingHorizontal: 20,
    shadowColor: BRAND_COLORS.shadowStrong,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  actionButtonLegacy: {
    backgroundColor: BRAND_COLORS.primary,
    borderWidth: 1,
    borderColor: BRAND_COLORS.primaryStrong,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  actionButtonReduced: {
    minHeight: 60,
    borderRadius: 18,
  },
  secondaryActionPressable: {
    width: '100%',
  },
  secondaryActionPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  secondaryActionButton: {
    minHeight: 62,
    borderRadius: 22,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#fff2f2',
    borderWidth: 1,
    borderColor: '#eab7b7',
  },
  secondaryActionButtonReduced: {
    minHeight: 54,
    borderRadius: 18,
  },
  secondaryActionText: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 19,
    color: '#a23434',
    textAlign: 'center',
  },
  actionButtonText: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 21,
    color: BRAND_COLORS.white,
    textAlign: 'center',
  },
  noticeMessage: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: BRAND_COLORS.primaryStrong,
  },
});
