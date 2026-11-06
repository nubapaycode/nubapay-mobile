import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

const HEIGHT = 58;
const PAD = 5;
const THUMB = HEIGHT - PAD * 2;
/** Fracción del recorrido a cruzar para que soltar confirme. */
const TRIGGER = 0.82;
const BACK = { duration: 280, easing: Easing.out(Easing.cubic) };
const SNAP = { duration: 160, easing: Easing.out(Easing.quad) };

/**
 * "Deslizá para confirmar": para acciones que no conviene disparar con un toque accidental
 * (entregar un pedido, aprobar efectivo). El pulgar arrastra un relleno lima; al pasar el umbral
 * hay un háptico y, al soltar, confirma. Si no llega, vuelve. Mientras `loading` queda al final
 * con un spinner; si después no se completó (error), vuelve solo al inicio.
 *
 * Con lector de pantalla no se puede arrastrar: la acción "activar" confirma directamente.
 */
export function SlideToConfirm({
  label,
  onConfirm,
  loading = false,
  disabled = false,
}: {
  label: string;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const max = useSharedValue(1);
  const past = useSharedValue(0);
  const nudge = useSharedValue(0);

  // Al terminar de cargar (o si se deshabilita) el pulgar vuelve al inicio.
  useEffect(() => {
    if (!loading) x.set(withTiming(0, BACK));
  }, [loading, x]);

  // Pista de que se arrastra: la flecha se asoma hacia la derecha cada tanto.
  useEffect(() => {
    if (reduceMotion || disabled || loading) {
      nudge.set(withTiming(0, { duration: 120 }));
      return;
    }
    const out = { duration: 260, easing: Easing.out(Easing.quad) };
    const back = { duration: 320, easing: Easing.inOut(Easing.quad) };
    nudge.set(
      withRepeat(withSequence(withDelay(1400, withTiming(1, out)), withTiming(0, back)), -1, false),
    );
  }, [reduceMotion, disabled, loading, nudge]);

  useAnimatedReaction(
    () => x.value >= max.value * TRIGGER,
    (now, prev) => {
      if (prev === null || now === prev) return;
      past.value = withTiming(now ? 1 : 0, { duration: 120 });
      if (now) scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
    },
  );

  const confirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  };

  const pan = usePanGesture({
    enabled: !disabled && !loading,
    activeOffsetX: [-6, 6],
    failOffsetY: [-14, 14],
    onUpdate: (e) => {
      'worklet';
      x.set(Math.min(max.get(), Math.max(0, e.translationX)));
    },
    onDeactivate: (e) => {
      'worklet';
      const done = x.get() >= max.get() * TRIGGER || (e.velocityX > 1200 && x.get() > max.get() * 0.5);
      if (done) {
        x.set(withTiming(max.get(), SNAP));
        scheduleOnRN(confirm);
      } else {
        x.set(withTiming(0, BACK));
      }
    },
  });

  const fill = useAnimatedStyle(() => ({ width: x.value + THUMB + PAD }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: 1 + past.value * 0.06 }],
  }));
  const arrow = useAnimatedStyle(() => ({
    transform: [{ translateX: nudge.value * 4 }],
    opacity: 1 - past.value,
  }));
  const check = useAnimatedStyle(() => ({ opacity: past.value, transform: [{ scale: 0.6 + past.value * 0.4 }] }));
  const text = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, max.value * 0.5], [1, 0], 'clamp'),
    transform: [{ translateX: interpolate(x.value, [0, max.value], [0, 24], 'clamp') }],
  }));

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Deslizá a la derecha para confirmar"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && !disabled && !loading && confirm()}
      onLayout={(e) => max.set(Math.max(1, e.nativeEvent.layout.width - THUMB - PAD * 2))}
      style={[styles.track, disabled && !loading && styles.disabled]}>
      <Animated.View style={[styles.fill, fill]} />
      <Animated.Text style={[styles.label, text]} numberOfLines={1}>
        {label}
      </Animated.Text>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, thumb]} hitSlop={8}>
          {loading ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <>
              <Animated.View style={[StyleSheet.absoluteFill, styles.center, arrow]}>
                <Icon name="chevronsRight" size={18} color={colors.onBrand} />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, styles.center, check]}>
                <Icon name="checkmark" size={20} color={colors.onBrand} />
              </Animated.View>
            </>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    track: {
      height: HEIGHT,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.ink,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    disabled: { opacity: 0.4 },
    fill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.brand,
      opacity: 0.32,
    },
    label: {
      position: 'absolute',
      left: THUMB + PAD * 2,
      right: PAD * 2,
      textAlign: 'center',
      color: c.onInk,
      fontSize: 16,
      fontFamily: DisplayFont.semibold,
    },
    thumb: {
      position: 'absolute',
      left: PAD,
      width: THUMB,
      height: THUMB,
      borderRadius: Radius.xl - PAD,
      borderCurve: 'continuous',
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: { alignItems: 'center', justifyContent: 'center' },
  }),
);
