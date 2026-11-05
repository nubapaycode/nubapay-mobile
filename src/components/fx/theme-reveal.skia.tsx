import {
  Canvas,
  Group,
  Image,
  makeImageFromView,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import { type RefObject, useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export type RevealImage = SkImage;

/** Foto de una vista (con sus hijos) como imagen de Skia. */
export const capture = (ref: RefObject<unknown>) =>
  makeImageFromView(ref as Parameters<typeof makeImageFromView>[0]).catch(() => null);

const GROW = { duration: 680, easing: Easing.inOut(Easing.cubic) };

/**
 * Tapa la pantalla con la foto del tema anterior y le abre un agujero circular que crece desde
 * `origin`: por el agujero se ve el tema nuevo, ya renderizado debajo.
 * `onCovered` avisa cuando la foto ya está encima (recién ahí se cambia el tema).
 */
export default function RevealOverlay({
  layers,
  origin,
  onCovered,
  onDone,
}: {
  layers: SkImage[];
  origin: { x: number; y: number };
  onCovered: () => void;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const r = useSharedValue(0);
  const maxR = Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y)) + 8;

  useEffect(() => {
    const t = setTimeout(onCovered, 48);
    r.set(withDelay(150, withTiming(maxR, GROW, (done) => done && scheduleOnRN(onDone))));
    return () => clearTimeout(t);
    // Una sola vez por transición (el overlay se monta de nuevo en cada una).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clip = useDerivedValue(() => Skia.Path.Circle(origin.x, origin.y, r.value));

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group clip={clip} invertClip>
        {layers.map((image, i) => (
          <Image key={i} image={image} x={0} y={0} width={width} height={height} fit="fill" />
        ))}
      </Group>
    </Canvas>
  );
}
