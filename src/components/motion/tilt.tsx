import { type ReactNode, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const FOLLOW = { duration: 140, easing: Easing.out(Easing.quad) };
const SETTLE = { duration: 420, easing: Easing.out(Easing.cubic) };

/**
 * Falso 3D: la tarjeta se inclina hacia donde está el dedo (rotateX/rotateY con perspectiva) y
 * un brillo suave se corre del lado contrario, como luz sobre una superficie. Al soltar vuelve
 * a plano. No captura el toque: los botones de adentro y el scroll siguen funcionando.
 */
export function Tilt({
  children,
  max = 7,
  glare = true,
  radius = 0,
  style,
}: {
  children: ReactNode;
  /** Inclinación máxima en grados. */
  max?: number;
  glare?: boolean;
  /** Radio de la tarjeta: el brillo se recorta a su forma. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ w: 1, h: 1 });
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const lit = useSharedValue(0);

  const follow = (e: GestureResponderEvent) => {
    if (reduceMotion) return;
    const { locationX, locationY } = e.nativeEvent;
    const nx = Math.max(-1, Math.min(1, (locationX / size.w) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, (locationY / size.h) * 2 - 1));
    ry.set(withTiming(nx * max, FOLLOW));
    rx.set(withTiming(-ny * max, FOLLOW));
    lit.set(withTiming(1, FOLLOW));
  };
  const settle = () => {
    rx.set(withTiming(0, SETTLE));
    ry.set(withTiming(0, SETTLE));
    lit.set(withTiming(0, SETTLE));
  };

  const card = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { rotateX: `${rx.value}deg` },
      { rotateY: `${ry.value}deg` },
      { scale: 1 - lit.value * 0.015 },
    ],
  }));
  const shine = useAnimatedStyle(() => ({
    opacity: lit.value * 0.5,
    transform: [
      { translateX: (-ry.value / max) * size.w * 0.35 },
      { translateY: (rx.value / max) * size.h * 0.35 },
    ],
  }));

  return (
    <Animated.View style={[style, card]}>
      <View
        onLayout={(e: LayoutChangeEvent) =>
          setSize({ w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 })
        }
        onTouchStart={follow}
        onTouchMove={follow}
        onTouchEnd={settle}
        onTouchCancel={settle}>
        {children}
      </View>
      {glare ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0, width: size.w, height: size.h, borderRadius: radius, overflow: 'hidden' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: 0, top: 0, width: size.w, height: size.h },
            shine,
          ]}>
          <Svg width={size.w} height={size.h}>
            <Defs>
              <RadialGradient id="glare" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={0.22} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#glare)" />
          </Svg>
        </Animated.View>
        </View>
      ) : null}
    </Animated.View>
  );
}
