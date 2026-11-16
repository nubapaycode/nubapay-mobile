import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Ticky, type TickyPose } from '@/components/illustrations/ticky';
import type { MascotMood } from '@/widgets/types';

/** Las poses del backend (`MascotMood`) más las de estados de la app: sin conexión y buscando. */
export type MascotPose = MascotMood | 'offline' | 'search';

/**
 * Ticky según cómo viene la venta. Cada estado usa una pose de `Ticky`, que pasa de una a otra
 * interpolando (sin cortes):
 * - `waiting`: levanta el celular y lo mira, esperando;
 * - `selling`: saluda y rebota suave;
 * - `hot` / `soldout`: salta con los brazos arriba entre confeti;
 * - `slow`: quieto, respirando y mirando alrededor;
 * - `offline` (sin conexión): triste, con una lágrima;
 * - `search` (búsqueda sin resultados): pensativo.
 *
 * Los SVG de `assets/illustrations/mascot-moods/*` siguen siendo los de la Live Activity y el widget.
 */
const POSE_OF: Record<MascotPose, TickyPose> = {
  waiting: 'scan',
  selling: 'wave',
  hot: 'celebrate',
  slow: 'idle',
  soldout: 'celebrate',
  offline: 'sad',
  search: 'think',
};

/** Recuadro que se muestra del lienzo de Ticky (240×260): lo que antes ocupaba la mascota. */
const CROP_X = 24;
const CROP_Y = 40;
const CROP_W = 192;
const CROP_H = 204;

export function MoodMascot({
  mood,
  size = 72,
  onLight = false,
  hopKey = 0,
  onPress,
}: {
  mood: MascotPose;
  /** Ancho en px (el alto sale de la proporción del recuadro). */
  size?: number;
  onLight?: boolean;
  /** Cada vez que cambia, la mascota pega un saltito (p. ej. cuando empieza a hablar). */
  hopKey?: number;
  /** Al tocarla: salta, da un toque háptico y llama a esto. Sin `onPress` no es tocable. */
  onPress?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const k = size / CROP_W;
  const height = CROP_H * k;
  const hop = useSharedValue(0);

  const jump = () => {
    if (reduceMotion) return;
    hop.set(
      withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 260, easing: Easing.in(Easing.cubic) }),
      ),
    );
  };
  useEffect(() => {
    if (hopKey) jump();
    // `jump` solo usa valores estables; el salto depende de que cambie `hopKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hopKey]);

  const hopStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -16 * k * hop.value }, { rotate: `${-4 * hop.value}deg` }],
  }));

  const body = (
    <Animated.View style={[{ width: size, height }, hopStyle]}>
      <View style={{ position: 'absolute', left: -CROP_X * k, top: -CROP_Y * k }}>
        <Ticky size={240 * k} pose={POSE_OF[mood]} confetti={false} onLight={onLight} />
      </View>
    </Animated.View>
  );

  if (!onPress) {
    return (
      <View style={{ width: size, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Mascota de Nubapay. Tocala para que te cuente algo del evento"
      hitSlop={8}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        jump();
        onPress();
      }}
      style={{ width: size, height }}>
      {body}
    </Pressable>
  );
}

/** Texto corto para acompañar cada pose. */
export const MOOD_LABEL: Record<MascotMood, string> = {
  waiting: 'Esperando la primera venta',
  selling: 'Vendiendo',
  hot: '¡En racha!',
  slow: 'Sin ventas hace media hora',
  soldout: '¡Entradas agotadas!',
};
