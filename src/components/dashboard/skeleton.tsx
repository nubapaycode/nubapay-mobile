import { type ComponentRef, createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const highlight = colors.scheme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)';

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
                <Stop offset="0" stopColor={highlight} stopOpacity={0} />
                <Stop offset="0.5" stopColor={highlight} stopOpacity={1} />
                <Stop offset="1" stopColor={highlight} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={BAND} height="100%" fill="url(#shine)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Esqueleto con la forma real del home (no un spinner), con un brillo que lo recorre. */
export function DashboardSkeleton() {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    sweep.set(withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false));
  }, [sweep, reduceMotion]);

  return (
    <Sweep.Provider value={reduceMotion ? null : sweep}>
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
    </Sweep.Provider>
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
