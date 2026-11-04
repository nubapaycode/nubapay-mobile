import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
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
};

const CURSOR = { duration: 110, easing: Easing.out(Easing.quad) };
const PAD_TOP = 14;
const PAD_BOTTOM = 22; // espacio para etiquetas del eje X

/** Curva monótona (Fritsch–Carlson): suave sin pasarse por debajo de cero. */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return '';
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  const dx = xs.slice(1).map((x, i) => x - xs[i]);
  const slope = ys.slice(1).map((y, i) => (y - ys[i]) / dx[i]);
  const m = [
    slope[0],
    ...slope.slice(1).map((s, i) => (s * slope[i] <= 0 ? 0 : (s + slope[i]) / 2)),
    slope[n - 2],
  ];
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
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${xs[i] + h},${ys[i] + m[i] * h} ${xs[i + 1] - h},${ys[i + 1] - m[i + 1] * h} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

function polylineLength(xs: number[], ys: number[]) {
  let len = 0;
  for (let i = 1; i < xs.length; i++) len += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  return len * 1.15; // margen por la curvatura
}

export function AreaChart({
  points,
  height = 180,
  color,
  onScrub,
  emptyLabel = 'Sin ventas en este período',
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const stroke = color ?? colors.chart.series[0];
  const [width, setWidth] = useState(0);
  const reduceMotion = useReducedMotion();
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const values = points.map((p) => p.value);
  const prevs = points.map((p) => p.prev ?? 0);
  const hasPrev = points.some((p) => p.prev != null);
  const max = Math.max(1, ...values, ...(hasPrev ? prevs : [])) * 1.12;
  const isEmpty = values.every((v) => v === 0);

  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const xs = points.map((_, i) => i * step);
  const ys = values.map((v) => PAD_TOP + plotH - (v / max) * plotH);
  const prevYs = prevs.map((v) => PAD_TOP + plotH - (v / max) * plotH);

  const line = width ? monotonePath(xs, ys) : '';
  const area = line
    ? `${line} L${xs[xs.length - 1]},${PAD_TOP + plotH} L0,${PAD_TOP + plotH} Z`
    : '';
  const prevLine = width && hasPrev ? monotonePath(xs, prevYs) : '';
  const length = width ? polylineLength(xs, ys) : 0;

  // Entrada: la línea se dibuja de izquierda a derecha y el área aparece detrás.
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!width) return;
    draw.set(reduceMotion ? 1 : withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [width, draw, reduceMotion]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  const areaStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, draw.value * 1.4 - 0.4) }));

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

  const labelIdx =
    points.length > 2
      ? [0, Math.floor((points.length - 1) / 2), points.length - 1]
      : points.map((_, i) => i);
  // Solo la línea media (muy tenue) y la base: la curva es lo único que se lee de un vistazo.
  const gridYs = [0.5, 1].map((r) => PAD_TOP + plotH * r);

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={onLayout}
        style={{ height }}
        accessibilityRole="image"
        accessibilityLabel="Gráfico de recaudación. Mantené y deslizá para ver cada punto.">
        {width > 0 && (
          <>
            {/* Grilla recesiva + valor de referencia del máximo */}
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
              {prevLine ? (
                <Path
                  d={prevLine}
                  stroke={colors.chart.previous}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  fill="none"
                />
              ) : null}
            </Svg>
            {!isEmpty && (
              <Animated.View style={[StyleSheet.absoluteFill, areaStyle]} pointerEvents="none">
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
                  <Path d={area} fill="url(#fill)" />
                </Svg>
              </Animated.View>
            )}
            {!isEmpty && (
              <Svg
                width={width}
                height={height}
                style={StyleSheet.absoluteFill}
                pointerEvents="none">
                <AnimatedPath
                  d={line}
                  stroke={stroke}
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray={`${length} ${length}`}
                  animatedProps={lineProps}
                />
              </Svg>
            )}
            <Text style={[styles.maxLabel, { top: PAD_TOP - 13 }]}>
              {formatMoneyCompact(max / 1.12)}
            </Text>
            {isEmpty && (
              <Text style={[styles.empty, { top: PAD_TOP + plotH / 2 - 9 }]}>{emptyLabel}</Text>
            )}

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

const useStyles = makeStyles((c) =>
  StyleSheet.create({
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
