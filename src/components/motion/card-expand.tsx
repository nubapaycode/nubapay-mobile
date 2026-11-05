import type { ComponentRef, ComponentType, RefObject } from 'react';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';
import { scheduleOnRN } from 'react-native-worklets';

import { hasSkia } from '@/components/fx/skia';

type Rect = { x: number; y: number; width: number; height: number };
type Img = unknown;

// Foto del contenido de la tarjeta (solo con Skia; sin Skia crece la tarjeta sola).
const capture: ((ref: RefObject<unknown>) => Promise<Img | null>) | null = hasSkia
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/components/fx/theme-reveal.skia').capture
  : null;
const SnapshotImage: ComponentType<{ image: Img; width: number; height: number }> | null = hasSkia
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/components/fx/snapshot.skia').default
  : null;

type Expansion = {
  id: number;
  rect: Rect;
  radius: number;
  from: string;
  to: string;
  image: Img | null;
  /** Se llama cuando la tarjeta ya cubre la pantalla: ahí se navega. */
  onCovered: () => void;
};

let nextId = 1;
let listener: ((e: Expansion) => void) | null = null;

/**
 * Expande una tarjeta hasta cubrir la pantalla y recién ahí corre `onCovered` (navegar al
 * detalle). Si no hay host montado o no se puede medir, corre `onCovered` directo.
 */
export async function expandCard(
  ref: RefObject<ComponentRef<typeof View> | null>,
  opts: { radius: number; from: string; to: string; onCovered: () => void },
) {
  const view = ref.current;
  if (!listener || !view) {
    opts.onCovered();
    return;
  }
  const rect = await new Promise<Rect | null>((resolve) =>
    view.measureInWindow((x, y, width, height) => resolve(width > 0 ? { x, y, width, height } : null)),
  );
  if (!rect) {
    opts.onCovered();
    return;
  }
  const image = capture ? await capture(ref) : null;
  listener?.({ id: nextId++, rect, image, ...opts });
}

const GROW = { duration: 440, easing: Easing.inOut(Easing.cubic) };

/** Se monta una vez en la raíz: dibuja la tarjeta que se expande por encima de todo. */
export function CardExpandHost() {
  const [current, setCurrent] = useState<Expansion | null>(null);
  useEffect(() => {
    listener = setCurrent;
    return () => {
      listener = null;
    };
  }, []);
  if (!current) return null;
  const body = <Expanding key={current.id} data={current} onDone={() => setCurrent(null)} />;
  return Platform.OS === 'ios' ? <FullWindowOverlay>{body}</FullWindowOverlay> : body;
}

function Expanding({ data, onDone }: { data: Expansion; onDone: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const p = useSharedValue(0);
  const fade = useSharedValue(1);
  const { rect } = data;

  useEffect(() => {
    if (reduceMotion) {
      data.onCovered();
      onDone();
      return;
    }
    p.set(
      withTiming(1, GROW, (done) => {
        if (!done) return;
        scheduleOnRN(data.onCovered);
        // Se deja un momento para que el detalle se dibuje debajo y después se desvanece.
        fade.set(withDelay(260, withTiming(0, { duration: 240 }, (ok) => ok && scheduleOnRN(onDone))));
      }),
    );
    // Una sola vez por expansión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = useAnimatedStyle(() => ({
    left: interpolate(p.value, [0, 1], [rect.x, 0]),
    top: interpolate(p.value, [0, 1], [rect.y, 0]),
    width: interpolate(p.value, [0, 1], [rect.width, W]),
    height: interpolate(p.value, [0, 1], [rect.height, H]),
    borderRadius: interpolate(p.value, [0, 1], [data.radius, 0]),
    backgroundColor: interpolateColor(p.value, [0, 0.7, 1], [data.from, data.to, data.to]),
    opacity: fade.value,
  }));
  // El contenido de la tarjeta se queda en su lugar (relativo a la tarjeta) y se desvanece rápido.
  const content = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.45], [1, 0], 'clamp'),
    transform: [{ scale: interpolate(p.value, [0, 0.45], [1, 1.04], 'clamp') }],
  }));

  return (
    <View pointerEvents="auto" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.card, card]}>
        {data.image && SnapshotImage ? (
          <Animated.View style={[{ width: rect.width, height: rect.height }, content]}>
            <SnapshotImage image={data.image} width={rect.width} height={rect.height} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', overflow: 'hidden', borderCurve: 'continuous' },
});
