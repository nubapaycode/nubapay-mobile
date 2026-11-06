import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Igual que el plugin de expo-splash-screen en app.json. */
const SPLASH_BG = '#080b11';
const ICON_W = 76;
const ICON_H = (ICON_W * 213) / 228;

/**
 * Pasaje del splash nativo a la app: se dibuja una copia idéntica del splash, se oculta el nativo
 * (no se nota el cambio) y la copia se disuelve: el ícono crece y se desvanece mientras el fondo
 * deja ver la pantalla de abajo (la aurora de la bienvenida o el inicio). Después se desmonta.
 */
export function SplashHandoff() {
  const reduceMotion = useReducedMotion();
  const [gone, setGone] = useState(false);
  const icon = useSharedValue(0);
  const bg = useSharedValue(1);

  const start = () => {
    SplashScreen.hideAsync().catch(() => {});
    const ease = Easing.out(Easing.cubic);
    icon.set(withTiming(1, { duration: reduceMotion ? 1 : 460, easing: ease }));
    bg.set(
      withDelay(
        reduceMotion ? 0 : 90,
        withTiming(0, { duration: reduceMotion ? 260 : 560, easing: ease }, (done) => {
          if (done) scheduleOnRN(setGone, true);
        }),
      ),
    );
  };

  // Por si el layout no llega a dispararse: nunca dejar el splash nativo puesto.
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, []);

  const wrap = useAnimatedStyle(() => ({ opacity: bg.value }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: 1 - icon.value,
    transform: [{ scale: 1 + icon.value * 0.5 }],
  }));

  if (gone) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.root, wrap]} onLayout={start}>
      <Animated.View style={iconStyle}>
        <Image source={require('../../../assets/images/splash-icon.png')} style={styles.icon} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH_BG,
  },
  icon: { width: ICON_W, height: ICON_H },
});
