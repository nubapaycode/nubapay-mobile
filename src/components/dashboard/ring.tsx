import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type RingSpec = { ratio: number; color: string };

/**
 * Anillos concéntricos de progreso (el exterior primero). Se llenan con ease-out al montar/cambiar.
 * Con `ticks` (p. ej. [0.25, 0.5, 0.75]) el anillo exterior lleva puntos de hito: apagados sobre
 * la pista y encendidos cuando el progreso los pasa.
 */
export function Rings({
  rings,
  size = 132,
  stroke = 12,
  gap = 5,
  ticks,
}: {
  rings: RingSpec[];
  size?: number;
  stroke?: number;
  gap?: number;
  ticks?: number[];
}) {
  const { colors } = useTheme();
  const center = size / 2;
  const outer = size / 2 - stroke / 2;
  const reached = rings[0]?.ratio ?? 0;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap);
        return (
          <RingArc
            key={i}
            radius={radius}
            center={center}
            stroke={stroke}
            ratio={r.ratio}
            color={r.color}
            delay={i * 140}
          />
        );
      })}
      {ticks?.map((t) => {
        const angle = (t * 360 - 90) * (Math.PI / 180);
        const on = reached >= t;
        return (
          <Circle
            key={t}
            cx={center + outer * Math.cos(angle)}
            cy={center + outer * Math.sin(angle)}
            r={Math.max(1.4, stroke * 0.3)}
            fill={on ? colors.surface : colors.borderStrong}
          />
        );
      })}
    </Svg>
  );
}

function RingArc({
  radius,
  center,
  stroke,
  ratio,
  color,
  delay,
}: {
  radius: number;
  center: number;
  stroke: number;
  ratio: number;
  color: string;
  delay: number;
}) {
  const { colors } = useTheme();
  const c = 2 * Math.PI * radius;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(
      withDelay(
        delay,
        withTiming(Math.max(0, Math.min(1, ratio)), {
          duration: 1000,
          easing: Easing.out(Easing.cubic),
        }),
      ),
    );
  }, [ratio, delay, progress]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.value) }));

  return (
    <>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={colors.raised}
        strokeWidth={stroke}
        fill="none"
      />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${c} ${c}`}
        animatedProps={props}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </>
  );
}
