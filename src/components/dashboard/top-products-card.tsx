import { StyleSheet, Text, View } from 'react-native';

import { formatInt, formatMoney } from '@/features/dashboard/format';
import type { DashboardSummary } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { Card } from './card';
import { ProgressBar } from './progress-bar';

/** Ranking por unidades, con barra relativa al primero (patrón YouTube Studio / Square). */
export function TopProductsCard({
  summary,
  index = 0,
  filter,
  title = 'Lo más vendido',
}: {
  summary: DashboardSummary;
  index?: number;
  filter?: 'products' | 'tickets';
  title?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const rows = summary.top_products
    .filter((r) =>
      filter === 'products'
        ? !r.name.startsWith('Entrada')
        : filter === 'tickets'
          ? r.name.startsWith('Entrada')
          : true,
    )
    .slice(0, 6);
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.quantity));

  return (
    <Card title={title} index={index}>
      <View style={{ gap: 14 }}>
        {rows.map((r, i) => (
          <View key={r.name} style={{ gap: 6 }}>
            <View style={styles.head}>
              <Text style={styles.rank}>{i + 1}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.qty}>×{formatInt(r.quantity)}</Text>
              <Text style={styles.revenue}>{formatMoney(r.revenue)}</Text>
            </View>
            <View style={{ paddingLeft: 22 }}>
              <ProgressBar
                height={4}
                total={max}
                delay={200 + i * 70}
                segments={[{ value: r.quantity, color: colors.chart.series[0] }]}
              />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rank: {
      width: 14,
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    name: { color: c.text, fontSize: 15, flex: 1 },
    qty: { color: c.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] },
    revenue: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      minWidth: 84,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
  }),
);
