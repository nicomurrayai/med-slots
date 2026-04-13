import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BrandSurface } from './BrandSurface';
import { PrizeQuotaSection } from './PrizeQuotaSection';
import { LeadEntry } from '../types/leads';
import { EventDay, PrizeDayValues, PrizeQuotaSummary } from '../types/slot';
import { BRAND_COLORS, BRAND_GRADIENTS } from '../theme/brand';
import { formatLeadTimestamp } from '../utils/leads';

type AdminScreenProps = {
  appBlocked: boolean;
  awardedPrizeCounts: PrizeDayValues;
  compact: boolean;
  currentEventDay: EventDay;
  dailyPrizeLimits: PrizeDayValues;
  isClearingLeads: boolean;
  isExporting: boolean;
  isLoading: boolean;
  isResettingPrizes: boolean;
  isSavingAppBlock: boolean;
  isSavingPrizeQuota: boolean;
  isSavingProbability: boolean;
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
  winProbabilityPercent: number;
};

type SectionCardProps = {
  children: React.ReactNode;
  legacyVisualMode?: boolean;
  title: string;
};

function SectionCard({ children, legacyVisualMode = false, title }: SectionCardProps) {
  return (
    <View style={[styles.sectionCard, legacyVisualMode && styles.sectionCardLegacy]}>
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
  winProbabilityPercent,
}: {
  compact: boolean;
  isSaving: boolean;
  legacyVisualMode: boolean;
  noticeMessage: string;
  noticeTone: 'neutral' | 'success' | 'error';
  onComplete: (value: number) => void;
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
    <SectionCard legacyVisualMode={legacyVisualMode} title="Probabilidad">
      <Text style={styles.probabilityCopy}>Define el % de premio que la maquina intentara dar.</Text>

      <View style={styles.probabilityControlsColumn}>
        <View style={[styles.probabilityMeter, styles.probabilityMeterMain]}>
          <Text style={styles.probabilityValue}>{draftValue}%</Text>
          <Text style={styles.probabilityHint}>Actual</Text>
        </View>

        <View style={[styles.probabilityMeter, styles.probabilityInputCard]}>
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
}: {
  compact: boolean;
  appBlocked: boolean;
  isSaving: boolean;
  legacyVisualMode: boolean;
  noticeMessage: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <SectionCard legacyVisualMode={legacyVisualMode} title="Acceso">
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
  isLoading,
  legacyVisualMode,
  recentLeads,
}: {
  compact: boolean;
  isLoading: boolean;
  legacyVisualMode: boolean;
  recentLeads: LeadEntry[];
}) {
  return (
    <SectionCard legacyVisualMode={legacyVisualMode} title="Registros">
      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="small" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      ) : null}

      {!isLoading && recentLeads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sin registros.</Text>
        </View>
      ) : null}

      {!isLoading ? (
        <View style={styles.leadsList}>
          {recentLeads.map((lead) => (
            <View key={lead.id} style={[styles.leadRow, compact && styles.leadRowCompact]}>
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
}: {
  isClearingLeads: boolean;
  isExporting: boolean;
  isResettingPrizes: boolean;
  legacyVisualMode: boolean;
  noticeMessage: string;
  onClearLeads: () => void;
  onExport: () => void;
  onResetPrizes: () => void;
}) {
  const isBusy = isExporting || isClearingLeads || isResettingPrizes;

  return (
    <SectionCard legacyVisualMode={legacyVisualMode} title="Datos">
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
          enabled={!legacyVisualMode}
          style={[styles.actionButton, legacyVisualMode && styles.actionButtonLegacy]}
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
        <View style={styles.secondaryActionButton}>
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
        <View style={styles.secondaryActionButton}>
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
  dailyPrizeLimits,
  isClearingLeads,
  isExporting,
  isLoading,
  isResettingPrizes,
  isSavingAppBlock,
  isSavingPrizeQuota,
  isSavingProbability,
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
  winProbabilityPercent,
}: AdminScreenProps) {
  return (
    <View style={styles.stage}>
      {!legacyVisualMode ? <View style={[styles.cardShadow, { maxWidth: panelWidth }]} /> : null}

      <BrandSurface
        colors={BRAND_GRADIENTS.card}
        enabled={!legacyVisualMode}
        style={[styles.card, legacyVisualMode && styles.cardLegacy, { maxWidth: panelWidth }]}
      >
        <View style={styles.headerColumn}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>PANEL OCULTO</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>AJUSTES</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
          >
            <Text style={styles.backText}>VOLVER</Text>
          </Pressable>
        </View>

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
        />
        <ProbabilityControlSection
          compact={compact}
          isSaving={isSavingProbability}
          legacyVisualMode={legacyVisualMode}
          noticeMessage={probabilityNoticeMessage}
          noticeTone={probabilityNoticeTone}
          onComplete={onProbabilityComplete}
          winProbabilityPercent={winProbabilityPercent}
        />
        <AppBlockSection
          compact={compact}
          appBlocked={appBlocked}
          isSaving={isSavingAppBlock}
          legacyVisualMode={legacyVisualMode}
          noticeMessage={lockNoticeMessage}
          onChange={onAppBlockChange}
        />
        <RecentLeadsSection
          compact={compact}
          isLoading={isLoading}
          legacyVisualMode={legacyVisualMode}
          recentLeads={recentLeads}
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
        />
      </BrandSurface>
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
  headerColumn: {
    flexDirection: 'column',
    gap: 16,
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
