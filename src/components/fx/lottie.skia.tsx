import { Canvas, Group, Skia, Skottie } from '@shopify/react-native-skia';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import type { LottieColors } from './lottie';

/**
 * Reproduce un Lottie con Skottie (el motor de Lottie de Skia) en loop. Los colores se reemplazan
 * por nombre de propiedad ("card", "soft", "ink", "accent") para seguir el tema claro/oscuro.
 * El reloj solo corre con la pantalla enfocada; con `still` queda en un cuadro fijo.
 */
export default function SkiaLottie({
  source,
  size,
  colors,
  still,
  loop,
}: {
  source: object;
  size: number;
  colors: LottieColors;
  still: boolean;
  /** false: se reproduce una vez y queda en el último cuadro. */
  loop: boolean;
}) {
  const animation = useMemo(() => {
    const anim = Skia.Skottie.Make(JSON.stringify(source));
    for (const prop of anim.getColorProps()) {
      const color = colors[prop.key as keyof LottieColors];
      if (color) anim.setColor(prop.key, Skia.Color(color));
    }
    return anim;
  }, [source, colors]);

  const total = animation.duration() * animation.fps();
  const scale = size / Math.max(animation.size().width, animation.size().height);
  // En loop arranca un poco adelantado (ya en movimiento); una sola vez, desde el principio.
  const time = useSharedValue(loop ? 0.3 : 0);

  const frame = useFrameCallback((f) => {
    time.value += (f.timeSincePreviousFrame ?? 16) / 1000;
  }, false);
  useFocusEffect(
    useCallback(() => {
      if (still) return;
      frame.setActive(true);
      return () => frame.setActive(false);
    }, [frame, still]),
  );

  const current = useDerivedValue(() => {
    const f = time.value * animation.fps();
    if (still) return loop ? total * 0.3 : total - 1;
    return loop ? f % total : Math.min(f, total - 1);
  });

  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale }]}>
        <Skottie animation={animation} frame={current} />
      </Group>
    </Canvas>
  );
}
