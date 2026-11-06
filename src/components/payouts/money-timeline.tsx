import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInRight,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { DisplayFont, Radius } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

export type MoneyStep = {
  label: string;
  hint?: string;
  value: string;
  /** El paso que importa (lo que queda o lo que se paga): punto relleno y número fuerte. */
  strong?: boolean;
};

const DOT = 14;
/** Cuánto tarda la línea en llegar de un paso al siguiente. */
const STEP_MS = 420;

/**
 * El recorrido de la plata como línea de tiempo: cada paso en su card, unidos por un riel a la
 * izquierda que se va llenando de arriba hacia abajo; cada punto se enciende cuando la línea lo
 * alcanza. Con "reducir movimiento" aparece completa.
 */
export function MoneyTimeline({ steps, delay = 200 }: { steps: MoneyStep[]; delay?: number }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? steps.length - 1 : 0);
  // Centro vertical de cada punto (se mide), para que el relleno llegue justo a cada uno.
  const [centers, setCenters] = useState<number[]>([]);

  useEffect(() => {
    if (reduceMotion) {
      progress.set(steps.length - 1);
      return;
    }
    progress.set(0);
    progress.set(
      withDelay(delay, withTiming(steps.length - 1, { duration: STEP_MS * (steps.length - 1), easing: Easing.inOut(Easing.cubic) })),
    );
  }, [steps.length, delay, progress, reduceMotion]);

  const measured = centers.length === steps.length && centers.every((c) => c != null);

  return (
    <View style={styles.wrap}>
      {measured ? <Rail centers={centers} progress={progress} /> : null}
      {steps.map((s, i) => (
        <Animated.View
          key={s.label}
          entering={reduceMotion ? undefined : FadeInRight.delay(delay + i * STEP_MS).duration(320).easing(Easing.out(Easing.cubic))}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            setCenters((c) => {
              const next = [...c];
              next[i] = y + height / 2;
              return next;
            });
          }}
          style={styles.step}>
          <Dot index={i} progress={progress} strong={!!s.strong} />
          <View style={[styles.card, s.strong && styles.cardStrong]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.label, s.strong && styles.labelStrong]}>{s.label}</Text>
              {s.hint ? <Text style={[styles.hint, s.strong && styles.hintStrong]}>{s.hint}</Text> : null}
            </View>
            <Text style={[styles.value, s.strong && styles.valueStrong]}>{s.value}</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function Rail({ centers, progress }: { centers: number[]; progress: SharedValue<number> }) {
  const styles = useStyles();
  const top = centers[0];
  const bottom = centers[centers.length - 1];
  const fill = useAnimatedStyle(() => ({
    height: interpolate(progress.value, centers.map((_, i) => i), centers.map((c) => c - top)),
  }));
  return (
    <View pointerEvents="none" style={[styles.rail, { top, height: bottom - top }]}>
      <Animated.View style={[styles.railFill, fill]} />
    </View>
  );
}

function Dot({ index, progress, strong }: { index: number; progress: SharedValue<number>; strong: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const on = Math.min(1, Math.max(0, (progress.value - index) * 4 + 1));
    return {
      transform: [{ scale: 0.6 + on * 0.4 }],
      borderColor: on > 0.5 ? colors.ink : colors.border,
      backgroundColor: strong && on > 0.5 ? colors.brand : colors.surface,
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rail: { position: 'absolute', left: DOT / 2 - 1, width: 2, borderRadius: 1, backgroundColor: c.border, overflow: 'hidden' },
    railFill: { width: 2, backgroundColor: c.ink },
    dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2 },
    card: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    cardStrong: { backgroundColor: c.ink, borderColor: c.ink },
    label: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    labelStrong: { color: c.onInk, fontFamily: DisplayFont.semibold, fontSize: 15 },
    hint: { color: c.textMuted, fontSize: 12 },
    hintStrong: { color: c.onInk, opacity: 0.7 },
    value: { color: c.text, fontSize: 16, fontFamily: DisplayFont.bold, fontVariant: ['tabular-nums'] },
    valueStrong: { color: c.onInk, fontSize: 18 },
  }),
);
