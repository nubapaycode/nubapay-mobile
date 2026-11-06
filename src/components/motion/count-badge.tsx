import { useEffect, useRef } from 'react';
import { type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

/**
 * Globito con un número (filtros activos, pendientes): aparece creciendo y, cada vez que cambia
 * la cantidad, da un saltito para que se note. Sin rebote de resorte.
 */
export function CountBadge({
  count,
  style,
  textStyle,
}: {
  count: number;
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const prev = useRef(count);

  useEffect(() => {
    if (prev.current === count) return;
    prev.current = count;
    if (reduceMotion) return;
    pop.set(
      withSequence(
        withTiming(1.35, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 200, easing: Easing.inOut(Easing.quad) }),
      ),
    );
  }, [count, pop, reduceMotion]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Animated.View
      entering={reduceMotion ? undefined : ZoomIn.duration(180).easing(Easing.out(Easing.cubic))}
      exiting={reduceMotion ? undefined : FadeOut.duration(120)}
      style={[style, anim]}>
      <Animated.Text style={textStyle}>{count}</Animated.Text>
    </Animated.View>
  );
}
