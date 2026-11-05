import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { formatMoney, relativeTime } from '@/features/dashboard/format';
import type { ActivityItem } from '@/features/dashboard/types';
import { useNow } from '@/hooks/use-now';
import { makeStyles, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';

/** Cuánto queda cada ítem antes de pasar al siguiente (ms) y cuántos recientes rotan. */
const DWELL = 3400;
const WINDOW = 6;

const KIND: Record<ActivityItem['type'], { icon: IconName; verb: string }> = {
  sale: { icon: 'cart', verb: 'compró' },
  ticket_checkin: { icon: 'ticket', verb: 'ingresó' },
  pickup: { icon: 'check', verb: 'retiró' },
};

const enter = FadeInDown.duration(360)
  .easing(Easing.out(Easing.cubic))
  .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] });
const exit = FadeOutUp.duration(260).easing(Easing.in(Easing.cubic));

/**
 * Tira con la actividad reciente del evento en vivo, de a un ítem: rota entre los últimos y,
 * cuando llega uno nuevo, salta a él con un destello.
 */
export function LiveTicker({ items }: { items: ActivityItem[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const now = useNow(30_000);
  const recent = items.slice(0, WINDOW);
  const [index, setIndex] = useState(0);
  const newest = recent[0]?.order_id;
  const seen = useRef(newest);
  const flash = useSharedValue(0);

  // Llegó actividad nueva: se muestra ya, con destello.
  useEffect(() => {
    if (!newest || newest === seen.current) return;
    seen.current = newest;
    setIndex(0);
    if (!reduceMotion) {
      flash.set(
        withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) })),
      );
    }
  }, [newest, flash, reduceMotion]);

  // Rotación entre los recientes.
  useEffect(() => {
    if (recent.length < 2 || reduceMotion) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % recent.length), DWELL);
    return () => clearInterval(t);
  }, [recent.length, reduceMotion]);

  const glow = useAnimatedStyle(() => ({ opacity: flash.value }));

  const item = recent[index % Math.max(1, recent.length)];
  if (!item) return null;
  const kind = KIND[item.type];
  const who = item.customer_name?.split(' ')[0] ?? 'Alguien';

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Animated.View pointerEvents="none" style={[styles.glow, glow]} />
      <Animated.View
        key={`${item.order_id}-${item.type}-${index}`}
        entering={reduceMotion ? undefined : enter}
        exiting={reduceMotion ? undefined : exit}
        style={styles.row}
        accessibilityLabel={`${who} ${kind.verb} ${item.summary}${item.amount ? `, ${formatMoney(item.amount)}` : ''}`}>
        <View style={styles.icon}>
          <Icon name={kind.icon} size={11} color={colors.text} />
        </View>
        <Text style={styles.text} numberOfLines={1}>
          <Text style={styles.who}>{who}</Text> {kind.verb} {item.summary}
        </Text>
        {item.amount ? <Text style={styles.amount}>{formatMoney(item.amount)}</Text> : null}
        <Text style={styles.time}>{relativeTime(item.at, now)}</Text>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { height: 30, justifyContent: 'center', overflow: 'hidden', borderRadius: 10, marginHorizontal: -6 },
    glow: { ...StyleSheet.absoluteFill, backgroundColor: c.brandMuted },
    row: {
      position: 'absolute',
      left: 6,
      right: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    icon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.hero.glassBorder,
    },
    text: { flex: 1, color: c.textSecondary, fontSize: 13 },
    who: { color: c.text, fontWeight: '600' },
    amount: { color: c.text, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
    time: { color: c.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
  }),
);
