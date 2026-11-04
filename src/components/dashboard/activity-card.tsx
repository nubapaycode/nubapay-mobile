import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { formatMoney, relativeTime } from '@/features/dashboard/format';
import type { ActivityItem } from '@/features/dashboard/types';
import { useNow } from '@/hooks/use-now';
import { makeStyles, useTheme } from '@/theme';

import { Card } from './card';
import { Icon, type IconName } from './icon';

const KIND: Record<ActivityItem['type'], { icon: IconName; series: 0 | 1 | 2; label: string }> = {
  sale: { icon: 'cart', series: 0, label: 'Venta' },
  ticket_checkin: { icon: 'ticket', series: 1, label: 'Ingreso' },
  pickup: { icon: 'check', series: 2, label: 'Retiro' },
};

/** Feed de ventas, ingresos y retiros; lo nuevo entra desde arriba y el resto se reacomoda. */
export function ActivityCard({
  items,
  index = 0,
  limit = 15,
  title = 'Últimos movimientos',
}: {
  items: ActivityItem[];
  index?: number;
  limit?: number;
  title?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const now = useNow(15_000);
  if (items.length === 0) return null;

  return (
    <Card title={title} index={index}>
      <View>
        {items.slice(0, limit).map((a, i) => {
          const k = KIND[a.type];
          const color = colors.chart.series[k.series];
          return (
            <Animated.View
              key={`${a.type}-${a.order_id}-${a.at}`}
              entering={FadeInDown.duration(350)}
              layout={LinearTransition.springify().damping(20)}
              style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
                <Icon name={k.icon} size={15} color={color} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {k.label}
                  {a.order_number ? <Text style={styles.muted}> · #{a.order_number}</Text> : null}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {[a.customer_name, a.summary].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                {a.amount != null ? (
                  <Text style={styles.amount}>+{formatMoney(a.amount)}</Text>
                ) : null}
                <Text style={styles.time}>{relativeTime(a.at, now)}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { color: c.text, fontSize: 15, fontWeight: '600' },
    muted: { color: c.textMuted, fontWeight: '400' },
    sub: { color: c.textSecondary, fontSize: 12 },
    amount: { color: c.text, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
    time: { color: c.textMuted, fontSize: 11 },
  }),
);
