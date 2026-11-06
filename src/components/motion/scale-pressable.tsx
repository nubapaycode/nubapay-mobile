import type { ComponentProps } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };

/**
 * Pressable que se hunde apenas al apretar (sin rebote), como las cards del inicio. `outerStyle`
 * va al contenedor que escala (márgenes, flex); `style` sigue siendo el del Pressable.
 */
export function ScalePressable({
  scaleTo = 0.98,
  outerStyle,
  onPressIn,
  onPressOut,
  ...rest
}: ComponentProps<typeof Pressable> & { scaleTo?: number; outerStyle?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[outerStyle, style]}>
      <Pressable
        onPressIn={(e) => {
          if (!reduceMotion) scale.set(withTiming(scaleTo, PRESS));
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.set(withTiming(1, PRESS));
          onPressOut?.(e);
        }}
        {...rest}
      />
    </Animated.View>
  );
}
