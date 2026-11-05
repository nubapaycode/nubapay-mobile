import { requireOptionalNativeModule } from 'expo';
import type { ComponentType, ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatMoney } from '@/features/dashboard/format';
import { makeStyles, useTheme } from '@/theme';

import { LivePill } from './live-pill';

/** Desde qué scroll empieza a aparecer y en cuántos px termina (el hero ya se fue de pantalla). */
const START = 150;
const RANGE = 70;

type BlurProps = { intensity: number; tint: 'light' | 'dark'; style: object };

// expo-blur tiene código nativo: solo se carga si el build lo trae. En Android el blur pide envolver
// el contenido en un BlurTargetView, así que ahí (y sin el módulo) queda el fondo translúcido.
const BlurView: ComponentType<BlurProps> | null =
  Platform.OS === 'ios' && requireOptionalNativeModule('ExpoBlur') != null
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('expo-blur').BlurView
    : null;

/** Card de vidrio: blur del contenido de atrás más un velo del color de superficie. */
function GlassCard({ style, children }: { style: object; children: ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.card, style]}>
      {BlurView ? (
        <BlurView
          intensity={40}
          tint={colors.scheme === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {/* Sin blur, el velo casi opaco para que el texto se siga leyendo sobre el contenido. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: BlurView ? colors.surfaceGlass : colors.backgroundTranslucent },
        ]}
      />
      {children}
    </View>
  );
}

type Props = {
  scrollY: SharedValue<number>;
  eventName: string | null;
  revenue: number | null;
  /** Período del filtro, debajo del evento (ej. "Hoy"). */
  periodLabel: string | null;
  orderCount: number | null;
  live: boolean;
};

/**
 * Barra fija arriba del inicio: cuando el hero sale de pantalla entran dos cards flotantes,
 * el evento y la recaudación.
 */
export function CompactBar({ scrollY, eventName, revenue, periodLabel, orderCount, live }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const body = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [START, START + RANGE], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * -10 }] };
  });

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {/* Debajo de la barra de estado, las dos cards flotan sobre el contenido. */}
      <View style={{ height: insets.top }} />
      <Animated.View style={[styles.body, body]} accessibilityElementsHidden>
        {eventName ? (
          <GlassCard style={styles.left}>
            {live ? <LivePill compact /> : null}
            <View style={styles.leftText}>
              <Text style={styles.name} numberOfLines={1}>
                {eventName}
              </Text>
              {periodLabel ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {periodLabel}
                </Text>
              ) : null}
            </View>
          </GlassCard>
        ) : (
          <View />
        )}
        {revenue != null ? (
          <GlassCard style={styles.right}>
            <Text style={styles.amount}>{formatMoney(revenue)}</Text>
            {orderCount != null ? (
              <Text style={styles.meta}>
                {orderCount} {orderCount === 1 ? 'pedido' : 'pedidos'}
              </Text>
            ) : null}
          </GlassCard>
        ) : null}
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { position: 'absolute', top: 0, left: 0, right: 0 },
    body: {
      paddingTop: Spacing.one,
      paddingHorizontal: Spacing.three,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.two,
    },
    card: {
      minHeight: 56,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      justifyContent: 'center',
      borderRadius: Radius.md,
      borderCurve: 'continuous',
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadow,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
    leftText: { flexShrink: 1, gap: 2 },
    right: { alignItems: 'flex-end', gap: 2 },
    meta: { color: c.textSecondary, fontSize: 12, fontWeight: '500' },
    name: { color: c.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
    amount: {
      color: c.text,
      fontSize: 18,
      fontFamily: DisplayFont.bold,
      fontVariant: ['tabular-nums'],
    },
  }),
);
