import { type ComponentRef, createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { type DimensionValue, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

/** Ancho del brillo que recorre la pantalla. */
const BAND = 160;

/** Progreso compartido del brillo: todos los bloques lo leen, así parece una sola pasada. */
const Sweep = createContext<SharedValue<number> | null>(null);

function Block({
  w,
  h,
  r = 8,
  tone,
}: {
  w: DimensionValue;
  h: number;
  r?: number;
  tone?: string;
}) {
  const { colors } = useTheme();
  const sweep = useContext(Sweep);
  const { width: screen } = useWindowDimensions();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [left, setLeft] = useState(0);
  // La intensidad va en stopOpacity: react-native-svg no siempre respeta el alfa de un rgba en stopColor
  // (en oscuro pintaba una franja blanca opaca).
  const peak = colors.scheme === 'dark' ? 0.06 : 0.75;

  const band = useAnimatedStyle(() => ({
    transform: [{ translateX: (sweep?.value ?? -1) * (screen + BAND) - BAND - left }],
  }));

  return (
    <View
      ref={ref}
      onLayout={() => ref.current?.measureInWindow((x) => setLeft(x))}
      style={{
        width: w,
        height: h,
        borderRadius: r,
        overflow: 'hidden',
        backgroundColor: tone ?? colors.raised,
      }}>
      {sweep ? (
        <Animated.View style={[styles.band, band]}>
          <Svg width={BAND} height="100%">
            <Defs>
              <LinearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity={peak} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={BAND} height="100%" fill="url(#shine)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Brillo compartido: todos los bloques de adentro lo recorren juntos, como una sola pasada. */
function SweepScope({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    sweep.set(withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false));
  }, [sweep, reduceMotion]);
  return <Sweep.Provider value={reduceMotion ? null : sweep}>{children}</Sweep.Provider>;
}

/**
 * Esqueleto de una lista de cards (pedidos, equipo, eventos) con la forma de cada una: título de
 * grupo y cards separadas, cada una con avatar, dos líneas y el dato a la derecha.
 */
export function CardListSkeleton({
  variant,
  count = 5,
  label = 'Cargando',
}: {
  variant: 'operation' | 'member' | 'event';
  count?: number;
  label?: string;
}) {
  const styles = useStyles();
  return (
    <SweepScope>
      <View style={styles.list} accessibilityLabel={label} accessibilityRole="progressbar">
        <View style={styles.groupHead}>
          <Block w={90} h={16} r={6} />
          {variant === 'operation' ? <Block w={70} h={12} /> : null}
        </View>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={[styles.card, { opacity: 1 - i * 0.12 }]}>
            {variant === 'event' ? (
              <View style={styles.cardRow}>
                <View style={{ flex: 1, gap: 10 }}>
                  <Block w="60%" h={16} r={6} />
                  <View style={styles.cardRow}>
                    <Block w={56} h={20} r={7} />
                    <Block w={110} h={12} />
                  </View>
                </View>
                <Block w={22} h={22} r={11} />
              </View>
            ) : (
              <>
                <View style={styles.cardRow}>
                  <Block w={42} h={42} r={21} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Block w={i % 2 ? '50%' : '64%'} h={14} r={6} />
                    <Block w={i % 2 ? '72%' : '58%'} h={11} />
                  </View>
                  {variant === 'operation' ? (
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <Block w={64} h={15} r={6} />
                      <Block w={34} h={11} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardRow}>
                  <Block w={variant === 'operation' ? 76 : 64} h={22} r={11} />
                  <Block w={variant === 'operation' ? 58 : 72} h={22} r={11} />
                </View>
              </>
            )}
          </View>
        ))}
      </View>
    </SweepScope>
  );
}

/** Esqueleto con la forma real del home (no un spinner), con un brillo que lo recorre. */
export function DashboardSkeleton() {
  const styles = useStyles();

  return (
    <SweepScope>
      <View style={styles.wrap} accessibilityLabel="Cargando métricas">
        <View style={styles.hero}>
          <Block w={150} h={12} />
          <Block w={240} h={44} r={10} />
          <Block w={170} h={22} r={11} />
          <Block w="100%" h={150} r={14} />
        </View>
        <View style={styles.row}>
          <View style={styles.tile}>
            <Block w={90} h={14} />
            <Block w={76} h={76} r={38} />
          </View>
          <View style={styles.tile}>
            <Block w={70} h={14} />
            <Block w="70%" h={28} r={8} />
            <Block w="100%" h={6} r={3} />
          </View>
        </View>
        <View style={styles.tile}>
          <Block w={80} h={14} />
          <Block w="100%" h={10} r={5} />
          <Block w="60%" h={12} />
        </View>
      </View>
    </SweepScope>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: 0, bottom: 0, left: 0, width: BAND },
});

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    // Transparente y centrado, como el hero: el degradé del inicio se ve detrás.
    hero: {
      gap: 12,
      alignItems: 'center',
      marginBottom: Spacing.three,
      paddingVertical: Spacing.three,
    },
    row: { flexDirection: 'row', gap: 12 },
    list: { gap: 8 },
    groupHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 2,
    },
    card: {
      gap: 12,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tile: {
      flex: 1,
      gap: 14,
      padding: Spacing.three,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadow,
    },
  }),
);
