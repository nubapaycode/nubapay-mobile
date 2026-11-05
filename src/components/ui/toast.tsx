import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/dashboard/icon';
import { Confetti } from '@/components/fx/confetti';
import { Lottie } from '@/components/fx/lottie';
import { DisplayFont, Radius } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

type Kind = 'success' | 'error' | 'info';
type ToastData = {
  id: number;
  kind: Kind;
  title: string;
  message?: string;
  /** Éxito importante (algo creado): ícono Lottie y confetti. */
  celebrate?: boolean;
};

/* ───────── Store mínimo: cualquier parte de la app puede avisar sin hooks ni contexto. ───────── */

let nextId = 1;
let listener: ((t: ToastData) => void) | null = null;
const show = (t: Omit<ToastData, 'id'>) => listener?.({ ...t, id: nextId++ });

/**
 * Avisos no bloqueantes (reemplazan a `Alert.alert` cuando no hay nada que decidir):
 * bajan desde arriba, se van solos y se descartan deslizando hacia arriba.
 */
export const toast = {
  success: (title: string, message?: string, opts?: { celebrate?: boolean }) =>
    show({ kind: 'success', title, message, celebrate: opts?.celebrate }),
  error: (title: string, message?: string) => show({ kind: 'error', title, message }),
  info: (title: string, message?: string) => show({ kind: 'info', title, message }),
};

const DURATION: Record<Kind, number> = { success: 2600, error: 4200, info: 3200 };
const IN = { duration: 380, easing: Easing.out(Easing.cubic) };
const OUT = { duration: 240, easing: Easing.in(Easing.cubic) };

/** Se monta una vez en la raíz. En iOS va en una ventana propia para quedar sobre los modales. */
export function ToastHost() {
  const [current, setCurrent] = useState<ToastData | null>(null);

  useEffect(() => {
    listener = (t) => setCurrent(t);
    return () => {
      listener = null;
    };
  }, []);

  if (!current) return null;
  const body = (
    <ToastView key={current.id} data={current} onGone={() => setCurrent((c) => (c?.id === current.id ? null : c))} />
  );
  return Platform.OS === 'ios' ? <FullWindowOverlay>{body}</FullWindowOverlay> : body;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LEN = 20;

function ToastView({ data, onGone }: { data: ToastData; onGone: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(-140);
  const drag = useSharedValue(0);
  const check = useSharedValue(reduceMotion ? 1 : 0);
  const shake = useSharedValue(0);
  const leaving = useRef(false);

  const tone =
    data.kind === 'success' ? colors.success : data.kind === 'error' ? colors.danger : colors.primary;

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    y.set(withTiming(-140, OUT, (done) => done && scheduleOnRN(onGone)));
  };

  useEffect(() => {
    Haptics.notificationAsync(
      data.kind === 'error'
        ? Haptics.NotificationFeedbackType.Error
        : data.kind === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
    );
    y.set(reduceMotion ? 0 : withTiming(0, IN));
    if (!reduceMotion) {
      if (data.kind === 'success') check.set(withDelay(200, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) })));
      if (data.kind === 'error') {
        const step = (x: number) => withTiming(x, { duration: 55, easing: Easing.inOut(Easing.quad) });
        shake.set(withDelay(260, withSequence(step(-7), step(6), step(-4), step(2), step(0))));
      }
    }
    const t = setTimeout(leave, DURATION[data.kind] + (data.celebrate ? 800 : 0));
    return () => clearTimeout(t);
    // Una vez por aviso (cada aviso es un componente nuevo por `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deslizar hacia arriba lo descarta; hacia abajo se resiste.
  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      drag.value = e.translationY < 0 ? e.translationY : e.translationY * 0.15;
    },
    onDeactivate: (e) => {
      'worklet';
      if (drag.value < -28 || e.velocityY < -500) {
        scheduleOnRN(leave);
      } else {
        drag.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
      }
    },
  });

  const wrap = useAnimatedStyle(() => ({
    opacity: Math.min(1, 1 + (y.value + drag.value) / 90),
    transform: [{ translateY: y.value + drag.value }, { translateX: shake.value }],
  }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - check.value) }));

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 6 }]}>
      {data.celebrate ? <Confetti origin={{ x: 40, y: insets.top + 40 }} seed={data.id} /> : null}
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.toast, wrap]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${data.title}${data.message ? `. ${data.message}` : ''}`}>
          {data.celebrate ? (
            <View style={styles.lottieSlot}>
              <Lottie
                name="success"
                size={46}
                loop={false}
                accent={colors.success}
                fallback={<SuccessCheck tone={tone} props={checkProps} />}
              />
            </View>
          ) : data.kind === 'success' ? (
            <SuccessCheck tone={tone} props={checkProps} />
          ) : (
            <View style={[styles.icon, { backgroundColor: tone }]}>
              <Icon name={data.kind === 'error' ? 'close' : 'help'} size={13} color="#ffffff" />
            </View>
          )}
          <View style={styles.texts}>
            <Text style={styles.title} numberOfLines={2}>
              {data.title}
            </Text>
            {data.message ? (
              <Text style={styles.message} numberOfLines={3}>
                {data.message}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function SuccessCheck({ tone, props }: { tone: string; props: object }) {
  const styles = useStyles();
  return (
    <View style={[styles.icon, { backgroundColor: tone }]}>
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <AnimatedPath
          d="M6 12.5l4 4 8-8.5"
          stroke="#ffffff"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
          animatedProps={props}
        />
      </Svg>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    toast: {
      marginHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.elevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadow,
    },
    icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    lottieSlot: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
    texts: { flex: 1, gap: 2 },
    title: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    message: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  }),
);
