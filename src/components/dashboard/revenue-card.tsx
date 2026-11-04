import { StyleSheet, Text, View } from 'react-native';

import { formatInt, formatMoney, formatPercent, PAYMENT_LABEL } from '@/features/dashboard/format';
import type { DashboardInsights, DashboardSummary } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { Card } from './card';
import { ProgressBar } from './progress-bar';

/** Medios de pago: barra apilada + una fila por medio (leyenda directa). */
export function PaymentMethodsCard({
  summary,
  index = 0,
}: {
  summary: DashboardSummary;
  index?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = {
    mp: colors.chart.series[0],
    cash: colors.chart.series[1],
    transfer: colors.chart.series[2],
  } as const;
  const total = summary.payment_breakdown.reduce((a, p) => a + p.revenue, 0);

  return (
    <Card title="Medios de pago" index={index}>
      <ProgressBar
        height={10}
        total={total}
        segments={summary.payment_breakdown.map((p) => ({ value: p.revenue, color: color[p.key] }))}
      />
      <View style={{ gap: 12 }}>
        {summary.payment_breakdown.map((p) => (
          <View key={p.key} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: color[p.key] }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{PAYMENT_LABEL[p.key]}</Text>
              <Text style={styles.sub}>
                {formatInt(p.count)} pedidos · {total ? formatPercent(p.revenue / total) : '0%'}
              </Text>
            </View>
            <Text style={styles.value}>{formatMoney(p.revenue)}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Entradas vs. barra en una barra partida. */
export function RevenueSplitCard({
  insights,
  index = 0,
}: {
  insights: DashboardInsights;
  index?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tickets, products } = insights.revenue_split;
  const total = tickets + products;
  if (total <= 0) return null;
  const parts = [
    { label: 'Entradas', value: tickets, color: colors.chart.series[0] },
    { label: 'Barra y comida', value: products, color: colors.chart.series[2] },
  ];
  return (
    <Card title="Entradas vs. barra" index={index}>
      <ProgressBar
        height={10}
        total={total}
        segments={parts.map((p) => ({ value: p.value, color: p.color }))}
      />
      <View style={styles.split}>
        {parts.map((p) => (
          <View key={p.label} style={{ flex: 1, gap: 2 }}>
            <View style={styles.legendHead}>
              <View style={[styles.swatch, { backgroundColor: p.color }]} />
              <Text style={styles.sub}>
                {p.label} · {formatPercent(p.value / total)}
              </Text>
            </View>
            <Text style={styles.value}>{formatMoney(p.value)}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    swatch: { width: 8, height: 8, borderRadius: 2 },
    label: { color: c.text, fontSize: 15 },
    sub: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    value: { color: c.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
    split: { flexDirection: 'row', gap: 12 },
    legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  }),
);
