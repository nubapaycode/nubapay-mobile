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

/** Anillos concéntricos de progreso (el exterior primero). Se llenan con ease-out al montar/cambiar. */
export function Rings({
  rings,
  size = 132,
  stroke = 12,
  gap = 5,
}: {
  rings: RingSpec[];
  size?: number;
  stroke?: number;
  gap?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap);
        return (
          <RingArc
            key={i}
            radius={radius}
            center={size / 2}
            stroke={stroke}
            ratio={r.ratio}
            color={r.color}
            delay={i * 140}
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
