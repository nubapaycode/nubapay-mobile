import { router } from 'expo-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { makeStyles } from '@/theme';

const OPEN = { duration: 380, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 260, easing: Easing.in(Easing.cubic) };
const BACK = { duration: 220, easing: Easing.out(Easing.cubic) };

type SheetApi = {
  /** Cierra la hoja con su animación y, al terminar, vuelve atrás y corre `after`. */
  dismiss: (after?: () => void) => void;
};

const SheetContext = createContext<SheetApi | null>(null);

export function useSheet(): SheetApi {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('useSheet debe usarse dentro de <Sheet>');
  return ctx;
}

/**
 * Hoja inferior propia (la ruta se presenta como `transparentModal`): todo el ancho, pegada al borde
 * inferior y con esquinas superiores redondeadas. La hoja nativa de iOS 26 flota con márgenes en
 * los detents parciales y no se puede evitar. Entra y sale sin rebote; se cierra arrastrando hacia
 * abajo desde la manija o tocando el fondo.
 */
export function Sheet({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(height);
  const start = useSharedValue(0);
  const closing = useRef(false);
  // Lo que corre después de cerrar se guarda acá (del lado JS), no viaja al hilo de UI.
  const pending = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    y.set(reduceMotion ? 0 : withTiming(0, OPEN));
  }, [reduceMotion, y]);

  // Con el teclado abierto la hoja sube encima de él (para formularios dentro de la hoja).
  const keyboard = useSharedValue(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      keyboard.set(
        withTiming(e.endCoordinates.height, {
          duration: e.duration || 250,
          easing: Easing.out(Easing.cubic),
        }),
      );
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      keyboard.set(withTiming(0, { duration: e?.duration || 220, easing: Easing.out(Easing.cubic) }));
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboard]);

  const finish = useCallback(() => {
    router.back();
    pending.current?.();
  }, []);

  const dismiss = useCallback(
    (after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      pending.current = after;
      if (reduceMotion) return finish();
      y.set(
        withTiming(height, CLOSE, (done) => {
          if (done) scheduleOnRN(finish);
        }),
      );
    },
    [finish, height, reduceMotion, y],
  );

  // Arrastrar hacia abajo desde la manija: pasado un tercio de la pantalla o con un gesto rápido, cierra.
  const pan = usePanGesture({
    activeOffsetY: 6,
    onActivate: () => {
      'worklet';
      start.set(y.get());
    },
    onUpdate: (e) => {
      'worklet';
      const next = start.get() + e.translationY;
      // Hacia arriba ofrece resistencia; hacia abajo sigue al dedo.
      y.set(next < 0 ? next / 4 : next);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.velocityY > 900 || y.get() > height / 3) {
        scheduleOnRN(dismiss, undefined);
      } else {
        y.set(withTiming(0, BACK));
      }
    },
  });

  const maxHeight = height - insets.top - 24;
  const panel = useAnimatedStyle(() => ({
    bottom: keyboard.value,
    maxHeight: maxHeight - keyboard.value,
    transform: [{ translateY: Math.max(y.value, -24) }],
  }));
  const backdrop = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, height * 0.6], [1, 0], 'clamp'),
  }));

  const api = useMemo(() => ({ dismiss }), [dismiss]);

  return (
    <SheetContext.Provider value={api}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
        </Animated.View>

        <Animated.View
          style={[styles.panel, panel]}
          accessibilityViewIsModal>
          <GestureDetector gesture={pan}>
            <View style={styles.handleZone}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>
          <View style={{ paddingBottom: insets.bottom + 8, flexShrink: 1 }}>{children}</View>
          {/* Relleno bajo el panel: si se arrastra hacia arriba no se ve el fondo. */}
          <View style={styles.underfill} />
        </Animated.View>
      </View>
    </SheetContext.Provider>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    backdrop: { backgroundColor: 'rgba(11, 15, 23, 0.38)' },
    panel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderCurve: 'continuous',
    },
    handleZone: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
    handle: { width: 38, height: 5, borderRadius: 3, backgroundColor: c.border },
    underfill: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '100%',
      height: 60,
      backgroundColor: c.surface,
    },
  }),
);
