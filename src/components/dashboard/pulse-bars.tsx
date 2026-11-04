import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

/** Pedidos por minuto (últimos 30). El minuto actual se resalta en lima. */
export function PulseBars({
  values,
  height = 56,
  live,
  color,
  highlight,
}: {
  values: number[];
  height?: number;
  live: boolean;
  /** Color de las barras anteriores (por defecto, la primera serie). */
  color?: string;
  /** Color del minuto actual (por defecto, lima de marca). */
  highlight?: string;
}) {
  const { colors } = useTheme();
  const max = Math.max(1, ...values);
  return (
    <View style={[styles.row, { height }]}>
      {values.map((v, i) => (
        <Bar
          key={i}
          ratio={v / max}
          height={height}
          color={live && i === values.length - 1 ? (highlight ?? colors.brand) : (color ?? colors.chart.series[0])}
          empty={colors.raised}
          delay={i * 12}
        />
      ))}
    </View>
  );
}

function Bar({
  ratio,
  height,
  color,
  empty,
  delay,
}: {
  ratio: number;
  height: number;
  color: string;
  empty: string;
  delay: number;
}) {
  const h = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      h.set(
        withTiming(Math.max(3, ratio * height), {
          duration: 500,
          easing: Easing.out(Easing.cubic),
        }),
      );
    }, delay);
    return () => clearTimeout(t);
  }, [ratio, height, delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <View style={styles.slot}>
      <Animated.View
        style={[styles.bar, { backgroundColor: ratio === 0 ? empty : color }, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
});
