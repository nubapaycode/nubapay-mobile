import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { type LayoutRectangle, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { type DashboardPeriod, isCustom, type RangePreset } from '@/features/dashboard/filters';
import { deltaRatio, formatInt, formatMoney, formatPercent } from '@/features/dashboard/format';
import type { DashboardSummary } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { AreaChart, type ChartPoint } from './area-chart';
import { Icon } from './icon';
import { SaleBurst } from './live-moments';
import { RollingNumber } from './rolling-number';

const RANGES: { preset: RangePreset; label: string }[] = [
  { preset: 'today', label: 'Hoy' },
  { preset: '7d', label: '7 días' },
  { preset: '30d', label: '30 días' },
  { preset: 'event', label: 'Evento' },
];

const SLIDE = { duration: 320, easing: Easing.out(Easing.cubic) };

type Props = {
  summary: DashboardSummary;
  /** Evento en vivo: la curva muestra la punta que late y el ping de cada venta. */
  live: boolean;
  period: DashboardPeriod;
  /** Período elegido ("Últimos 30 días", "Hoy", rango personalizado…). */
  periodLabel: string;
  /** "Entradas" / "Barra" si se filtró por tipo; null = todo. */
  scopeLabel: string | null;
  onSelectPreset: (preset: RangePreset) => void;
};

/**
 * Hero del inicio sobre el degradé: la recaudación centrada con dígitos que ruedan, la variación
 * contra el período anterior, la curva a lo ancho (mantené y deslizá) y los atajos de período.
 */
export function PulseHero({
  summary,
  live,
  period,
  periodLabel,
  scopeLabel,
  onSelectPreset,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [scrub, setScrub] = useState<number | null>(null);
  // La línea del período anterior se puede ocultar desde la leyenda.
  const [showPrev, setShowPrev] = useState(true);
  const hasPrev = summary.series.points.some((p) => p.prev_revenue != null);

  const points: ChartPoint[] = summary.series.points.map((p) => ({
    label: p.label,
    value: p.revenue,
    prev: p.prev_revenue,
  }));
  const active = scrub != null ? summary.series.points[scrub] : null;
  const isHourly = summary.series.kind === 'hourly';

  const delta = active
    ? deltaRatio(active.revenue, active.prev_revenue)
    : deltaRatio(summary.total_revenue, summary.comparison?.total_revenue);
  const orders = active ? active.orders : summary.order_count;
  const selected = isCustom(period) ? null : period.preset;

  return (
    <View style={styles.wrap}>
      <View style={styles.numbers}>
        <Text style={styles.caption} numberOfLines={1}>
          {active
            ? `${isHourly ? 'Franja de las ' : ''}${active.label}`
            : `Recaudado · ${scopeLabel ? `${scopeLabel} · ` : ''}${periodLabel}`}
        </Text>
        <View>
          <RollingNumber
            value={active ? active.revenue : summary.total_revenue}
            format={formatMoney}
            style={styles.hero}
          />
          <SaleBurst
            value={summary.total_revenue}
            live={live && active == null}
            resetKey={`${periodLabel}|${scopeLabel ?? ''}`}
          />
        </View>
        <View style={styles.metaRow}>
          <DeltaChip ratio={delta} />
          <Text style={styles.meta}>
            {formatInt(orders)} pedidos
            {active && showPrev && active.prev_revenue != null ? (
              <Text style={styles.metaPrev}> · antes {formatMoney(active.prev_revenue)}</Text>
            ) : null}
          </Text>
        </View>
      </View>

      <View style={styles.chart}>
        <AreaChart
          points={points}
          live={live}
          height={150}
          color={colors.hero.line}
          onScrub={setScrub}
          showPrev={showPrev}
          emptyLabel={isHourly ? 'Sin ventas en las últimas 8 horas' : 'Sin ventas en este período'}
        />
      </View>

      {hasPrev ? (
        <ChartLegend
          showPrev={showPrev}
          onToggle={() => {
            Haptics.selectionAsync();
            setShowPrev((v) => !v);
          }}
        />
      ) : null}

      <RangeTabs selected={selected} onSelect={onSelectPreset} />
    </View>
  );
}

/**
 * Qué es cada línea: la de este período y la punteada del anterior (mismo tramo, corrido). Tocar
 * "Anterior" la muestra u oculta.
 */
function ChartLegend({ showPrev, onToggle }: { showPrev: boolean; onToggle: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendLine, { backgroundColor: colors.hero.line }]} />
        <Text style={styles.legendText}>Este período</Text>
      </View>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="switch"
        accessibilityState={{ checked: showPrev }}
        accessibilityLabel="Comparar con el período anterior"
        style={({ pressed }) => [styles.legendItem, styles.legendToggle, pressed && { opacity: 0.6 }]}>
        <View style={styles.legendDash}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.legendDot, { backgroundColor: colors.chart.previous }]} />
          ))}
        </View>
        <Text style={[styles.legendText, !showPrev && styles.legendOff]}>Anterior</Text>
      </Pressable>
    </View>
  );
}

/** Atajos de período con una píldora que se desliza hasta el elegido. */
function RangeTabs({
  selected,
  onSelect,
}: {
  selected: RangePreset | null;
  onSelect: (preset: RangePreset) => void;
}) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const [frames, setFrames] = useState<Partial<Record<RangePreset, LayoutRectangle>>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const shown = useSharedValue(0);
  const target = selected ? frames[selected] : undefined;

  const tx = target?.x;
  const tw = target?.width;
  // Al aparecer se ubica sin animar; después se desliza de un período al otro.
  useEffect(() => {
    if (tx == null || tw == null) {
      shown.set(withTiming(0, { duration: 160 }));
      return;
    }
    const jump = shown.get() === 0 || reduceMotion;
    x.set(jump ? tx : withTiming(tx, SLIDE));
    w.set(jump ? tw : withTiming(tw, SLIDE));
    shown.set(withTiming(1, { duration: 160 }));
  }, [tx, tw, reduceMotion, x, w, shown]);

  const pill = useAnimatedStyle(() => ({
    opacity: shown.value,
    width: w.value,
    transform: [{ translateX: x.value }],
  }));

  return (
    <View style={styles.ranges} accessibilityRole="tablist">
      <Animated.View pointerEvents="none" style={[styles.rangePill, pill]} />
      {RANGES.map((r) => {
        const on = selected === r.preset;
        return (
          <Pressable
            key={r.preset}
            onLayout={(e) => {
              const f = e.nativeEvent.layout;
              setFrames((prev) => ({ ...prev, [r.preset]: f }));
            }}
            onPress={() => {
              if (on) return;
              Haptics.selectionAsync();
              onSelect(r.preset);
            }}
            hitSlop={4}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={styles.range}>
            <Text style={[styles.rangeText, on && styles.rangeTextOn]}>{r.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Variación vs. período anterior: lima de marca si sube, rojo si baja. Ícono + signo, no solo color. */
function DeltaChip({ ratio }: { ratio: number | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (ratio == null) return null;
  const up = ratio >= 0;
  const fg = up ? colors.onBrand : colors.danger;
  return (
    <View
      style={[styles.delta, { backgroundColor: up ? colors.brand : colors.dangerMuted }]}
      accessibilityLabel={`${up ? 'Sube' : 'Baja'} ${formatPercent(Math.abs(ratio))} contra el período anterior`}>
      <Icon name={up ? 'up' : 'down'} size={11} color={fg} />
      <Text style={[styles.deltaText, { color: fg }]}>
        {up ? '+' : '−'}
        {formatPercent(Math.abs(ratio))} vs. anterior
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: Spacing.two },
    numbers: { alignItems: 'center', gap: 6 },
    caption: { color: c.textSecondary, fontSize: 13, fontWeight: '500', textAlign: 'center' },
    hero: {
      color: c.text,
      fontSize: 44,
      lineHeight: 52,
      fontFamily: DisplayFont.bold,
      letterSpacing: -1.4,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
    metaPrev: { color: c.textMuted },
    legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: -2 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendToggle: { paddingHorizontal: 8, height: 24, borderRadius: Radius.pill },
    legendLine: { width: 14, height: 2, borderRadius: 1 },
    legendDash: { flexDirection: 'row', gap: 2 },
    legendDot: { width: 4, height: 2, borderRadius: 1 },
    legendText: { color: c.textSecondary, fontSize: 12, fontWeight: '500' },
    legendOff: { color: c.textMuted, textDecorationLine: 'line-through' },
    meta: { color: c.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
    delta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      height: 24,
      paddingHorizontal: 9,
      borderRadius: Radius.pill,
    },
    deltaText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
    // La curva casi de borde a borde (sin card), con un respiro para las etiquetas del eje.
    chart: { marginHorizontal: -Spacing.two, marginTop: Spacing.two },
    ranges: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
    range: {
      height: 30,
      paddingHorizontal: 14,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rangePill: {
      position: 'absolute',
      left: 0,
      top: 0,
      height: 30,
      borderRadius: Radius.pill,
      backgroundColor: c.hero.glass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hero.glassBorder,
    },
    rangeText: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    rangeTextOn: { color: c.text, fontWeight: '700' },
  }),
);
