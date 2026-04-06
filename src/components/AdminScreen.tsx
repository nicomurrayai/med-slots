import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LeadEntry } from '../types/leads';
import { BRAND_COLORS, BRAND_GRADIENTS } from '../theme/brand';
import { formatLeadTimestamp } from '../utils/leads';

type AdminScreenProps = {
  compact: boolean;
  isExporting: boolean;
  isLoading: boolean;
  isSavingProbability: boolean;
  noticeMessage: string;
  onBack: () => void;
  onExport: () => void;
  onProbabilityComplete: (value: number) => void;
  panelWidth: number;
  probabilityNoticeMessage: string;
  probabilityNoticeTone: 'neutral' | 'success' | 'error';
  recentLeads: LeadEntry[];
  totalLeads: number;
  winProbabilityPercent: number;
};

type SectionCardProps = {
  children: React.ReactNode;
  title: string;
};

function SectionCard({ children, title }: SectionCardProps) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function OverviewSection({ totalLeads }: { totalLeads: number }) {
  return (
    <SectionCard title="Resumen">
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>Correos capturados</Text>
        <Text style={styles.metricValue}>{totalLeads}</Text>
        <Text style={styles.metricHint}>Cada envio valido se guarda como un registro independiente.</Text>
      </View>
    </SectionCard>
  );
}

function clampPercent(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function ProbabilityControlSection({
  isSaving,
  noticeMessage,
  noticeTone,
  onComplete,
  winProbabilityPercent,
}: {
  isSaving: boolean;
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
    <SectionCard title="Salida de premios">
      <Text style={styles.probabilityCopy}>
        Escribe manualmente el porcentaje de premios que quieres habilitar en la maquina.
      </Text>

      <View style={styles.probabilityControlsRow}>
        <View style={[styles.probabilityMeter, styles.probabilityMeterMain]}>
          <Text style={styles.probabilityValue}>{draftValue}%</Text>
          <Text style={styles.probabilityHint}>Porcentaje actual por tirada</Text>
        </View>

        <View style={[styles.probabilityMeter, styles.probabilityInputCard]}>
          <Text style={styles.probabilityInputLabel}>Escribir valor</Text>
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
          <Text style={styles.probabilityInputHint}>Ingresa un numero entre 0 y 100</Text>
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

function RecentLeadsSection({
  isLoading,
  recentLeads,
}: {
  isLoading: boolean;
  recentLeads: LeadEntry[];
}) {
  return (
    <SectionCard title="Registros recientes">
      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="small" />
          <Text style={styles.loadingText}>Leyendo base local...</Text>
        </View>
      ) : null}

      {!isLoading && recentLeads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Todavia no hay correos guardados.</Text>
          <Text style={styles.emptyBody}>Cuando empiece el evento, los registros van a aparecer aca automaticamente.</Text>
        </View>
      ) : null}

      {!isLoading ? (
        <View style={styles.leadsList}>
          {recentLeads.map((lead) => (
            <View key={lead.id} style={styles.leadRow}>
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
  isExporting,
  noticeMessage,
  onExport,
}: {
  isExporting: boolean;
  noticeMessage: string;
  onExport: () => void;
}) {
  return (
    <SectionCard title="Acciones">
      <Text style={styles.actionsCopy}>
        Exporta un CSV con todos los registros guardados en este telefono para compartirlo con el cliente al final del evento.
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={isExporting}
        onPress={onExport}
        style={({ pressed }) => [
          styles.actionButtonPressable,
          pressed && !isExporting && styles.actionButtonPressed,
          isExporting && styles.actionButtonDisabled,
        ]}
      >
        <LinearGradient colors={BRAND_GRADIENTS.primaryButton} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>{isExporting ? 'EXPORTANDO CSV...' : 'EXPORTAR CSV'}</Text>
        </LinearGradient>
      </Pressable>

      {!!noticeMessage ? <Text style={styles.noticeMessage}>{noticeMessage}</Text> : null}
    </SectionCard>
  );
}

export function AdminScreen({
  compact,
  isExporting,
  isLoading,
  isSavingProbability,
  noticeMessage,
  onBack,
  onExport,
  onProbabilityComplete,
  panelWidth,
  probabilityNoticeMessage,
  probabilityNoticeTone,
  recentLeads,
  totalLeads,
  winProbabilityPercent,
}: AdminScreenProps) {
  return (
    <View style={styles.stage}>
      <View style={[styles.cardShadow, { maxWidth: panelWidth }]} />

      <LinearGradient colors={BRAND_GRADIENTS.card} style={[styles.card, { maxWidth: panelWidth }]}>
        <View style={[styles.headerRow, compact && styles.headerRowCompact]}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>PANEL INTERNO</Text>
            <Text style={styles.title}>ADMINISTRACION OFFLINE</Text>
            <Text style={styles.subtitle}>
              Ajusta la salida de premios y gestiona los registros sin tocar la experiencia principal del evento.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
          >
            <Text style={styles.backText}>VOLVER</Text>
          </Pressable>
        </View>

        <ProbabilityControlSection
          isSaving={isSavingProbability}
          noticeMessage={probabilityNoticeMessage}
          noticeTone={probabilityNoticeTone}
          onComplete={onProbabilityComplete}
          winProbabilityPercent={winProbabilityPercent}
        />
        <OverviewSection totalLeads={totalLeads} />
        <RecentLeadsSection isLoading={isLoading} recentLeads={recentLeads} />
        <AdminActionsSection isExporting={isExporting} noticeMessage={noticeMessage} onExport={onExport} />
      </LinearGradient>
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
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: BRAND_COLORS.stroke,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerRowCompact: {
    flexDirection: 'column',
  },
  headerCopy: {
    flex: 1,
  },
  kicker: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    letterSpacing: 2.1,
    color: BRAND_COLORS.primary,
  },
  title: {
    marginTop: 12,
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 30,
    lineHeight: 32,
    color: BRAND_COLORS.textPrimary,
  },
  subtitle: {
    marginTop: 12,
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    lineHeight: 22,
    color: BRAND_COLORS.textSecondary,
    maxWidth: 760,
  },
  probabilityCopy: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    lineHeight: 22,
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
  probabilityControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  probabilityMeterMain: {
    flex: 1,
    minWidth: 220,
  },
  probabilityInputCard: {
    minWidth: 190,
    justifyContent: 'center',
  },
  probabilityValue: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 56,
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
  probabilityInputHint: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    lineHeight: 18,
    color: BRAND_COLORS.textMuted,
    textAlign: 'center',
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
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: BRAND_COLORS.stroke,
    gap: 14,
  },
  sectionTitle: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 22,
    color: BRAND_COLORS.textPrimary,
  },
  metricCard: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: BRAND_COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: BRAND_COLORS.strokeStrong,
    gap: 8,
  },
  metricLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: BRAND_COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  metricValue: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 44,
    color: BRAND_COLORS.primary,
  },
  metricHint: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: BRAND_COLORS.textMuted,
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
    gap: 6,
  },
  emptyTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: BRAND_COLORS.textPrimary,
  },
  emptyBody: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: BRAND_COLORS.textMuted,
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
  actionsCopy: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 21,
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
