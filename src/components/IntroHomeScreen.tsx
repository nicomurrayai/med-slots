import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { HOME_MACHINE_PREVIEW, MED_LOGO } from '../data/slotSymbols';
import { BRAND_COLORS, BRAND_GRADIENTS } from '../theme/brand';

type IntroHomeScreenProps = {
  compact: boolean;
  isAppBlocked?: boolean;
  lockedMessage?: string;
  logoSize: number;
  panelWidth: number;
  titleSize: number;
  onContinue: () => void;
  onLogoPress: () => void;
};

export function IntroHomeScreen({
  compact,
  isAppBlocked = false,
  lockedMessage = 'Acercate mas tarde para participar.',
  logoSize,
  panelWidth,
  titleSize,
  onContinue,
  onLogoPress,
}: IntroHomeScreenProps) {
  const resolvedTitleSize = compact ? Math.min(titleSize + 8, 38) : titleSize + 8;
  const resolvedLineHeight = compact ? resolvedTitleSize + 2 : resolvedTitleSize + 4;
  const previewWidth = Math.min(panelWidth - (compact ? 40 : 56), compact ? 320 : 520);
  const previewHeight = previewWidth * 0.456;

  return (
    <View style={styles.stage}>
      <View style={[styles.cardShadow, { maxWidth: panelWidth }]} />

      <LinearGradient colors={BRAND_GRADIENTS.card} style={[styles.card, { maxWidth: panelWidth }]}>
        <Pressable
          accessibilityRole="button"
          onPress={onLogoPress}
          style={({ pressed }) => [styles.logoPressable, pressed && styles.logoPressed]}
        >
          <Image
            source={MED_LOGO}
            resizeMode="contain"
            style={[
              styles.logo,
              {
                height: logoSize,
                width: logoSize,
              },
            ]}
          />
        </Pressable>

        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={1}
          style={[
            styles.title,
            {
              fontSize: resolvedTitleSize,
              lineHeight: resolvedLineHeight,
            },
          ]}
        >
          Jugá con MED
        </Text>

        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={1}
          style={[
            styles.titleAccent,
            {
              fontSize: resolvedTitleSize,
              lineHeight: resolvedLineHeight,
            },
          ]}
        >
          y Ganá
        </Text>

        {!isAppBlocked ? (
          <Pressable
            accessibilityRole="button"
            onPress={onContinue}
            style={({ pressed }) => [
              compact && styles.buttonPressableCompact,
              pressed && styles.buttonPressed,
            ]}
          >
            <LinearGradient colors={BRAND_GRADIENTS.primaryButton} style={[styles.button, compact && styles.buttonCompact]}>
              <Text style={styles.buttonText}>Comenzar</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={[styles.lockedMessageWrap, compact && styles.lockedMessageWrapCompact]}>
            <Text style={styles.lockedMessage}>{lockedMessage}</Text>
          </View>
        )}

        <Image
          source={HOME_MACHINE_PREVIEW}
          resizeMode="contain"
          style={[
            styles.previewImage,
            {
              width: previewWidth,
              height: previewHeight,
            },
          ]}
        />
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
    height: '82%',
    borderRadius: 42,
    backgroundColor: BRAND_COLORS.primaryGlow,
    shadowColor: BRAND_COLORS.shadowStrong,
    shadowOpacity: 0.16,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 22 },
    elevation: 12,
  },
  card: {
    width: '100%',
    borderRadius: 42,
    paddingHorizontal: 28,
    paddingVertical: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND_COLORS.stroke,
    overflow: 'hidden',
  },
  logo: {
    marginBottom: 18,
  },
  logoPressable: {
    borderRadius: 999,
  },
  logoPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  title: {
    fontFamily: 'LeagueSpartan_700Bold',
    color: BRAND_COLORS.textPrimary,
    textAlign: 'center',
  },
  titleAccent: {
    fontFamily: 'LeagueSpartan_700Bold',
    color: BRAND_COLORS.primary,
    textAlign: 'center',
    marginTop: 4,
  },
  button: {
    minWidth: 260,
    marginTop: 34,
    paddingHorizontal: 30,
    paddingVertical: 18,
    borderRadius: 24,
    shadowColor: BRAND_COLORS.shadowStrong,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  buttonPressableCompact: {
    width: '100%',
  },
  buttonCompact: {
    minWidth: 0,
    width: '100%',
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  buttonText: {
    fontFamily: 'LeagueSpartan_700Bold',
    fontSize: 22,
    color: BRAND_COLORS.white,
    textAlign: 'center',
  },
  lockedMessageWrap: {
    marginTop: 34,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: BRAND_COLORS.primarySoft,
    borderWidth: 1,
    borderColor: BRAND_COLORS.strokeStrong,
  },
  lockedMessageWrapCompact: {
    width: '100%',
  },
  lockedMessage: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    lineHeight: 26,
    color: BRAND_COLORS.primaryStrong,
    textAlign: 'center',
  },
  previewImage: {
    marginTop: 26,
    alignSelf: 'center',
  },
});
