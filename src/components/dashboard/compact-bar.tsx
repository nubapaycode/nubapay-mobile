import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayFont } from '@/constants/theme';
import { formatMoney } from '@/features/dashboard/format';
import { makeStyles } from '@/theme';

import { LivePill } from './live-pill';

/** Desde qué scroll empieza a aparecer y en cuántos px termina (el hero ya se fue de pantalla). */
const START = 150;
const RANGE = 70;

type Props = {
  scrollY: SharedValue<number>;
  eventName: string | null;
  revenue: number | null;
  live: boolean;
};

/**
 * Barra fija arriba del inicio: al principio solo cubre la barra de estado y es transparente;
 * cuando el hero sale de pantalla se vuelve sólida y entran el evento y la recaudación en chico.
 */
export function CompactBar({ scrollY, eventName, revenue, live }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const bg = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 140], [0, 1], Extrapolation.CLAMP),
  }));
  const body = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [START, START + RANGE], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * -10 }] };
  });
  const border = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [START, START + RANGE], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {/* Primero solo la franja de la barra de estado; después toda la barra. */}
      <Animated.View style={[styles.bg, { height: insets.top }, bg]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.solid, border]} />
      <View style={{ height: insets.top }} />
      <Animated.View style={[styles.body, body]} accessibilityElementsHidden>
        <View style={styles.left}>
          {live ? <LivePill compact /> : null}
          <Text style={styles.name} numberOfLines={1}>
            {eventName ?? ''}
          </Text>
        </View>
        {revenue != null ? <Text style={styles.amount}>{formatMoney(revenue)}</Text> : null}
      </Animated.View>
      <Animated.View style={[styles.border, border]} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { position: 'absolute', top: 0, left: 0, right: 0 },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: c.backgroundTranslucent },
    solid: { backgroundColor: c.backgroundTranslucent },
    body: {
      height: 44,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    name: { color: c.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
    amount: {
      color: c.text,
      fontSize: 17,
      fontFamily: DisplayFont.bold,
      fontVariant: ['tabular-nums'],
    },
    border: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  }),
);
