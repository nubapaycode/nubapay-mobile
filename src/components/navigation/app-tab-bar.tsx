import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/dashboard/icon';
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
  const routes = state.routes.filter((r) => TABS[r.name]);
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
      />
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {routes.slice(0, half).map(renderTab)}
      <ScanButton onPress={onScan} />
      {routes.slice(half).map(renderTab)}
    </View>
  );
}

/**
 * Pestaña: al activarse el ícono hace un "pop" corto (se achica y vuelve) y el indicador crece
 * de punto a guion; al desactivarse vuelve a punto y se desvanece.
 */
function TabItem({
  focused,
  icon,
  activeIcon,
  label,
  onPress,
}: {
  focused: boolean;
  icon: IconName;
  activeIcon: IconName;
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(focused ? 1 : 0);
  const pop = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    on.set(reduceMotion ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, SWITCH));
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
  }, [focused, on, pop, reduceMotion]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: on.value,
    width: 4 + on.value * 12,
  }));

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
      </Animated.View>
      <Animated.View style={[styles.indicator, indicatorStyle]} />
    </Pressable>
  );
}

const SWITCH = { duration: 240, easing: Easing.out(Easing.cubic) };

/** Botón central elevado: círculo azul de marca con el ícono de QR. */
function ScanButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={styles.scanSlot}>
      <Animated.View style={[styles.scanRing, press]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onPress();
          }}
          onPressIn={() => scale.set(withTiming(0.92, PRESS))}
          onPressOut={() => scale.set(withTiming(1, PRESS))}
          accessibilityRole="button"
          accessibilityLabel="Escanear QR"
          style={styles.scan}>
          <Icon name="qr" size={26} color={colors.onPrimary} />
        </Pressable>
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
    indicator: { height: 4, borderRadius: 2, backgroundColor: c.ink },

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
