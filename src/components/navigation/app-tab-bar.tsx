import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { type ReactNode, useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/dashboard/icon';
import { SetupDot } from '@/components/dashboard/setup-checklist';
import { useCanSetup } from '@/features/setup/event-setup';
import { makeStyles, useTheme } from '@/theme';

/** Ícono (normal / activo) y nombre accesible de cada pestaña, por nombre de ruta. */
const TABS: Record<string, { icon: IconName; active: IconName; label: string }> = {
  index: { icon: 'home', active: 'homeFill', label: 'Inicio' },
  operations: { icon: 'operations', active: 'operations', label: 'Operaciones' },
  team: { icon: 'team', active: 'teamFill', label: 'Equipo' },
  more: { icon: 'more', active: 'moreFill', label: 'Más' },
};

const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };

/**
 * Barra inferior solo con íconos: Inicio · Operaciones · [Escanear QR] · Equipo · Más.
 * El botón del medio (como en Mercado Pago o MODO) no es una pestaña: abre el escáner a pantalla
 * completa con `onScan`.
 */
export function AppTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
  onScan,
}: BottomTabBarProps & { onScan: () => void }) {
  const styles = useStyles();
  const width = useSharedValue(0);
  const routes = state.routes.filter((r) => TABS[r.name]);
  // Punto azul en Más mientras el evento tenga el checklist pendiente (ni completo ni salteado).
  const canSetup = useCanSetup();
  const half = Math.ceil(routes.length / 2);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const meta = TABS[route.name];
    const focused = state.routes[state.index]?.key === route.key;
    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        Haptics.selectionAsync();
        navigateToTab(route.key);
      }
    };
    return (
      <TabItem
        key={route.key}
        focused={focused}
        icon={meta.icon}
        activeIcon={meta.active}
        label={descriptors[route.key]?.options.tabBarAccessibilityLabel ?? meta.label}
        onPress={onPress}
        badge={route.name === 'more' && canSetup ? <SetupDot style={styles.dot} /> : null}
      />
    );
  };

  // Lugar de la pestaña activa entre los cinco (el del medio es el escáner).
  const focusedAt = routes.findIndex((r) => state.routes[state.index]?.key === r.key);
  const slot = focusedAt < 0 ? -1 : focusedAt < half ? focusedAt : focusedAt + 1;

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}
      onLayout={(e) => width.set(e.nativeEvent.layout.width)}>
      {routes.slice(0, half).map(renderTab)}
      <ScanButton onPress={onScan} />
      {routes.slice(half).map(renderTab)}
      <TabIndicator slot={slot} slots={routes.length + 1} width={width} />
    </View>
  );
}

const INDICATOR_W = 16;
const SLIDE = { duration: 300, easing: Easing.inOut(Easing.cubic) };

/**
 * Indicador único que se desliza de una pestaña a otra; en el trayecto se estira (como una gota)
 * y al llegar vuelve a su largo. Sin pestaña activa se desvanece.
 */
function TabIndicator({ slot, slots, width }: { slot: number; slots: number; width: SharedValue<number> }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const pos = useSharedValue(Math.max(0, slot));
  const stretch = useSharedValue(0);
  const visible = useSharedValue(slot >= 0 ? 1 : 0);
  const first = useRef(true);

  useEffect(() => {
    visible.set(withTiming(slot >= 0 ? 1 : 0, { duration: 180 }));
    if (slot < 0) return;
    if (first.current || reduceMotion) {
      first.current = false;
      pos.set(slot);
      return;
    }
    const jump = Math.abs(slot - pos.get());
    pos.set(withTiming(slot, SLIDE));
    stretch.set(
      withSequence(
        withTiming(Math.min(1, 0.5 + jump * 0.25), { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }),
      ),
    );
  }, [slot, reduceMotion, pos, stretch, visible]);

  const style = useAnimatedStyle(() => {
    const slotW = width.value / slots;
    return {
      opacity: width.value > 0 ? visible.value : 0,
      transform: [
        { translateX: pos.value * slotW + slotW / 2 - INDICATOR_W / 2 },
        { scaleX: 1 + stretch.value * 1.4 },
      ],
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.indicator, style]} />;
}

/** Pestaña: al activarse el ícono hace un "pop" corto (se achica y vuelve). */
function TabItem({
  focused,
  icon,
  activeIcon,
  label,
  onPress,
  badge,
}: {
  focused: boolean;
  icon: IconName;
  activeIcon: IconName;
  label: string;
  onPress: () => void;
  /** Marca arriba a la derecha del ícono (p. ej. el punto de pasos pendientes). */
  badge?: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    if (focused && mounted.current && !reduceMotion) {
      pop.set(
        withSequence(
          withTiming(0.82, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(1.08, { duration: 150, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 140, easing: Easing.inOut(Easing.quad) }),
        ),
      );
    }
    mounted.current = true;
  }, [focused, pop, reduceMotion]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tab}>
      <Animated.View style={iconStyle}>
        <Icon
          name={focused ? activeIcon : icon}
          size={23}
          color={focused ? colors.ink : colors.textMuted}
        />
        {badge}
      </Animated.View>
    </Pressable>
  );
}


/**
 * En iOS 18+ el escáner se abre con el zoom nativo: el círculo crece hasta ser la pantalla (y al
 * cerrar vuelve a él). En otras versiones el Link navega igual, sin la animación.
 */
const ZOOM = Platform.OS === 'ios';

/** Botón central elevado: círculo azul de marca con el ícono de QR. */
function ScanButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const button = (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Con zoom navega el Link; acá solo el toque.
        if (!ZOOM) onPress();
      }}
      onPressIn={() => scale.set(withTiming(0.92, PRESS))}
      onPressOut={() => scale.set(withTiming(1, PRESS))}
      accessibilityRole="button"
      accessibilityLabel="Escanear QR"
      style={styles.scan}>
      <Icon name="qr" size={26} color={colors.onPrimary} />
    </Pressable>
  );
  return (
    <View style={styles.scanSlot}>
      <Animated.View style={[styles.scanRing, press]}>
        {ZOOM ? (
          <Link href="/scan" asChild>
            <Link.AppleZoom>{button}</Link.AppleZoom>
          </Link>
        ) : (
          button
        )}
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingTop: 10,
      backgroundColor: c.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    tab: { flex: 1, alignItems: 'center', gap: 6, paddingTop: 6, height: 44 },
    dot: { position: 'absolute', top: -2, right: -4 },
    // Debajo del ícono: padding de la barra (10) + de la pestaña (6) + ícono (23) + separación (6).
    indicator: {
      position: 'absolute',
      left: 0,
      top: 45,
      width: INDICATOR_W,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.ink,
    },

    scanSlot: { flex: 1, alignItems: 'center' },
    scanRing: {
      marginTop: -28,
      padding: 5,
      borderRadius: 40,
      backgroundColor: c.background,
    },
    scan: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      shadowColor: c.primary,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
  }),
);
