import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { formatInt, formatMoney } from '@/features/dashboard/format';
import type { DashboardInsights } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { Card } from './card';
import { ProgressBar } from './progress-bar';

/** Rendimiento por punto de retiro y cola pendiente en cada uno. */
export function PickupPointsCard({
  insights,
  index = 0,
}: {
  insights: DashboardInsights;
  index?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const points = insights.pickup_points;
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.revenue));
  const live = insights.event.phase === 'live';

  return (
    <Card title="Puntos de retiro" index={index}>
      <View style={{ gap: 16 }}>
        {points.map((p, i) => (
          <View key={p.id} style={{ gap: 7 }}>
            <View style={styles.head}>
              <Text style={styles.name} numberOfLines={1}>
                {p.name}
              </Text>
              {live && p.pending_orders > 0 ? (
                <View style={styles.pending}>
                  <View style={[styles.pendingDot, { backgroundColor: colors.warning }]} />
                  <Text style={styles.pendingText}>{p.pending_orders} en cola</Text>
                </View>
              ) : null}
              <Text style={styles.revenue}>{formatMoney(p.revenue)}</Text>
            </View>
            <ProgressBar
              height={6}
              total={max}
              delay={200 + i * 80}
              segments={[{ value: p.revenue, color: colors.chart.series[0] }]}
            />
            <Text style={styles.meta}>{formatInt(p.orders)} pedidos</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { color: c.text, fontSize: 15, fontWeight: '500', flexShrink: 1 },
    revenue: {
      marginLeft: 'auto',
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    meta: { color: c.textMuted, fontSize: 12 },
    pending: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
      height: 20,
      borderRadius: Radius.pill,
      backgroundColor: c.warningMuted,
    },
    pendingDot: { width: 5, height: 5, borderRadius: 3 },
    pendingText: { color: c.warning, fontSize: 11, fontWeight: '600' },
  }),
);
