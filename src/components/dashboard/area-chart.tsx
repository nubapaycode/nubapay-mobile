import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { formatMoneyCompact } from '@/features/dashboard/format';
import { makeStyles, useTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type ChartPoint = { label: string; value: number; prev?: number };

type Props = {
  points: ChartPoint[];
  height?: number;
  color?: string;
  /** Índice bajo el dedo (null al soltar). */
  onScrub?: (index: number | null) => void;
  emptyLabel?: string;
  /** Evento en vivo: punto que late en la punta de la curva y "ping" cuando entra una venta. */
  live?: boolean;
  /** Dibuja la línea punteada del período anterior (si los puntos la traen). */
  showPrev?: boolean;
};

const CURSOR = { duration: 110, easing: Easing.out(Easing.quad) };
const MORPH = { duration: 650, easing: Easing.inOut(Easing.cubic) };
const PAD_TOP = 14;
const PAD_BOTTOM = 22; // espacio para etiquetas del eje X
/** Muestras fijas de la curva: permiten transformar una serie en otra aunque cambie la cantidad de puntos. */
const SAMPLES = 48;

/** Pendientes monótonas (Fritsch–Carlson): suave sin pasarse por debajo de cero. */
function tangents(xs: number[], ys: number[]): number[] {
  'worklet';
  const n = xs.length;
  if (n < 2) return xs.map(() => 0);
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    slope.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    m.push(slope[i] * slope[i - 1] <= 0 ? 0 : (slope[i] + slope[i - 1]) / 2);
  }
  m.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  return m;
}

/** Curva suave que pasa por todos los puntos. */
function monotonePath(xs: number[], ys: number[]): string {
  'worklet';
  const n = xs.length;
  if (n === 0) return '';
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  const m = tangents(xs, ys);
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (xs[i + 1] - xs[i]) / 3;
    d += ` C${xs[i] + h},${ys[i] + m[i] * h} ${xs[i + 1] - h},${ys[i + 1] - m[i + 1] * h} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

/** Evalúa la curva monótona en SAMPLES posiciones equiespaciadas de 0 a width. */
function sampleCurve(xs: number[], ys: number[], width: number, fallback: number): number[] {
  const n = xs.length;
  if (n === 0) return Array.from({ length: SAMPLES }, () => fallback);
  if (n === 1) return Array.from({ length: SAMPLES }, () => ys[0]);
  const m = tangents(xs, ys);
  const out: number[] = [];
  let i = 0;
  for (let k = 0; k < SAMPLES; k++) {
    const x = (k / (SAMPLES - 1)) * width;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const dx = xs[i + 1] - xs[i];
    const t = Math.min(1, Math.max(0, (x - xs[i]) / dx));
    const t2 = t * t;
    const t3 = t2 * t;
    out.push(
      (2 * t3 - 3 * t2 + 1) * ys[i] +
        (t3 - 2 * t2 + t) * dx * m[i] +
        (-2 * t3 + 3 * t2) * ys[i + 1] +
        (t3 - t2) * dx * m[i + 1],
    );
  }
  return out;
}

export function AreaChart({
  points,
  height = 180,
  color,
  onScrub,
  emptyLabel = 'Sin ventas en este período',
  live = false,
  showPrev = true,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const stroke = color ?? colors.chart.series[0];
  const [width, setWidth] = useState(0);
  const reduceMotion = useReducedMotion();
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const base = PAD_TOP + plotH;
  const values = points.map((p) => p.value);
  const prevs = points.map((p) => p.prev ?? 0);
  const hasPrev = showPrev && points.some((p) => p.prev != null);
  const max = Math.max(1, ...values, ...(hasPrev ? prevs : [])) * 1.12;
  const isEmpty = values.every((v) => v === 0);

  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const xs = points.map((_, i) => i * step);
  const ys = values.map((v) => PAD_TOP + plotH - (v / max) * plotH);
  const prevYs = prevs.map((v) => PAD_TOP + plotH - (v / max) * plotH);

  // Morphing: la curva se guarda muestreada; al cambiar los datos se interpola de la forma
  // anterior a la nueva en el hilo de UI (no se desmonta ni se vuelve a dibujar desde cero).
  const fromY = useSharedValue<number[]>([]);
  const toY = useSharedValue<number[]>([]);
  const fromPrev = useSharedValue<number[]>([]);
  const toPrev = useSharedValue<number[]>([]);
  const morph = useSharedValue(1);
  const sampleKey = width ? `${width}|${ys.join(',')}|${hasPrev ? prevYs.join(',') : ''}` : '';

  useEffect(() => {
    if (!width) return;
    const nextY = sampleCurve(xs, ys, width, base);
    const nextPrev = hasPrev ? sampleCurve(xs, prevYs, width, base) : nextY.map(() => base);
    const p = morph.get();
    const blend = (a: number[], b: number[]) =>
      a.length === SAMPLES ? b.map((v, i) => a[i] + (v - a[i]) * p) : b;
    const firstRun = toY.get().length !== SAMPLES;
    fromY.set(firstRun ? nextY : blend(fromY.get(), toY.get()));
    fromPrev.set(firstRun ? nextPrev : blend(fromPrev.get(), toPrev.get()));
    toY.set(nextY);
    toPrev.set(nextPrev);
    if (firstRun || reduceMotion) {
      morph.set(1);
    } else {
      morph.set(0);
      morph.set(withTiming(1, MORPH));
    }
    // sampleKey resume xs/ys/prevYs: recalcula solo cuando cambia la forma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleKey, reduceMotion]);

  const sampleXs = width
    ? Array.from({ length: SAMPLES }, (_, k) => (k / (SAMPLES - 1)) * width)
    : [];

  const lerp = (a: number[], b: number[], t: number) => {
    'worklet';
    const out: number[] = [];
    for (let i = 0; i < b.length; i++) out.push(a[i] + (b[i] - a[i]) * t);
    return out;
  };

  const lineProps = useAnimatedProps(() => {
    if (toY.value.length !== SAMPLES) return { d: '' };
    return { d: monotonePath(sampleXs, lerp(fromY.value, toY.value, morph.value)) };
  });
  const areaProps = useAnimatedProps(() => {
    if (toY.value.length !== SAMPLES || !sampleXs.length) return { d: '' };
    const line = monotonePath(sampleXs, lerp(fromY.value, toY.value, morph.value));
    return { d: `${line} L${sampleXs[SAMPLES - 1]},${base} L0,${base} Z` };
  });
  const prevProps = useAnimatedProps(() => {
    if (toPrev.value.length !== SAMPLES) return { d: '' };
    return { d: monotonePath(sampleXs, lerp(fromPrev.value, toPrev.value, morph.value)) };
  });

  // Entrada: la curva se revela de izquierda a derecha (máscara que se corre, solo transforms).
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!width) return;
    draw.set(reduceMotion ? 1 : withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [width, draw, reduceMotion]);
  const revealOuter = useAnimatedStyle(() => ({
    transform: [{ translateX: -(1 - draw.value) * width }],
  }));
  const revealInner = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - draw.value) * width }],
  }));
  // Sin ventas la curva baja a la base (morphing) y recién ahí se desvanece; al volver a haber
  // ventas reaparece enseguida y sube desde la base.
  const visible = useSharedValue(isEmpty ? 0 : 1);
  useEffect(() => {
    if (reduceMotion) {
      visible.set(isEmpty ? 0 : 1);
      return;
    }
    visible.set(
      isEmpty
        ? withDelay(MORPH.duration - 150, withTiming(0, { duration: 220 }))
        : withTiming(1, { duration: 160 }),
    );
  }, [isEmpty, reduceMotion, visible]);
  const areaStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, draw.value * 1.4 - 0.4) * visible.value,
  }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: visible.value }));

  // Scrubbing: el cursor salta al punto más cercano; haptic en cada cambio de punto.
  const activeIndex = useSharedValue(-1);
  const cursorX = useSharedValue(0);
  const cursorY = useSharedValue(0);
  const cursorOpacity = useSharedValue(0);

  const notify = (i: number | null) => {
    if (i != null) Haptics.selectionAsync();
    onScrub?.(i);
  };

  const pickIndex = (x: number) => {
    'worklet';
    if (step === 0) return 0;
    return Math.max(0, Math.min(xs.length - 1, Math.round(x / step)));
  };

  const moveTo = (x: number) => {
    'worklet';
    const i = pickIndex(x);
    if (i === activeIndex.value) return;
    activeIndex.value = i;
    cursorX.value = withTiming(xs[i], CURSOR);
    cursorY.value = withTiming(ys[i], CURSOR);
    scheduleOnRN(notify, i);
  };

  const pan = usePanGesture({
    enabled: !isEmpty && width > 0,
    activeOffsetX: [-6, 6],
    failOffsetY: [-14, 14],
    onActivate: (e) => {
      'worklet';
      activeIndex.value = -1;
      cursorOpacity.value = withTiming(1, { duration: 120 });
      const i = pickIndex(e.x);
      cursorX.value = xs[i];
      cursorY.value = ys[i];
      moveTo(e.x);
    },
    onUpdate: (e) => {
      'worklet';
      moveTo(e.x);
    },
    onFinalize: () => {
      'worklet';
      if (activeIndex.value === -1) return;
      activeIndex.value = -1;
      cursorOpacity.value = withTiming(0, { duration: 180 });
      scheduleOnRN(notify, null);
    },
  });

  const cursorLine = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
    transform: [{ translateX: cursorX.value - 0.5 }],
  }));
  const cursorDot = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
    transform: [{ translateX: cursorX.value - 6 }, { translateY: cursorY.value - 6 }],
  }));

  // Punta en vivo: sigue al último punto (también durante el morphing) y se oculta al scrubear.
  const tipStyle = useAnimatedStyle(() => {
    const y =
      toY.value.length === SAMPLES
        ? fromY.value[SAMPLES - 1] + (toY.value[SAMPLES - 1] - fromY.value[SAMPLES - 1]) * morph.value
        : base;
    return {
      opacity: draw.value * (1 - cursorOpacity.value),
      transform: [{ translateX: width - TIP / 2 }, { translateY: y - TIP / 2 }],
    };
  });

  const labelIdx =
    points.length > 2
      ? [0, Math.floor((points.length - 1) / 2), points.length - 1]
      : points.map((_, i) => i);
  // Solo la línea media (muy tenue) y la base: la curva es lo único que se lee de un vistazo.
  const gridYs = [0.5, 1].map((r) => PAD_TOP + plotH * r);
  const last = values[values.length - 1] ?? 0;

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={onLayout}
        style={{ height }}
        accessibilityRole="image"
        accessibilityLabel="Gráfico de recaudación. Mantené y deslizá para ver cada punto.">
        {width > 0 && (
          <>
            {/* Grilla recesiva */}
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
              {gridYs.map((y, i) => (
                <Line
                  key={i}
                  x1={0}
                  x2={width}
                  y1={y}
                  y2={y}
                  stroke={colors.chart.grid}
                  strokeWidth={i === 1 ? 1 : 0.75}
                />
              ))}
            </Svg>
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.clip, revealOuter]}>
              <Animated.View style={[StyleSheet.absoluteFill, revealInner]}>
                {hasPrev ? (
                  <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                    <AnimatedPath
                      animatedProps={prevProps}
                      stroke={colors.chart.previous}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fill="none"
                    />
                  </Svg>
                ) : null}
                <Animated.View style={[StyleSheet.absoluteFill, areaStyle]}>
                    <Svg width={width} height={height}>
                      <Defs>
                        <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                          <Stop
                            offset="0"
                            stopColor={stroke}
                            stopOpacity={colors.scheme === 'dark' ? 0.24 : 0.12}
                          />
                          <Stop offset="0.85" stopColor={stroke} stopOpacity={0} />
                        </LinearGradient>
                      </Defs>
                      <AnimatedPath animatedProps={areaProps} fill="url(#fill)" />
                    </Svg>
                  </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, lineStyle]}>
                  <Svg width={width} height={height}>
                    <AnimatedPath
                      animatedProps={lineProps}
                      stroke={stroke}
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                </Animated.View>
              </Animated.View>
            </Animated.View>
            <Text style={[styles.maxLabel, { top: PAD_TOP - 13 }]}>
              {formatMoneyCompact(max / 1.12)}
            </Text>
            {isEmpty && (
              <Animated.Text
                entering={FadeIn.delay(reduceMotion ? 0 : MORPH.duration - 100).duration(260)}
                style={[styles.empty, { top: PAD_TOP + plotH / 2 - 9 }]}>
                {emptyLabel}
              </Animated.Text>
            )}

            {live && !isEmpty ? (
              <Animated.View pointerEvents="none" style={[styles.tip, tipStyle]}>
                <LiveTip value={last} color={stroke} />
              </Animated.View>
            ) : null}

            {/* Cursor */}
            <Animated.View
              pointerEvents="none"
              style={[styles.cursorLine, { top: PAD_TOP - 4, height: plotH + 4 }, cursorLine]}
            />
            <Animated.View pointerEvents="none" style={[styles.cursorDot, cursorDot]} />

            {/* Eje X: primera, media y última etiqueta */}
            {labelIdx.map((i, k) => (
              <Text
                key={i}
                style={[
                  styles.xLabel,
                  { top: height - 16 },
                  k === 0
                    ? { left: 0 }
                    : k === labelIdx.length - 1
                      ? { right: 0 }
                      : { left: xs[i] - 20, width: 40, textAlign: 'center' },
                ]}>
                {points[i]?.label}
              </Text>
            ))}
          </>
        )}
      </View>
    </GestureDetector>
  );
}

const TIP = 28;

/**
 * Punta de la curva en vivo: un punto con halo que respira y, cuando sube el último valor
 * (entró una venta), una onda más grande que se expande.
 */
function LiveTip({ value, color }: { value: number; color: string }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const breathe = useSharedValue(0);
  const ping = useSharedValue(0);
  const prev = useRef(value);

  useEffect(() => {
    if (reduceMotion) return;
    breathe.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
  }, [breathe, reduceMotion]);

  useEffect(() => {
    const grew = value > prev.current;
    prev.current = value;
    if (!grew || reduceMotion) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    ping.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
  }, [value, ping, reduceMotion]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - breathe.value),
    transform: [{ scale: 0.5 + breathe.value * 1.1 }],
  }));
  const wave = useAnimatedStyle(() => ({
    opacity: ping.value > 0 && ping.value < 1 ? 0.7 * (1 - ping.value) : 0,
    transform: [{ scale: 0.4 + ping.value * 2.4 }],
  }));

  return (
    <View style={styles.tipInner}>
      <Animated.View style={[styles.tipRing, { borderColor: color }, wave]} />
      <Animated.View style={[styles.tipHalo, { backgroundColor: color }, halo]} />
      <View style={[styles.tipDot, { backgroundColor: color }]} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    clip: { overflow: 'hidden' },
    cursorLine: { position: 'absolute', left: 0, width: 1, backgroundColor: c.chart.previous },
    cursorDot: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.chart.highlight,
      borderWidth: 2.5,
      borderColor: c.chart.highlightRing,
    },
    tip: { position: 'absolute', left: 0, top: 0, width: TIP, height: TIP },
    tipInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    tipRing: {
      position: 'absolute',
      width: TIP,
      height: TIP,
      borderRadius: TIP / 2,
      borderWidth: 2,
    },
    tipHalo: { position: 'absolute', width: TIP, height: TIP, borderRadius: TIP / 2 },
    tipDot: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
      borderWidth: 2,
      borderColor: c.chart.highlightRing,
    },
    xLabel: {
      position: 'absolute',
      color: c.textMuted,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },
    maxLabel: {
      position: 'absolute',
      right: 0,
      color: c.textMuted,
      fontSize: 10,
      fontVariant: ['tabular-nums'],
    },
    empty: {
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 13,
    },
  }),
);
