import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  type SharedValue,
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, type IconName } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';

const BACK = { duration: 280, easing: Easing.out(Easing.cubic) };
/** Fracción del ancho a cruzar para que soltar ejecute la acción. */
const TRIGGER = 0.36;

export type SwipeAction = {
  label: string;
  icon: IconName;
  onTrigger: () => void;
  /** Fondo suave mientras se arrastra y fuerte al pasar el umbral, con el color del texto en cada caso. */
  tone: { soft: string; strong: string; fg: string; onStrong: string };
};

/**
 * Card que se desliza para una acción rápida (estilo Mail): `start` aparece al arrastrar a la
 * derecha y `end` a la izquierda. Al cruzar el umbral hay háptico y "pop" del ícono; al soltar se
 * ejecuta y la card vuelve a su lugar. Hacia un lado sin acción apenas cede. Sin rebote.
 */
export function SwipeActions({
  start,
  end,
  children,
}: {
  start?: SwipeAction;
  end?: SwipeAction;
  children: ReactNode;
}) {
  const tx = useSharedValue(0);
  const width = useSharedValue(1);
  const past = useSharedValue(0);
  const pop = useSharedValue(1);
  const hasStart = !!start;
  const hasEnd = !!end;

  useAnimatedReaction(
    () => (Math.abs(tx.value) >= width.value * TRIGGER ? Math.sign(tx.value) : 0),
    (now, prev) => {
      if (now === prev) return;
      past.value = withTiming(now !== 0 ? 1 : 0, { duration: 140 });
      if (now !== 0) {
        pop.value = withSequence(
          withTiming(1.25, { duration: 110, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 160, easing: Easing.inOut(Easing.quad) }),
        );
        scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
      }
    },
  );

  const run = (dir: number) => (dir > 0 ? start : end)?.onTrigger();

  const pan = usePanGesture({
    enabled: hasStart || hasEnd,
    activeOffsetX: [-12, 12],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      let x = e.translationX;
      if ((x > 0 && !hasStart) || (x < 0 && !hasEnd)) x = x / 6;
      const max = width.get() * 0.55;
      if (Math.abs(x) > max) x = Math.sign(x) * (max + (Math.abs(x) - max) / 3);
      tx.set(x);
    },
    onDeactivate: () => {
      'worklet';
      const x = tx.get();
      const dir = Math.abs(x) >= width.get() * TRIGGER ? Math.sign(x) : 0;
      tx.set(withTiming(0, BACK));
      if ((dir > 0 && !hasStart) || (dir < 0 && !hasEnd)) return;
      if (dir !== 0) scheduleOnRN(run, dir);
    },
  });

  const move = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <View onLayout={(e) => width.set(e.nativeEvent.layout.width || 1)}>
      {start ? <Track action={start} side="start" tx={tx} width={width} past={past} pop={pop} /> : null}
      {end ? <Track action={end} side="end" tx={tx} width={width} past={past} pop={pop} /> : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={move}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

type SV = SharedValue<number>;

function Track({
  action,
  side,
  tx,
  width,
  past,
  pop,
}: {
  action: SwipeAction;
  side: 'start' | 'end';
  tx: SV;
  width: SV;
  past: SV;
  pop: SV;
}) {
  const sign = side === 'start' ? 1 : -1;
  const { tone } = action;

  const track = useAnimatedStyle(() => ({
    opacity: interpolate(sign * tx.value, [0, 24], [0, 1], 'clamp'),
    backgroundColor: interpolateColor(past.value, [0, 1], [tone.soft, tone.strong]),
  }));
  const content = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, sign * tx.value) / (width.value * TRIGGER));
    return { opacity: p, transform: [{ scale: (0.6 + p * 0.4) * pop.value }] };
  });
  const fg = useAnimatedStyle(() => ({
    color: interpolateColor(past.value, [0, 1], [tone.fg, tone.onStrong]),
  }));

  const icon = <Icon name={action.icon} size={17} color={tone.fg} />;
  const text = <Animated.Text style={[styles.text, fg]}>{action.label}</Animated.Text>;

  return (
    <Animated.View
      style={[styles.track, side === 'start' ? styles.start : styles.end, track]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <Animated.View style={[styles.content, content]}>
        {side === 'start' ? (
          <>
            {icon}
            {text}
          </>
        ) : (
          <>
            {text}
            {icon}
          </>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  start: { justifyContent: 'flex-start' },
  end: { justifyContent: 'flex-end' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 14, fontFamily: DisplayFont.semibold },
});
