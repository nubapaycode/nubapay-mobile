import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
import { makeStyles } from '@/theme';

/** Indicador "EN VIVO": punto de marca con halo que late. */
export function LivePill({ label = 'EN VIVO', compact }: { label?: string; compact?: boolean }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(
      withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false),
    );
  }, [pulse, reduceMotion]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.6 }],
  }));

  const dot = (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.halo, halo]} />
      <View style={styles.dot} />
    </View>
  );
  if (compact) return dot;

  return (
    <View style={styles.pill} accessibilityLabel="Evento en vivo">
      {dot}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      height: 26,
      borderRadius: Radius.pill,
      backgroundColor: c.brandMuted,
    },
    dotWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
    halo: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: c.brand },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.brand },
    label: { color: c.brandText, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  }),
);
