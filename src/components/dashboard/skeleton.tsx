import { useEffect } from 'react';
import { type DimensionValue, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { light, makeStyles, useTheme } from '@/theme';

function Block({
  w,
  h,
  r = 8,
  tone,
}: {
  w: DimensionValue;
  h: number;
  r?: number;
  tone?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ width: w, height: h, borderRadius: r, backgroundColor: tone ?? colors.raised }} />
  );
}

/** Esqueleto con la forma real del home (no un spinner). */
export function DashboardSkeleton() {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!reduceMotion) o.set(withRepeat(withTiming(0.45, { duration: 800 }), -1, true));
  }, [o, reduceMotion]);
  const pulse = useAnimatedStyle(() => ({ opacity: o.value }));

  return (
    <Animated.View style={[styles.wrap, pulse]} accessibilityLabel="Cargando métricas">
      <View style={styles.hero}>
        <Block w={130} h={12} tone={light.raised} />
        <Block w={230} h={40} r={10} tone={light.raised} />
        <Block w={170} h={16} tone={light.raised} />
        <Block w="100%" h={176} r={14} tone={light.raised} />
      </View>
      <View style={styles.row}>
        <View style={styles.tile}>
          <Block w={90} h={14} />
          <Block w={76} h={76} r={38} />
        </View>
        <View style={styles.tile}>
          <Block w={70} h={14} />
          <Block w="70%" h={28} r={8} />
          <Block w="100%" h={6} r={3} />
        </View>
      </View>
      <View style={styles.tile}>
        <Block w={80} h={14} />
        <Block w="100%" h={10} r={5} />
        <Block w="60%" h={12} />
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    hero: {
      gap: 12,
      marginHorizontal: -Spacing.three,
      marginBottom: Spacing.three,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.four,
      backgroundColor: '#ffffff',
    },
    row: { flexDirection: 'row', gap: 12 },
    tile: {
      flex: 1,
      gap: 14,
      padding: Spacing.three,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
  }),
);
