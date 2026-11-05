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
import { makeStyles, useTheme } from '@/theme';

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
        <Block w={150} h={12} />
        <Block w={240} h={44} r={10} />
        <Block w={170} h={22} r={11} />
        <Block w="100%" h={150} r={14} />
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
    // Transparente y centrado, como el hero: el degradé del inicio se ve detrás.
    hero: {
      gap: 12,
      alignItems: 'center',
      marginBottom: Spacing.three,
      paddingVertical: Spacing.three,
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
      boxShadow: c.cardShadow,
    },
  }),
);
