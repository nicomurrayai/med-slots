import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EventDay, PrizeDayValues, PrizeQuotaSummary } from '../types/slot';
import { BRAND_COLORS } from '../theme/brand';
import { clampNonNegativeInteger, EVENT_DAYS, getEventDayLabel } from '../utils/prizeQuota';

type PrizeQuotaSectionProps = {
  awardedPrizeCounts: PrizeDayValues;
  currentEventDay: EventDay;
  dailyPrizeLimits: PrizeDayValues;
  isSaving: boolean;
  noticeMessage: string;
  noticeTone: 'neutral' | 'success' | 'error';
  onAwardedCountAdjust: (delta: -1 | 1) => void;
  onCurrentEventDayChange: (day: EventDay) => void;
  onDailyPrizeLimitComplete: (day: EventDay, value: number) => void;
  prizeQuotaSummary: PrizeQuotaSummary;
  reducedEffects?: boolean;
};

type DayInputValues = Record<EventDay, string>;

function buildDayInputValues(values: PrizeDayValues): DayInputValues {
  return {
    1: String(values[1]),
    2: String(values[2]),
    3: String(values[3]),
  };
}

export function PrizeQuotaSection({
  awardedPrizeCounts,
  currentEventDay,
  dailyPrizeLimits,
  isSaving,
  noticeMessage,
  noticeTone,
  onAwardedCountAdjust,
  onCurrentEventDayChange,
  onDailyPrizeLimitComplete,
  prizeQuotaSummary,
  reducedEffects = false,
}: PrizeQuotaSectionProps) {
  const [inputValues, setInputValues] = useState<DayInputValues>(() => buildDayInputValues(dailyPrizeLimits));
  const skipBlurCommitRef = useRef<Record<EventDay, boolean>>({
    1: false,
    2: false,
    3: false,
  });

  useEffect(() => {
    setInputValues(buildDayInputValues(dailyPrizeLimits));
  }, [dailyPrizeLimits]);

  useEffect(() => {
    if (!isSaving && noticeTone === 'error') {
      setInputValues(buildDayInputValues(dailyPrizeLimits));
    }
  }, [dailyPrizeLimits, isSaving, noticeTone]);

  const commitLimitValue = (day: EventDay) => {
    if (isSaving) {
      return;
    }

    const rawValue = inputValues[day].trim();
    const nextValue = rawValue === '' ? dailyPrizeLimits[day] : clampNonNegativeInteger(Number(rawValue));

    setInputValues((currentValues) => ({
      ...currentValues,
      [day]: String(nextValue),
    }));
    void onDailyPrizeLimitComplete(day, nextValue);
  };

  const handleLimitInputChange = (day: EventDay, value: string) => {
    const digitsOnly = value.replace(/[^\d]/g, '').slice(0, 4);

    setInputValues((currentValues) => ({
      ...currentValues,
      [day]: digitsOnly,
    }));
  };

  const adjustmentCanDecrease = prizeQuotaSummary.currentDayAwarded > 0;
  const adjustmentCanIncrease = prizeQuotaSummary.currentDayAwarded < prizeQuotaSummary.currentDayLimit;
  const currentDayLabel = getEventDayLabel(currentEventDay);
  const summaryItems = [
    { label: 'Restantes hoy', value: prizeQuotaSummary.currentDayRemaining },
    { label: 'Entregados hoy', value: prizeQuotaSummary.currentDayAwarded },
    { label: 'Restantes total', value: prizeQuotaSummary.totalRemaining },
  ];

  return (
    <View style={[styles.sectionCard, reducedEffects && styles.sectionCardReduced]}>
      <Text style={styles.sectionTitle}>Cupo de premios</Text>
      <Text style={styles.sectionCopy}>
        Selecciona el dia activo, ajusta los cupos y corrige el conteo del dia actual si hace falta.
      </Text>

      <View style={styles.daySelectorRow}>
        {EVENT_DAYS.map((day) => {
          const active = day === currentEventDay;

          return (
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              key={day}
              onPress={() => {
                void onCurrentEventDayChange(day);
              }}
              style={({ pressed }) => [
                styles.daySelectorButton,
                reducedEffects && styles.daySelectorButtonReduced,
                active && styles.daySelectorButtonActive,
                pressed && !isSaving && styles.daySelectorButtonPressed,
                isSaving && styles.daySelectorButtonDisabled,
              ]}
            >
              <View style={styles.daySelectorContent}>
                <Text style={[styles.daySelectorText, active && styles.daySelectorTextActive]}>
                  {getEventDayLabel(day)}
                </Text>
                <Text style={[styles.daySelectorMeta, active && styles.daySelectorMetaActive]}>
                  {dailyPrizeLimits[day]} cupo
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.heroCard,
          reducedEffects && styles.heroCardReduced,
          prizeQuotaSummary.isCurrentDayExhausted && styles.heroCardExhausted,
        ]}
      >
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroLabel}>Dia activo</Text>
            <Text style={styles.heroTitle}>{currentDayLabel}</Text>
          </View>

          <View
            style={[
              styles.heroBadge,
              prizeQuotaSummary.isCurrentDayExhausted ? styles.heroBadgeError : styles.heroBadgeSuccess,
            ]}
          >
            <Text
              style={[
                styles.heroBadgeText,
                prizeQuotaSummary.isCurrentDayExhausted
                  ? styles.heroBadgeTextError
                  : styles.heroBadgeTextSuccess,
              ]}
            >
              {prizeQuotaSummary.isCurrentDayExhausted ? 'Sin premios hoy' : 'Premios disponibles'}
            </Text>
          </View>
        </View>

        <View style={styles.summaryList}>
          {summaryItems.map((item) => (
            <View key={item.label} style={[styles.summaryRow, reducedEffects && styles.summaryRowReduced]}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryNumber}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.dayCardsColumn}>
        {EVENT_DAYS.map((day) => {
          const isActiveDay = day === currentEventDay;
          const remainingCount = Math.max(dailyPrizeLimits[day] - awardedPrizeCounts[day], 0);

          return (
            <View
              key={day}
              style={[
                styles.dayCard,
                reducedEffects && styles.dayCardReduced,
                isActiveDay && styles.dayCardActive,
                isActiveDay && reducedEffects && styles.dayCardActiveReduced,
              ]}
            >
              <View style={styles.dayCardHeader}>
                <Text style={styles.dayCardTitle}>{getEventDayLabel(day)}</Text>
                {isActiveDay ? (
                  <View style={styles.dayCardTag}>
                    <Text style={styles.dayCardTagText}>Activo</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.dayCardMeta}>Entregados: {awardedPrizeCounts[day]}</Text>

              <View style={styles.limitBlock}>
                <Text style={styles.limitLabel}>Cupo</Text>
                <View style={styles.limitInputWrap}>
                  <TextInput
                    accessibilityLabel={`Cupo de ${getEventDayLabel(day)}`}
                    editable={!isSaving}
                    keyboardType="number-pad"
                    maxLength={4}
                    onBlur={() => {
                      if (skipBlurCommitRef.current[day]) {
                        skipBlurCommitRef.current[day] = false;
                        return;
                      }

                      commitLimitValue(day);
                    }}
                    onChangeText={(value) => handleLimitInputChange(day, value)}
                    onSubmitEditing={() => {
                      skipBlurCommitRef.current[day] = true;
                      commitLimitValue(day);
                    }}
                    selectTextOnFocus
                    style={[styles.limitInput, isSaving && styles.limitInputDisabled]}
                    value={inputValues[day]}
                  />
                  <Text style={styles.limitSuffix}>premios</Text>
                </View>
              </View>

              <Text style={styles.dayCardMeta}>Restantes: {remainingCount}</Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.adjustmentCard, reducedEffects && styles.adjustmentCardReduced]}>
        <Text style={styles.adjustmentTitle}>Correccion manual</Text>
        <Text style={styles.adjustmentCopy}>
          Ajusta el conteo de {currentDayLabel} entre 0 y {prizeQuotaSummary.currentDayLimit} premios.
        </Text>

        <View style={styles.adjustmentValueCard}>
          <Text style={styles.adjustmentValue}>{prizeQuotaSummary.currentDayAwarded}</Text>
          <Text style={styles.adjustmentValueLabel}>Entregados hoy</Text>
        </View>

        <View style={styles.adjustmentRow}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving || !adjustmentCanDecrease}
            onPress={() => {
              void onAwardedCountAdjust(-1);
            }}
            style={({ pressed }) => [
              styles.adjustmentButton,
              pressed && adjustmentCanDecrease && !isSaving && styles.adjustmentButtonPressed,
              (isSaving || !adjustmentCanDecrease) && styles.adjustmentButtonDisabled,
            ]}
          >
            <Text style={styles.adjustmentButtonText}>-1</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving || !adjustmentCanIncrease}
            onPress={() => {
              void onAwardedCountAdjust(1);
            }}
            style={({ pressed }) => [
              styles.adjustmentButton,
              pressed && adjustmentCanIncrease && !isSaving && styles.adjustmentButtonPressed,
              (isSaving || !adjustmentCanIncrease) && styles.adjustmentButtonDisabled,
            ]}
          >
            <Text style={styles.adjustmentButtonText}>+1</Text>
          </Pressable>
        </View>
      </View>

      <Text
        style={[
          styles.statusText,
          noticeTone === 'success' && styles.statusTextSuccess,
          noticeTone === 'error' && styles.statusTextError,
        ]}
      >
        {isSaving ? 'Guardando cupo...' : noticeMessage}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: BRAND_COLORS.stroke,
    gap: 10,
  },
  sectionCardReduced: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#eef4fa',
    borderColor: '#d5e1ed',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 19,
    color: BRAND_COLORS.textPrimary,
  },
  sectionCopy: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 18,
    color: BRAND_COLORS.textSecondary,
  },
  daySelectorRow: {
    flexDirection: 'column',
    gap: 10,
  },
  daySelectorButton: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.strokeStrong,
    backgroundColor: BRAND_COLORS.white,
  },
  daySelectorButtonReduced: {
    borderColor: '#d5e1ed',
    backgroundColor: '#f7fbff',
  },
  daySelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  daySelectorButtonActive: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  daySelectorButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  daySelectorButtonDisabled: {
    opacity: 0.7,
  },
  daySelectorText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: BRAND_COLORS.primaryStrong,
  },
  daySelectorMeta: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: BRAND_COLORS.textSecondary,
  },
  daySelectorTextActive: {
    color: BRAND_COLORS.white,
  },
  daySelectorMetaActive: {
    color: 'rgba(255,255,255,0.84)',
  },
  heroCard: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: BRAND_COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: BRAND_COLORS.strokeStrong,
    gap: 10,
  },
  heroCardReduced: {
    backgroundColor: '#f7fbff',
    borderColor: '#d5e1ed',
  },
  heroCardExhausted: {
    backgroundColor: '#fff1f1',
    borderColor: '#f0c2c2',
  },
  heroHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    letterSpacing: 0.8,
    color: BRAND_COLORS.textSecondary,
  },
  heroTitle: {
    marginTop: 4,
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 24,
    color: BRAND_COLORS.textPrimary,
  },
  heroBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeSuccess: {
    backgroundColor: '#e1f2e8',
  },
  heroBadgeError: {
    backgroundColor: '#fde2e2',
  },
  heroBadgeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  heroBadgeTextSuccess: {
    color: '#246b3f',
  },
  heroBadgeTextError: {
    color: '#a23434',
  },
  summaryList: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BRAND_COLORS.white,
    borderWidth: 1,
    borderColor: BRAND_COLORS.stroke,
  },
  summaryRowReduced: {
    backgroundColor: '#ffffff',
    borderColor: '#d5e1ed',
  },
  summaryNumber: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 22,
    color: BRAND_COLORS.primaryStrong,
  },
  summaryLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    letterSpacing: 0.4,
    color: BRAND_COLORS.textSecondary,
  },
  dayCardsColumn: {
    flexDirection: 'column',
    gap: 10,
  },
  dayCard: {
    width: '100%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: BRAND_COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: BRAND_COLORS.stroke,
    gap: 8,
  },
  dayCardReduced: {
    backgroundColor: '#f7fbff',
    borderColor: '#d5e1ed',
  },
  dayCardActive: {
    borderColor: BRAND_COLORS.primary,
    shadowColor: BRAND_COLORS.shadowStrong,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  dayCardActiveReduced: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayCardTitle: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 18,
    color: BRAND_COLORS.textPrimary,
  },
  dayCardTag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  dayCardTagText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
    color: BRAND_COLORS.primaryStrong,
  },
  dayCardMeta: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: BRAND_COLORS.textSecondary,
  },
  limitBlock: {
    gap: 6,
  },
  limitLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    letterSpacing: 0.4,
    color: BRAND_COLORS.textSecondary,
  },
  limitInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  limitInput: {
    width: 92,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.strokeStrong,
    backgroundColor: BRAND_COLORS.white,
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 22,
    color: BRAND_COLORS.textPrimary,
    textAlign: 'center',
  },
  limitInputDisabled: {
    opacity: 0.7,
  },
  limitSuffix: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: BRAND_COLORS.textSecondary,
  },
  adjustmentCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: BRAND_COLORS.strokeStrong,
    gap: 10,
  },
  adjustmentCardReduced: {
    backgroundColor: '#f7fbff',
    borderColor: '#d5e1ed',
  },
  adjustmentTitle: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 20,
    color: BRAND_COLORS.textPrimary,
  },
  adjustmentCopy: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: BRAND_COLORS.textSecondary,
  },
  adjustmentRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  adjustmentButton: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustmentButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  adjustmentButtonDisabled: {
    opacity: 0.45,
  },
  adjustmentButtonText: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 24,
    color: BRAND_COLORS.white,
  },
  adjustmentValueCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: BRAND_COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: BRAND_COLORS.stroke,
    alignItems: 'center',
    gap: 4,
  },
  adjustmentValue: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 28,
    color: BRAND_COLORS.primaryStrong,
  },
  adjustmentValueLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    letterSpacing: 0.4,
    color: BRAND_COLORS.textSecondary,
  },
  statusText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: BRAND_COLORS.textSecondary,
  },
  statusTextSuccess: {
    color: BRAND_COLORS.primaryStrong,
  },
  statusTextError: {
    color: '#b14141',
  },
});
