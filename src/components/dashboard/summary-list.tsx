import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  formatInt,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  PAYMENT_LABEL,
  relativeTime,
} from '@/features/dashboard/format';
import type { DashboardData } from '@/features/dashboard/types';
import { useNow } from '@/hooks/use-now';
import { makeStyles, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { ProgressBar } from './progress-bar';

type Row = {
  key: string;
  href: Href;
  icon: IconName;
  title: string;
  value?: string;
  detail: string;
  alert?: boolean;
  progress?: { value: number; total: number };
};

/**
 * Resumen en filas: una línea por tema y el detalle completo un toque más abajo
 * (divulgación progresiva en lugar de apilar todas las métricas en el home).
 */
export function SummaryList({ data }: { data: DashboardData }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const now = useNow(15_000);
  const { insights, summary } = data;
  const { tickets, products, cash_pending, event } = insights;
  const live = event.phase === 'live';

  const topPayment = [...summary.payment_breakdown].sort((a, b) => b.revenue - a.revenue)[0];
  const payTotal = summary.payment_breakdown.reduce((a, p) => a + p.revenue, 0);
  const last = insights.recent_activity[0];

  const rows: Row[] = [];
  if (tickets.types.length > 0) {
    rows.push({
      key: 'tickets',
      href: '/detail/tickets',
      icon: 'ticket',
      title: 'Entradas',
      value: tickets.capacity
        ? formatPercent(tickets.sold / tickets.capacity)
        : formatInt(tickets.sold),
      detail:
        event.phase === 'upcoming'
          ? `${formatInt(tickets.sold)}${tickets.capacity ? ` de ${formatInt(tickets.capacity)}` : ''} vendidas`
          : live
            ? `${formatInt(tickets.checked_in)} adentro · faltan ${formatInt(tickets.sold - tickets.checked_in)}`
            : `${formatInt(tickets.checked_in)} asistieron de ${formatInt(tickets.sold)}`,
      progress: tickets.capacity ? { value: tickets.sold, total: tickets.capacity } : undefined,
    });
  }
  rows.push({
    key: 'bar',
    href: '/detail/bar',
    icon: 'bar',
    title: 'Barra',
    value: formatMoneyCompact(products.revenue),
    detail:
      live && products.units_pending > 0
        ? `${formatInt(products.units_pending)} ítems por retirar`
        : `${formatInt(products.units_sold)} ítems vendidos`,
    alert: live && products.units_pending > 0,
  });
  rows.push({
    key: 'sales',
    href: '/detail/sales',
    icon: 'cash',
    title: 'Cobros',
    value: cash_pending.amount > 0 ? formatMoneyCompact(cash_pending.amount) : undefined,
    detail:
      cash_pending.orders > 0
        ? `${cash_pending.orders} pedidos por cobrar`
        : topPayment && payTotal
          ? `${formatPercent(topPayment.revenue / payTotal)} con ${PAYMENT_LABEL[topPayment.key]}`
          : 'Sin cobros',
    alert: cash_pending.orders > 0,
  });
  if (last) {
    rows.push({
      key: 'activity',
      href: '/detail/activity',
      icon: 'clock',
      title: 'Actividad',
      detail: `${last.type === 'sale' ? `Venta de ${formatMoney(last.amount ?? 0)}` : last.type === 'ticket_checkin' ? 'Ingreso' : 'Retiro'} · ${relativeTime(last.at, now)}`,
    });
  }

  return (
    <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.list}>
      {rows.map((r, i) => (
        <Pressable
          key={r.key}
          accessibilityRole="button"
          accessibilityLabel={`${r.title}. ${r.value ?? ''} ${r.detail}. Ver detalle`}
          onPress={() => {
            Haptics.selectionAsync();
            router.push(r.href);
          }}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.raised }]}>
          <View style={styles.iconWrap}>
            <Icon name={r.icon} size={17} color={colors.text} />
          </View>
          <View style={[styles.body, i > 0 && styles.divider]}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.title}>{r.title}</Text>
              <View style={styles.detailRow}>
                {r.alert ? (
                  <View style={[styles.alertDot, { backgroundColor: colors.warning }]} />
                ) : null}
                <Text
                  style={[styles.detail, r.alert && { color: colors.warning }]}
                  numberOfLines={1}>
                  {r.detail}
                </Text>
              </View>
              {r.progress ? (
                <View style={{ marginTop: 6 }}>
                  <ProgressBar
                    height={4}
                    total={r.progress.total}
                    segments={[{ value: r.progress.value, color: colors.chart.series[0] }]}
                  />
                </View>
              ) : null}
            </View>
            {r.value ? <Text style={styles.value}>{r.value}</Text> : null}
            <Icon name="chevronRight" size={13} color={colors.textMuted} />
          </View>
        </Pressable>
      ))}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    list: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.surface,
      borderWidth: c.scheme === 'dark' ? StyleSheet.hairlineWidth : 0,
      borderColor: c.border,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', paddingLeft: Spacing.three, gap: 14 },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    body: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 15,
      paddingRight: Spacing.three,
    },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    title: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    alertDot: { width: 6, height: 6, borderRadius: 3 },
    detail: { color: c.textSecondary, fontSize: 13, flexShrink: 1 },
    value: { color: c.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  }),
);
