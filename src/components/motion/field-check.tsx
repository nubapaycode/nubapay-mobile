import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme';

const LEN = 20;
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Tilde chiquito al lado de un campo cuando queda bien completo: el círculo crece y el check se
 * dibuja; si el valor deja de ser válido, se apaga. Decorativo (el lector de pantalla no lo lee).
 */
export function FieldCheck({ ok, size = 18 }: { ok: boolean; size?: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(ok ? 1 : 0);
  const draw = useSharedValue(ok ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      pop.set(ok ? 1 : 0);
      draw.set(ok ? 1 : 0);
      return;
    }
    if (ok) {
      pop.set(withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }));
      draw.set(withDelay(90, withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) })));
    } else {
      pop.set(withTiming(0, { duration: 140 }));
      draw.set(withTiming(0, { duration: 100 }));
    }
  }, [ok, reduceMotion, pop, draw]);

  const style = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.4 + pop.value * 0.6 }] }));
  const props = useAnimatedProps(() => ({ strokeDashoffset: LEN * (1 - draw.value) }));

  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.success }, style]}>
      <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24">
        <AnimatedPath
          d="M6 12.5l4 4 8-8.5"
          stroke="#ffffff"
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={`${LEN} ${LEN}`}
          animatedProps={props}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ dot: { alignItems: 'center', justifyContent: 'center' } });
