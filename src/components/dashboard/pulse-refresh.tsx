import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme';

/** Cuánto hay que estirar (px) para que las barras estén completas y se suelte para actualizar. */
const PULL = 80;
const BARS = [0.55, 0.85, 1, 0.85, 0.55];
const BAR_H = 22;

/**
 * Indicador de "tirar para actualizar" de marca (en iOS reemplaza al spinner del sistema): cinco
 * barras de pulso que crecen con el estirón, un toque háptico al llegar al punto de soltar y una
 * onda mientras carga. Solo iOS: en Android el scroll no se estira y queda el indicador nativo.
 */
export function PulseRefresh({
  scrollY,
  refreshing,
}: {
  scrollY: SharedValue<number>;
  refreshing: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const loading = useSharedValue(refreshing ? 1 : 0);
  const armed = useSharedValue(false);

  useEffect(() => {
    loading.set(withTiming(refreshing ? 1 : 0, { duration: refreshing ? 120 : 260 }));
  }, [refreshing, loading]);

  // Háptico una sola vez al cruzar el umbral (se rearma al volver a soltar).
  useAnimatedReaction(
    () => -scrollY.value >= PULL,
    (past, prev) => {
      if (past && !prev && !armed.value) {
        armed.value = true;
        scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!past && scrollY.value >= 0) armed.value = false;
    },
  );

  const wrap = useAnimatedStyle(() => {
    const pull = Math.max(0, -scrollY.value);
    return {
      opacity: Math.max(loading.value, interpolate(pull, [8, 36], [0, 1], 'clamp')),
      transform: [{ translateY: Math.min(pull, PULL + 20) * 0.35 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + 6 }, wrap]}
      accessibilityElementsHidden>
      {BARS.map((peak, i) => (
        <Bar
          key={i}
          index={i}
          peak={peak}
          scrollY={scrollY}
          loading={loading}
          refreshing={refreshing && !reduceMotion}
          color={colors.ink}
        />
      ))}
    </Animated.View>
  );
}

function Bar({
  index,
  peak,
  scrollY,
  loading,
  refreshing,
  color,
}: {
  index: number;
  peak: number;
  scrollY: SharedValue<number>;
  loading: SharedValue<number>;
  refreshing: boolean;
  color: string;
}) {
  const wave = useSharedValue(0);

  useEffect(() => {
    if (!refreshing) {
      wave.set(withTiming(0, { duration: 200 }));
      return;
    }
    const half = { duration: 320, easing: Easing.inOut(Easing.quad) };
    wave.set(
      withDelay(
        index * 90,
        withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1, false),
      ),
    );
  }, [refreshing, index, wave]);

  const style = useAnimatedStyle(() => {
    // Al estirar: cada barra arranca un poco después que la anterior.
    const pull = Math.max(0, -scrollY.value) / PULL;
    const grow = Math.min(1, Math.max(0, (pull - index * 0.1) / 0.55));
    const pulled = 0.18 + grow * (peak - 0.18);
    // Cargando: onda entre 30% y 100%.
    const waving = 0.3 + wave.value * 0.7 * peak;
    const s = pulled + (waving - pulled) * loading.value;
    return { transform: [{ scaleY: s }], opacity: 0.35 + 0.65 * Math.max(grow, loading.value) };
  });

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: { width: 4, height: BAR_H, borderRadius: 2 },
});

/** Props para ocultar el spinner del sistema en iOS (lo reemplaza el pulso). */
export const hiddenNativeSpinner = Platform.select({
  ios: { tintColor: 'transparent' },
  default: {},
});
