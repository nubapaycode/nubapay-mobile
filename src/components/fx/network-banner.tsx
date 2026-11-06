import { requireOptionalNativeModule } from 'expo';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { useTheme } from '@/theme';

/** `expo-network` es nativo: sin él en el build no hay banner (y nada se rompe). */
type NetworkModule = typeof import('expo-network');
const Network: NetworkModule | null = requireOptionalNativeModule('ExpoNetwork')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-network') as NetworkModule)
  : null;

const IN = { duration: 320, easing: Easing.out(Easing.cubic) };
const OUT = { duration: 260, easing: Easing.in(Easing.cubic) };
/** Cuánto queda a la vista el "Conectado otra vez" antes de irse. */
const BACK_MS = 1600;

type Status = 'online' | 'offline' | 'back';

function useConnection(): Status {
  const [status, setStatus] = useState<Status>('online');
  const offline = useRef(false);

  useEffect(() => {
    if (!Network) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = (connected: boolean | undefined) => {
      if (connected === false && !offline.current) {
        offline.current = true;
        clearTimeout(timer);
        setStatus('offline');
      } else if (connected && offline.current) {
        offline.current = false;
        setStatus('back');
        timer = setTimeout(() => setStatus('online'), BACK_MS);
      }
    };
    Network.getNetworkStateAsync()
      .then((s) => apply(s.isConnected))
      .catch(() => {});
    const sub = Network.addNetworkStateListener((s) => apply(s.isConnected));
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, []);

  return status;
}

/**
 * Aviso de conexión arriba de todo: baja cuando se corta internet ("Sin conexión") y, al volver,
 * se pone verde ("Conectado otra vez") y se va solo. No tapa toques fuera de la píldora.
 */
export function NetworkBanner() {
  const status = useConnection();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);
  const green = useSharedValue(0);

  useEffect(() => {
    if (status === 'offline') {
      green.set(0);
      shown.set(withTiming(1, reduceMotion ? { duration: 1 } : IN));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (status === 'back') {
      green.set(withTiming(1, { duration: 240 }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      shown.set(withTiming(0, reduceMotion ? { duration: 1 } : OUT));
    }
  }, [status, shown, green, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * -(insets.top + 60) }, { scale: 0.92 + shown.value * 0.08 }],
    backgroundColor: interpolateColor(green.value, [0, 1], [colors.ink, colors.success]),
  }));

  if (!Network) return null;
  // Al irse ("online") sigue mostrando "Conectado otra vez": siempre llega después de "back".
  const back = status !== 'offline';
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.pill, { top: insets.top + 6 }, style]}>
      <Icon name={back ? 'wifi' : 'wifiOff'} size={14} color={back ? '#ffffff' : colors.onInk} />
      <Text style={[styles.text, { color: back ? '#ffffff' : colors.onInk }]}>
        {back ? 'Conectado otra vez' : 'Sin conexión · los datos pueden no estar al día'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
  },
  text: { fontSize: 13, fontFamily: DisplayFont.semibold },
});
