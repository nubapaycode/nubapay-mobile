import * as Haptics from 'expo-haptics';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { BlurView } from '@/components/fx/blur';
import { CountBadge } from '@/components/motion/count-badge';
import { DisplayFont } from '@/constants/theme';
import { formatMoney, initials } from '@/features/dashboard/format';
import { makeStyles, useTheme } from '@/theme';

import { Icon } from './icon';
import { RollingNumber } from './rolling-number';

/** Desde qué scroll empieza a aparecer y en cuántos px termina (el hero ya se fue de pantalla). */
const START = 150;
const RANGE = 70;
const BAR_H = 58;
const ROUND = 44;
const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };

type Props = {
  scrollY: SharedValue<number>;
  eventName: string | null;
  revenue: number | null;
  /** Período del filtro, al lado del evento (ej. "Hoy"). */
  periodLabel: string | null;
  orderCount: number | null;
  userName: string | null;
  filterCount: number;
  showFilters: boolean;
  onOpenEvents: () => void;
  onOpenProfile: () => void;
  onOpenFilters: () => void;
};

/**
 * Pieza de vidrio suelta: blur del contenido de atrás, velo de superficie, borde fino y una sombra
 * muy suave. La sombra va en la vista de afuera y el blur se recorta en una de adentro: si las dos
 * cosas estuvieran en la misma vista, `overflow: hidden` se comería la sombra.
 */
function Island({ style, children }: { style: ViewStyle; children: ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const radius = { borderRadius: style.borderRadius };
  return (
    <View
      style={[
        style,
        {
          boxShadow:
            colors.scheme === 'dark'
              ? '0 2px 10px rgba(0, 0, 0, 0.32)'
              : '0 2px 10px rgba(11, 15, 23, 0.07), 0 1px 2px rgba(11, 15, 23, 0.04)',
        },
      ]}>
      <View style={[StyleSheet.absoluteFill, styles.glass, radius]}>
        {BlurView ? (
          <BlurView
            intensity={50}
            tint={colors.scheme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: BlurView ? colors.surfaceGlass : colors.backgroundTranslucent },
          ]}
        />
      </View>
      {children}
    </View>
  );
}

/** Cuánto baja el fondo por debajo de las islas antes de esfumarse. */
const FADE = 26;
/** Capas de blur (alto relativo e intensidad): más fuerte arriba, cada vez más suave hacia abajo. */
const BLUR_LAYERS = [
  { h: 1, intensity: 8 },
  { h: 0.72, intensity: 10 },
  { h: 0.5, intensity: 14 },
];

/**
 * Fondo detrás de las islas: blur progresivo (capas apiladas, más intensas arriba) y un velo del
 * color de fondo que se esfuma hacia abajo, sin borde duro. Hace que las islas se despeguen del
 * contenido que pasa por detrás. Sin blur (Android), solo el velo.
 */
function Backdrop({ height }: { height: number }) {
  const { colors } = useTheme();
  const Blur = BlurView;
  return (
    <View pointerEvents="none" style={[bgStyles.backdrop, { height }]}>
      {Blur
        ? BLUR_LAYERS.map((l) => (
            <Blur
              key={l.h}
              intensity={l.intensity}
              tint={colors.scheme === 'dark' ? 'dark' : 'light'}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * l.h }}
            />
          ))
        : null}
      <Svg width="100%" height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="barVeil" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={BlurView ? 0.7 : 0.92} />
            <Stop offset="0.6" stopColor={colors.background} stopOpacity={BlurView ? 0.35 : 0.6} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill="url(#barVeil)" />
      </Svg>
    </View>
  );
}

/**
 * Barra del inicio al scrollear, como islas flotantes (patrón Perplexity / Monzo): sin fondo de
 * barra, tres piezas de vidrio sueltas sobre el contenido. Perfil a la izquierda, filtros a la
 * derecha y, al centro, una cápsula con la recaudación (rueda si entra una venta) y el período;
 * tocarla cambia de evento. Arriba del hero no existe: no se ve ni recibe toques.
 */
export function CompactBar({
  scrollY,
  eventName,
  revenue,
  periodLabel,
  orderCount,
  userName,
  filterCount,
  showFilters,
  onOpenEvents,
  onOpenProfile,
  onOpenFilters,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(false);

  // Las islas bajan y aparecen; la del centro un poco después que las de los costados.
  const center = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [START + 15, START + RANGE + 10], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * -12 }, { scale: 0.94 + p * 0.06 }] };
  });
  const backdrop = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [START - 10, START + RANGE], [0, 1], Extrapolation.CLAMP),
  }));
  const sides = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [START, START + RANGE], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * -12 }, { scale: 0.85 + p * 0.15 }] };
  });

  useAnimatedReaction(
    () => scrollY.value > START + RANGE / 2,
    (now, prev) => {
      if (now !== prev) scheduleOnRN(setActive, now);
    },
  );

  const centerScale = useSharedValue(1);
  const centerPress = useAnimatedStyle(() => ({ transform: [{ scale: centerScale.value }] }));

  return (
    <View
      pointerEvents={active ? 'box-none' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={styles.wrap}>
      <Animated.View style={[StyleSheet.absoluteFill, backdrop]} pointerEvents="none">
        <Backdrop height={insets.top + 4 + BAR_H + FADE} />
      </Animated.View>
      <View style={[styles.row, { marginTop: insets.top + 4, height: BAR_H }]}>
        <Animated.View style={sides}>
          <Island style={styles.round}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenProfile();
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Perfil: cuenta, apariencia y cerrar sesión"
              style={({ pressed }) => [styles.fill, pressed && styles.pressed]}>
              <Text style={styles.avatarText}>{userName ? initials(userName) : '·'}</Text>
            </Pressable>
          </Island>
        </Animated.View>

        <Animated.View style={[styles.centerSlot, center, centerPress]}>
          <Island style={styles.capsule}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenEvents();
              }}
              onPressIn={() => centerScale.set(withTiming(0.96, PRESS))}
              onPressOut={() => centerScale.set(withTiming(1, PRESS))}
              accessibilityRole="button"
              accessibilityLabel={`${eventName ?? 'Evento'}${periodLabel ? `, ${periodLabel}` : ''}${
                revenue != null ? `: ${formatMoney(revenue)} recaudado` : ''
              }${orderCount != null ? `, ${orderCount} pedidos` : ''}. Cambiar evento`}
              style={[styles.fill, styles.capsuleRow]}>
              {revenue != null ? (
                <RollingNumber value={revenue} format={formatMoney} style={styles.value} />
              ) : (
                <Text style={styles.value} numberOfLines={1}>
                  {eventName ?? 'Inicio'}
                </Text>
              )}
              {periodLabel ? (
                <Text style={styles.period} numberOfLines={1}>
                  · {periodLabel}
                </Text>
              ) : null}
              <Icon name="chevronDown" size={10} color={colors.textMuted} />
            </Pressable>
          </Island>
        </Animated.View>

        <Animated.View style={sides}>
          {showFilters ? (
            <View>
              <Island style={styles.round}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    onOpenFilters();
                  }}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtros${filterCount ? `, ${filterCount} activos` : ''}`}
                  style={({ pressed }) => [styles.fill, pressed && styles.pressed]}>
                  <Icon name="filter" size={18} color={colors.text} />
                </Pressable>
              </Island>
              {filterCount > 0 ? (
                <CountBadge count={filterCount} style={styles.badge} textStyle={styles.badgeText} />
              ) : null}
            </View>
          ) : (
            <View style={styles.spacer} />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const bgStyles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { position: 'absolute', top: 0, left: 0, right: 0 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
    glass: {
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    round: { width: ROUND, height: ROUND, borderRadius: ROUND / 2 },
    spacer: { width: ROUND, height: ROUND },
    fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: 0.6 },
    avatarText: { color: c.text, fontSize: 15, fontWeight: '700' },
    centerSlot: { flex: 1, alignItems: 'center' },
    capsule: { height: ROUND + 4, borderRadius: (ROUND + 4) / 2, maxWidth: '100%' },
    capsuleRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 20 },
    value: {
      color: c.text,
      fontSize: 19,
      lineHeight: 23,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.3,
    },
    period: { flexShrink: 1, color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    badge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 17,
      height: 17,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    badgeText: { color: c.onPrimary, fontSize: 10, fontWeight: '700' },
  }),
);
