import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Segment = { value: number; color: string };

/**
 * Donut segmentado (estilo analíticas de Revolut): cada tramo es una parte del total, con una
 * separación entre tramos. Se dibuja en sentido horario al montar; con `active` el resto se atenúa.
 * `children` va centrado adentro.
 */
export function Donut({
  segments,
  size = 232,
  stroke = 14,
  gap = 6,
  active = null,
  delay = 160,
  children,
}: {
  segments: Segment[];
  size?: number;
  stroke?: number;
  /** Separación visible entre tramos, en px. */
  gap?: number;
  /** Índice del tramo resaltado (los demás se atenúan); null = todos iguales. */
  active?: number | null;
  delay?: number;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const radius = size / 2 - stroke / 2;
  const center = size / 2;
  const circ = 2 * Math.PI * radius;
  const total = segments.reduce((a, s) => a + s.value, 0);
  const parts = segments.filter((s) => s.value > 0);
  // Con extremos redondeados el trazo sobresale stroke/2 de cada lado: se descuenta del largo.
  const trim = parts.length > 1 ? gap + stroke : 0;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(0);
    progress.set(
      withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })),
    );
  }, [total, parts.length, delay, progress]);

  // Inicio de cada tramo = suma de los anteriores.
  const lens = parts.map((s) => (total ? (s.value / total) * circ : 0));
  const arcs = parts.map((s, i) => ({
    start: lens.slice(0, i).reduce((a, n) => a + n, 0),
    draw: Math.max(0.001, lens[i] - trim),
    color: s.color,
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.raised}
          strokeWidth={stroke}
          fill="none"
        />
        {arcs.map((a, i) => (
          <Arc
            key={i}
            center={center}
            radius={radius}
            stroke={stroke}
            circ={circ}
            start={a.start + (parts.length > 1 ? trim / 2 : 0)}
            draw={a.draw}
            color={a.color}
            progress={progress}
            dimmed={active != null && active !== i}
          />
        ))}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

function Arc({
  center,
  radius,
  stroke,
  circ,
  start,
  draw,
  color,
  progress,
  dimmed,
}: {
  center: number;
  radius: number;
  stroke: number;
  circ: number;
  start: number;
  draw: number;
  color: string;
  progress: SharedValue<number>;
  dimmed: boolean;
}) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(withTiming(dimmed ? 0.25 : 1, { duration: 220, easing: Easing.out(Easing.quad) }));
  }, [dimmed, opacity]);

  // El barrido recorre la circunferencia: cada tramo crece cuando el barrido llega a su inicio.
  const props = useAnimatedProps(() => {
    const swept = progress.value * circ - start;
    const visible = Math.max(0, Math.min(draw, swept));
    return { strokeDashoffset: draw - visible, strokeOpacity: visible > 0 ? opacity.value : 0 };
  });

  const angle = (start / circ) * 360 - 90;
  return (
    <AnimatedCircle
      cx={center}
      cy={center}
      r={radius}
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={`${draw} ${circ}`}
      animatedProps={props}
      transform={`rotate(${angle} ${center} ${center})`}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
