import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';

const FRAME = 248;

/**
 * Escáner de QR (entradas y retiros) a pantalla completa, sobre fondo oscuro.
 * Por ahora es solo la UI: la cámara necesita `expo-camera` (y un build de desarrollo nuevo).
 * TODO: instalar expo-camera, pedir permiso y validar el código contra el backend.
 */
export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const line = useSharedValue(0);
  useFocusStatusBar('light');

  // Línea de escaneo que recorre el marco (suave, ida y vuelta).
  useEffect(() => {
    if (reduceMotion) return;
    line.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [line, reduceMotion]);
  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: line.value * (FRAME - 4) }],
  }));

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.top}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.round}>
          <Icon name="close" size={16} color="#ffffff" />
        </Pressable>
        <Text style={styles.title}>Escanear QR</Text>
        <Pressable
          onPress={() => Haptics.selectionAsync() /* TODO: linterna con expo-camera */}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Linterna"
          style={styles.round}>
          <Icon name="flashlight" size={16} color="#ffffff" />
        </Pressable>
      </View>

      <View style={styles.center}>
        <View style={styles.frame}>
          {/* Esquinas del visor */}
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          <Animated.View style={[styles.scanLine, lineStyle]} />
        </View>
        <Text style={styles.hint}>Apuntá al código QR de la entrada o del pedido</Text>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.pending}>
          La cámara todavía no está conectada en esta versión de la app.
        </Text>
      </View>
    </View>
  );
}

const CORNER = 30;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05070b', paddingHorizontal: Spacing.three },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#ffffff', fontSize: 17, fontFamily: DisplayFont.semibold },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  frame: { width: FRAME, height: FRAME, borderRadius: Radius.xl, overflow: 'hidden' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#ffffff' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
  scanLine: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#c6ff00',
  },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 15, textAlign: 'center', maxWidth: 260 },
  bottom: { alignItems: 'center' },
  pending: { color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center' },
});
