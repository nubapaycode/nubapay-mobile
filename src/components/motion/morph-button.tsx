import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { useTheme } from '@/theme';

export type MorphStatus = 'idle' | 'loading' | 'done';

const SHRINK = { duration: 260, easing: Easing.inOut(Easing.cubic) };
/** Cuánto se ve el resultado (check o avión) antes de avisar con `onDone`. */
const HOLD_MS = 820;
const CHECK_LEN = 20;
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Estado del botón para una acción async: `run(task)` pasa a "cargando" y, si `task` devuelve true,
 * a "listo"; si no, vuelve al reposo (el error lo muestra quien llama).
 */
export function useMorphStatus() {
  const [status, setStatus] = useState<MorphStatus>('idle');
  const run = useCallback(async (task: () => Promise<boolean>) => {
    setStatus('loading');
    const ok = await task();
    setStatus(ok ? 'done' : 'idle');
    return ok;
  }, []);
  const reset = useCallback(() => setStatus('idle'), []);
  return { status, run, reset };
}

/**
 * Botón que cuenta lo que pasa sin toast: el texto se va y la píldora se cierra en un círculo con
 * el spinner; al terminar se pone verde y dibuja el check (o, con `effect="fly"`, sale volando un
 * avión de papel). Después llama a `onDone` (navegar, cerrar, o `reset` para volver al texto).
 */
export function MorphButton({
  label,
  status,
  onPress,
  onDone,
  disabled = false,
  dimmed = false,
  effect = 'check',
  colors: tone,
  height = 54,
}: {
  label: string;
  status: MorphStatus;
  onPress: () => void;
  onDone?: () => void;
  disabled?: boolean;
  /** Se ve apagado pero se puede tocar (p. ej. para mostrar qué falta completar). */
  dimmed?: boolean;
  effect?: 'check' | 'fly';
  /** Fondo y texto en reposo (y apagado). Por defecto, tinta. */
  colors?: { bg: string; fg: string; offBg?: string; offFg?: string };
  height?: number;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const bg = tone?.bg ?? colors.ink;
  const fg = tone?.fg ?? colors.onInk;
  const off = (disabled || dimmed) && status === 'idle';
  const offBg = tone?.offBg ?? colors.raised;
  const width = useSharedValue(0);
  const shrink = useSharedValue(0);
  const done = useSharedValue(0);
  const draw = useSharedValue(0);
  const fly = useSharedValue(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const t = (v: number, cfg = SHRINK) => (reduceMotion ? v : withTiming(v, cfg));
    shrink.set(t(status === 'idle' ? 0 : 1));
    done.set(t(status === 'done' ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) }));
    if (status !== 'done') {
      draw.set(0);
      fly.set(0);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (effect === 'check') {
      draw.set(reduceMotion ? 1 : withDelay(120, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) })));
    } else {
      fly.set(reduceMotion ? 1 : withDelay(160, withTiming(1, { duration: 520, easing: Easing.in(Easing.cubic) })));
    }
    const timer = setTimeout(() => onDoneRef.current?.(), reduceMotion ? 500 : HOLD_MS);
    return () => clearTimeout(timer);
  }, [status, effect, reduceMotion, shrink, done, draw, fly]);

  const pill = useAnimatedStyle(() => {
    const w = width.value;
    return {
      width: w > 0 ? w - shrink.value * (w - height) : '100%',
      borderRadius: Radius.xl + shrink.value * (height / 2 - Radius.xl),
      backgroundColor: interpolateColor(done.value, [0, 1], [off ? offBg : bg, colors.success]),
    };
  });
  const text = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, shrink.value * 2.2),
    transform: [{ scale: 1 - shrink.value * 0.12 }],
  }));
  const spinner = useAnimatedStyle(() => ({ opacity: shrink.value * (1 - done.value) }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - draw.value) }));
  const plane = useAnimatedStyle(() => {
    const f = fly.value;
    return {
      opacity: done.value * (1 - Math.max(0, f - 0.6) / 0.4),
      transform: [{ translateX: f * 90 }, { translateY: f * -70 }, { rotate: `${-f * 18}deg` }, { scale: 1 - f * 0.3 }],
    };
  });

  const busy = status !== 'idle';
  return (
    <View onLayout={(e) => width.set(e.nativeEvent.layout.width)} style={{ alignItems: 'center' }}>
      <Pressable
        onPress={onPress}
        disabled={disabled || busy}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || busy, busy: status === 'loading' }}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }, { alignSelf: 'stretch', alignItems: 'center' }]}>
        <Animated.View
          style={[
            styles.pill,
            { height },
            pill,
          ]}>
          <Animated.Text
            numberOfLines={1}
            style={[styles.label, { color: off ? (tone?.offFg ?? colors.textMuted) : fg }, text]}>
            {label}
          </Animated.Text>
          {busy ? (
            <>
              <Animated.View style={[StyleSheet.absoluteFill, styles.center, spinner]}>
                <ActivityIndicator color={fg} />
              </Animated.View>
              <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
                {effect === 'check' ? (
                  <Svg width={26} height={26} viewBox="0 0 24 24">
                    <AnimatedPath
                      d="M6 12.5l4 4 8-8.5"
                      stroke="#ffffff"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
                      animatedProps={checkProps}
                    />
                  </Svg>
                ) : (
                  <Animated.View style={plane}>
                    <Icon name="send" size={20} color="#ffffff" />
                  </Animated.View>
                )}
              </View>
            </>
          ) : null}
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', overflow: 'visible' },
  label: { fontSize: 16, fontFamily: DisplayFont.semibold, paddingHorizontal: 16 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
