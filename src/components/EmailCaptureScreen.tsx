import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BRAND_COLORS, BRAND_GRADIENTS } from '../theme/brand';

type EmailCaptureScreenProps = {
  compact: boolean;
  disabled?: boolean;
  email: string;
  errorMessage: string;
  panelWidth: number;
  onBack: () => void;
  onChangeEmail: (value: string) => void;
  onSubmit: () => void;
  submitLabel?: string;
};

export function EmailCaptureScreen({
  compact,
  disabled = false,
  email,
  errorMessage,
  panelWidth,
  onBack,
  onChangeEmail,
  onSubmit,
  submitLabel = 'Registrarme',
}: EmailCaptureScreenProps) {
  return (
    <View style={styles.stage}>
      <View style={[styles.cardShadow, { maxWidth: panelWidth }]} />

      <LinearGradient colors={BRAND_GRADIENTS.card} style={[styles.card, { maxWidth: panelWidth }]}>
        <Text style={styles.title}>Ingresá tu mail</Text>

        <View style={[styles.inputShell, !!errorMessage && styles.inputShellError]}>
          <TextInput
            accessibilityLabel="Correo electronico"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            editable={!disabled}
            inputMode="email"
            keyboardType="email-address"
            onChangeText={onChangeEmail}
            onSubmitEditing={onSubmit}
            placeholder="tu@correo.com"
            placeholderTextColor={BRAND_COLORS.textMuted}
            returnKeyType="go"
            selectionColor={BRAND_COLORS.primary}
            style={[styles.input, compact && styles.inputCompact]}
            value={email}
          />
        </View>

        {!!errorMessage ? <Text style={[styles.helper, styles.helperError]}>{errorMessage}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.buttonPressable,
            pressed && !disabled && styles.buttonPressed,
            disabled && styles.buttonDisabled,
          ]}
        >
          <LinearGradient colors={BRAND_GRADIENTS.primaryButton} style={styles.button}>
            <Text style={styles.buttonText}>{submitLabel}</Text>
          </LinearGradient>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}>
          <Text style={styles.backText}>REGRESAR</Text>
        </Pressable>
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
    height: '84%',
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
    paddingVertical: 34,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND_COLORS.stroke,
  },
  title: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 24,
    lineHeight: 28,
    color: BRAND_COLORS.textPrimary,
    textAlign: 'center',
  },
  inputShell: {
    width: '100%',
    marginTop: 24,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: BRAND_COLORS.strokeStrong,
    backgroundColor: BRAND_COLORS.surfaceSoft,
  },
  inputShellError: {
    borderColor: '#3f83e8',
    shadowColor: BRAND_COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  input: {
    width: '100%',
    minHeight: 94,
    paddingHorizontal: 28,
    fontFamily: 'DMSans_700Bold',
    fontSize: 26,
    color: BRAND_COLORS.textPrimary,
    textAlign: 'center',
  },
  inputCompact: {
    minHeight: 78,
    fontSize: 20,
    paddingHorizontal: 20,
  },
  helper: {
    marginTop: 12,
    marginBottom: 16,
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: BRAND_COLORS.textMuted,
    textAlign: 'center',
  },
  helperError: {
    color: BRAND_COLORS.primary,
  },
  button: {
    width: '100%',
    minHeight: 74,
    justifyContent: 'center',
    borderRadius: 24,
    paddingHorizontal: 20,
    shadowColor: BRAND_COLORS.shadowStrong,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  buttonPressable: {
    width: '100%',
    marginTop: 16,
  },
  buttonPressed: {
    width: '100%',
    opacity: 0.96,
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 22,
    color: BRAND_COLORS.white,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 22,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backPressed: {
    opacity: 0.7,
  },
  backText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: BRAND_COLORS.textMuted,
    textAlign: 'center',
  },
});
