import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillButton } from '@/components/auth';
import { Aurora } from '@/components/fx/aurora';
import { DisplayFont, Spacing } from '@/constants/theme';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { dark, makeStyles, PaletteScope } from '@/theme';

/**
 * Bienvenida (sin sesión): fondo de luces de marca, logotipo y un solo botón para ingresar.
 * Siempre en oscuro, aunque el resto del flujo de acceso vaya en claro.
 */
export default function WelcomeScreen() {
  return (
    <PaletteScope palette={dark}>
      <Welcome />
    </PaletteScope>
  );
}

function Welcome() {
  const styles = useStyles();
  useFocusStatusBar('light');

  return (
    <View style={styles.root}>
      <Aurora />
      <SafeAreaView style={styles.safe}>
        <Animated.View entering={FadeIn.duration(900)} style={styles.brand}>
          <Text style={styles.wordmark}>nubapay</Text>
          <Text style={styles.business}>Business</Text>
        </Animated.View>

        <Animated.View entering={rise(200)} style={styles.bottom}>
          <View style={styles.copy}>
            <Text style={styles.title} accessibilityRole="header">
              Tu evento,{'\n'}en tiempo real.
            </Text>
            <Text style={styles.subtitle}>
              Ventas, accesos y pagos de todos tus eventos en un solo lugar.
            </Text>
          </View>
          <PillButton title="Ingresar" variant="ink" onPress={() => router.push('/login')} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

/** Todo el texto de la bienvenida va en blanco puro (no el `text` de la paleta, que es apenas gris). */
const WHITE = '#ffffff';

const rise = (delay: number) =>
  FadeInDown.delay(delay)
    .duration(700)
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ opacity: 0, transform: [{ translateY: 18 }] });

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    safe: { flex: 1, paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
    brand: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
    wordmark: { color: WHITE, fontSize: 56, fontFamily: DisplayFont.extrabold, letterSpacing: -2 },
    business: { color: WHITE, fontSize: 15, fontWeight: '500' },
    bottom: { gap: Spacing.four },
    copy: { gap: 10 },
    title: {
      color: WHITE,
      fontSize: 34,
      lineHeight: 36,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.8,
    },
    subtitle: { color: WHITE, fontSize: 16, lineHeight: 23 },
  }),
);
