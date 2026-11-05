import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { type DashboardPeriod, isCustom, type RangePreset } from '@/features/dashboard/filters';
import { deltaRatio, formatInt, formatMoney, formatPercent } from '@/features/dashboard/format';
import type { DashboardSummary } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { AreaChart, type ChartPoint } from './area-chart';
import { Icon } from './icon';
import { RollingNumber } from './rolling-number';

const RANGES: { preset: RangePreset; label: string }[] = [
  { preset: 'today', label: 'Hoy' },
  { preset: '7d', label: '7 días' },
  { preset: '30d', label: '30 días' },
  { preset: 'event', label: 'Evento' },
];

type Props = {
  summary: DashboardSummary;
  chartKey: string;
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
  chartKey,
  period,
  periodLabel,
  scopeLabel,
  onSelectPreset,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [scrub, setScrub] = useState<number | null>(null);

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
        <RollingNumber
          value={active ? active.revenue : summary.total_revenue}
          format={formatMoney}
          style={styles.hero}
        />
        <View style={styles.metaRow}>
          <DeltaChip ratio={delta} />
          <Text style={styles.meta}>{formatInt(orders)} pedidos</Text>
        </View>
      </View>

      <View style={styles.chart}>
        <AreaChart
          key={chartKey}
          points={points}
          height={150}
          color={colors.hero.line}
          onScrub={setScrub}
          emptyLabel={isHourly ? 'Sin ventas en las últimas 8 horas' : 'Sin ventas en este período'}
        />
      </View>

      <View style={styles.ranges} accessibilityRole="tablist">
        {RANGES.map((r) => {
          const on = selected === r.preset;
          return (
            <Pressable
              key={r.preset}
              onPress={() => {
                if (on) return;
                Haptics.selectionAsync();
                onSelectPreset(r.preset);
              }}
              hitSlop={4}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.range, on && styles.rangeOn]}>
              <Text style={[styles.rangeText, on && styles.rangeTextOn]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    rangeOn: { backgroundColor: c.hero.glass, borderColor: c.hero.glassBorder },
    rangeText: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    rangeTextOn: { color: c.text, fontWeight: '700' },
  }),
);
