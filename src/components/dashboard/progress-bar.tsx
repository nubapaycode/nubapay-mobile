import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

type Segment = { value: number; color: string };

/**
 * Barra de progreso con uno o más tramos (proporciones de `total`).
 * Separación de 2 px entre tramos y extremos redondeados.
 */
export function ProgressBar({
  segments,
  total,
  height = 8,
  track,
  delay = 0,
}: {
  segments: Segment[];
  total: number;
  height?: number;
  track?: string;
  delay?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: track ?? colors.raised },
      ]}>
      {segments.map((s, i) => (
        <Fill
          key={i}
          ratio={total > 0 ? s.value / total : 0}
          color={s.color}
          radius={height / 2}
          delay={delay + i * 80}
          gap={i > 0}
        />
      ))}
    </View>
  );
}

function Fill({
  ratio,
  color,
  radius,
  delay,
  gap,
}: {
  ratio: number;
  color: string;
  radius: number;
  delay: number;
  gap: boolean;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    const target = Math.max(0, Math.min(1, ratio));
    const t = setTimeout(() => {
      progress.set(withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) }));
    }, delay);
    return () => clearTimeout(t);
  }, [ratio, delay, progress]);

  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <Animated.View
      style={[
        { backgroundColor: color, borderRadius: radius, marginLeft: gap ? 2 : 0, height: '100%' },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', overflow: 'hidden', width: '100%' },
});
