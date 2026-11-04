import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DisplayFont, Spacing } from '@/constants/theme';
import {
  deltaRatio,
  formatInt,
  formatMoney,
  formatMoneyCompact,
} from '@/features/dashboard/format';
import type { DashboardSummary, EventPhase } from '@/features/dashboard/types';
import { light, makeStyles, PaletteScope, useTheme } from '@/theme';

import { AnimatedNumber } from './animated-number';
import { AreaChart, type ChartPoint } from './area-chart';
import { DeltaBadge } from './delta-badge';
import { Icon } from './icon';
import { PulseBars } from './pulse-bars';
import { RollingNumber } from './rolling-number';

type Props = {
  summary: DashboardSummary;
  phase: EventPhase;
  chartKey: string;
  /** Período elegido ("Últimos 30 días", "Hoy", rango personalizado…). */
  periodLabel: string;
  /** "Entradas" / "Barra" si se filtró por tipo; null = todo. */
  scopeLabel: string | null;
  /** Cuántos filtros difieren del default (contador del botón). */
  filterCount: number;
  onOpenFilters: () => void;
};

/**
 * Bloque protagonista a todo el ancho y siempre sobre blanco: la cifra con dígitos que ruedan,
 * la variación y el gráfico de tendencia.
 * Con el evento en curso suma el pulso de la última hora (patrón "Live View" de Shopify).
 */
export function HeroSection(props: Props) {
  return (
    <PaletteScope palette={light}>
      <HeroCard {...props} />
    </PaletteScope>
  );
}

function HeroCard({
  summary,
  phase,
  chartKey,
  periodLabel,
  scopeLabel,
  filterCount,
  onOpenFilters,
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
  const live = phase === 'live';

  const delta = active
    ? deltaRatio(active.revenue, active.prev_revenue)
    : deltaRatio(summary.total_revenue, summary.comparison?.total_revenue);
  const orders = active ? active.orders : summary.order_count;

  return (
    <View style={styles.card}>
      <View style={styles.numbers}>
        <View style={styles.captionRow}>
          <Text style={styles.caption} numberOfLines={1}>
            {active
              ? `${isHourly ? 'Franja de las ' : ''}${active.label}`
              : `${scopeLabel ? `${scopeLabel} · ` : ''}${periodLabel}`}
          </Text>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onOpenFilters();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Filtros${filterCount ? `, ${filterCount} activos` : ''}`}
            style={({ pressed }) => [styles.filterBtn, pressed && { backgroundColor: colors.border }]}>
            <Icon name="filter" size={16} color="#000000" />
            {filterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <RollingNumber
          value={active ? active.revenue : summary.total_revenue}
          format={formatMoney}
          style={styles.hero}
        />
        <View style={styles.metaRow}>
          <DeltaBadge ratio={delta} />
          <Text style={styles.meta}>
            {formatInt(orders)} pedidos
            {delta != null && !active ? ' · vs. período anterior' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.chart}>
        <AreaChart
          key={chartKey}
          points={points}
          height={176}
          onScrub={setScrub}
          emptyLabel={isHourly ? 'Sin ventas en las últimas 8 horas' : 'Sin ventas en este período'}
        />
        <Text style={styles.chartNote}>
          {isHourly
            ? 'Últimas 8 horas · mantené y deslizá'
            : summary.comparison
              ? 'Punteado: período anterior · mantené y deslizá'
              : 'Por día · mantené y deslizá'}
        </Text>
      </View>

      {live ? (
        <View
          style={styles.live}
          accessibilityLabel={`${summary.live.orders_last_hour} pedidos en la última hora`}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.liveTitle}>
              <AnimatedNumber
                value={summary.live.orders_last_hour}
                format={formatInt}
                style={styles.liveStrong}
              />{' '}
              pedidos en la última hora
            </Text>
            <Text style={styles.liveSub}>
              {formatMoneyCompact(summary.live.revenue_last_hour)} recaudados
            </Text>
          </View>
          <View style={styles.liveBars}>
            <PulseBars
              values={summary.live.per_minute.slice(-20)}
              height={30}
              live
              color={light.chart.ramp[2]}
              highlight={light.chart.ramp[0]}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      backgroundColor: '#ffffff',
      marginHorizontal: -Spacing.three,
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.four,
      paddingBottom: Spacing.three,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      gap: Spacing.three,
    },
    numbers: { gap: 8 },
    captionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 26,
    },
    caption: { flex: 1, color: c.textSecondary, fontSize: 14, fontWeight: '500' },
    filterBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    filterBadge: {
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
      borderWidth: 2,
      borderColor: '#ffffff',
    },
    filterBadgeText: { color: c.onPrimary, fontSize: 10, fontWeight: '700' },
    hero: {
      color: c.text,
      fontSize: 38,
      lineHeight: 44,
      fontFamily: DisplayFont.bold,
      letterSpacing: -1.2,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
    meta: { color: c.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
    chart: { gap: 6 },
    chartNote: { color: c.textMuted, fontSize: 11, textAlign: 'center' },
    live: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 2,
      paddingTop: Spacing.three,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    liveTitle: { color: c.text, fontSize: 14 },
    liveStrong: { color: c.text, fontSize: 14, fontFamily: DisplayFont.bold },
    liveSub: { color: c.textSecondary, fontSize: 12 },
    liveBars: { width: 104 },
  }),
);
