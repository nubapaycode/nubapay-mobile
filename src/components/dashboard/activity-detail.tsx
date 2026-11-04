import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { DisplayFont, Spacing } from '@/constants/theme';
import {
  formatDecimal,
  formatInt,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  initials,
  relativeTime,
} from '@/features/dashboard/format';
import type { ActivityItem, DashboardData } from '@/features/dashboard/types';
import { useNow } from '@/hooks/use-now';
import { makeStyles, useTheme } from '@/theme';

import {
  DetailHero,
  DetailSection,
  FADE_EASING,
  FADE_MS,
  ListRow,
  StatsRow,
  useRowStyles,
} from './detail-kit';
import { Icon, type IconName } from './icon';
import { ProgressBar } from './progress-bar';
import { PulseBars } from './pulse-bars';
import { Segmented } from './segmented';

export type ActivityFilter = 'all' | ActivityItem['type'];
type Filter = ActivityFilter;

const KIND: Record<ActivityItem['type'], { icon: IconName; label: string }> = {
  sale: { icon: 'cart', label: 'Venta' },
  ticket_checkin: { icon: 'ticket', label: 'Ingreso' },
  pickup: { icon: 'check', label: 'Retiro' },
};

export const ACTIVITY_FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'sale', label: 'Ventas' },
  { value: 'ticket_checkin', label: 'Ingresos' },
  { value: 'pickup', label: 'Retiros' },
];

const nextHour = (label: string) =>
  String((Number(label.slice(0, 2)) + 1) % 24).padStart(2, '0');

/**
 * Detalle de actividad: el ritmo (última hora en vivo, o la hora pico), métricas de compradores,
 * el feed filtrable con transiciones de layout y el rendimiento del equipo.
 */
export function ActivityDetail({ data }: { data: DashboardData }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { insights, summary } = data;
  const { peak_hour: peak, customers, staff_scans, recent_activity } = insights;
  const live = insights.event.phase === 'live';
  const [filter, setFilter] = useState<Filter>('all');

  const items = filter === 'all' ? recent_activity : recent_activity.filter((a) => a.type === filter);
  const showFilters = new Set(recent_activity.map((a) => a.type)).size > 1;
  const peakRange = peak ? `${peak.label} a ${nextHour(peak.label)} h` : null;

  const staffTotal = staff_scans.reduce((a, s) => a + s.units_redeemed, 0);
  const staffMax = Math.max(1, ...staff_scans.map((s) => s.units_redeemed));

  return (
    <View style={styles.wrap}>
      {/* En vivo: el pulso de la última hora. Si no, la hora pico del evento. */}
      {live ? (
        <DetailHero
          caption="Última hora"
          value={summary.live.orders_last_hour}
          format={formatInt}
          suffix="pedidos"
          meta={`${formatMoney(summary.live.revenue_last_hour)} recaudados`}>
          <View style={{ gap: 6 }}>
            <PulseBars
              values={summary.live.per_minute}
              height={48}
              live
              color={colors.chart.ramp[2]}
              highlight={colors.chart.ramp[0]}
            />
            <View style={styles.axis}>
              <Text style={styles.axisText}>hace 30 min</Text>
              <Text style={styles.axisText}>ahora</Text>
            </View>
          </View>
        </DetailHero>
      ) : peak ? (
        <DetailHero
          caption={`Hora pico · ${peakRange}`}
          value={peak.orders}
          format={formatInt}
          suffix="pedidos"
          meta={`${formatMoney(peak.revenue)} recaudados en esa hora`}
        />
      ) : null}

      <StatsRow
        index={1}
        stats={[
          live && peakRange
            ? { label: 'Hora pico', value: `${peak!.label}–${nextHour(peak!.label)}h` }
            : { label: 'Ítems/pedido', value: formatDecimal(customers.avg_items_per_order) },
          { label: 'Compradores', value: formatInt(customers.unique) },
          {
            label: 'Recurrentes',
            value: customers.unique ? formatPercent(customers.repeat / customers.unique) : '—',
          },
        ]}
      />

      {recent_activity.length > 0 ? (
        <DetailSection title="Últimos movimientos" meta={`${items.length} recientes`} index={2}>
          {showFilters ? (
            <View style={styles.filters}>
              <Segmented options={ACTIVITY_FILTERS} value={filter} onChange={setFilter} />
            </View>
          ) : null}
          <Feed items={items} />
        </DetailSection>
      ) : null}

      {staff_scans.length > 0 ? (
        <DetailSection title="Equipo" meta="escaneos por persona" index={3}>
          {staff_scans.map((s, i) => (
            <ListRow key={s.user_id} index={i}>
              <View style={styles.staffRow}>
                <View style={[styles.avatar, i === 0 && styles.avatarFirst]}>
                  <Text style={[styles.avatarText, i === 0 && styles.avatarTextFirst]}>
                    {s.name ? initials(s.name) : '?'}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <StaffHead name={s.name} count={s.units_redeemed} />
                  <ProgressBar
                    height={4}
                    total={staffMax}
                    delay={260 + i * 70}
                    segments={[
                      {
                        value: s.units_redeemed,
                        color: i === 0 ? colors.chart.ramp[0] : colors.chart.ramp[1],
                      },
                    ]}
                  />
                  <Text style={styles.staffMeta}>
                    {staffTotal ? formatPercent(s.units_redeemed / staffTotal) : '—'} de los escaneos
                  </Text>
                </View>
              </View>
            </ListRow>
          ))}
        </DetailSection>
      ) : null}
    </View>
  );
}

/** Feed: al filtrar, las filas salen/entran con fundido y el resto se reacomoda suave. */
export function Feed({ items }: { items: ActivityItem[] }) {
  const styles = useStyles();
  const row = useRowStyles();
  const { colors } = useTheme();
  const now = useNow(15_000);

  if (items.length === 0) {
    return <Text style={styles.empty}>Sin movimientos de este tipo</Text>;
  }

  return (
    <View>
      {items.map((a, i) => {
        const k = KIND[a.type];
        return (
          <Animated.View
            key={`${a.type}-${a.order_id}-${a.at}`}
            entering={FadeIn.duration(FADE_MS).easing(FADE_EASING)}
            exiting={FadeOut.duration(160)}
            layout={LinearTransition.duration(260)}
            style={[styles.feedRow, i > 0 && styles.feedBorder]}>
            <View style={[styles.feedIcon, a.type === 'sale' && styles.feedIconSale]}>
              <Icon
                name={k.icon}
                size={14}
                color={a.type === 'sale' ? colors.chart.ramp[0] : colors.textSecondary}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={row.name} numberOfLines={1}>
                {k.label}
                {a.order_number ? (
                  <Text style={styles.orderNumber}> #{a.order_number}</Text>
                ) : null}
              </Text>
              <Text style={row.meta} numberOfLines={1}>
                {[a.customer_name, a.summary].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={styles.feedRight}>
              {a.amount != null ? (
                <Text style={styles.amount}>+{formatMoneyCompact(a.amount)}</Text>
              ) : null}
              <Text style={row.meta}>{relativeTime(a.at, now)}</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function StaffHead({ name, count }: { name: string | null; count: number }) {
  const row = useRowStyles();
  return (
    <View style={row.top}>
      <Text style={row.name} numberOfLines={1}>
        {name ?? 'Sin nombre'}
      </Text>
      <Text style={row.value}>{formatInt(count)}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: 32 },
    axis: { flexDirection: 'row', justifyContent: 'space-between' },
    axisText: { color: c.textMuted, fontSize: 11 },

    filters: {
      paddingTop: Spacing.three,
      paddingBottom: 6,
    },
    feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    feedBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },
    feedIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    feedIconSale: { backgroundColor: 'rgba(0, 105, 255, 0.08)' },
    orderNumber: { color: c.textMuted, fontSize: 13 },
    feedRight: { alignItems: 'flex-end', gap: 2 },
    amount: { color: c.text, fontSize: 14, fontFamily: DisplayFont.semibold, fontVariant: ['tabular-nums'] },
    empty: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: Spacing.four,
    },

    staffRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    avatarFirst: { backgroundColor: c.text },
    avatarText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
    avatarTextFirst: { color: c.surface },
    staffMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  }),
);
