import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  formatDecimal,
  formatInt,
  formatMoney,
  formatPercent,
  initials,
} from '@/features/dashboard/format';
import type { ActivityItem, DashboardData } from '@/features/dashboard/types';
import { useNow } from '@/hooks/use-now';
import { makeStyles, useTheme } from '@/theme';

import { enter, enterRow, FADE_EASING, FADE_MS, HeroFacts } from './detail-kit';
import { Icon, type IconName } from './icon';
import { LivePill } from './live-pill';
import { ProgressBar } from './progress-bar';
import { PulseBars } from './pulse-bars';
import { RollingNumber } from './rolling-number';
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

const MIN = 60_000;

/** Grupos por antigüedad (como el feed de Revolut agrupa por día, acá por minutos). */
function bucket(at: string | null, now: number): string {
  if (!at) return 'Anteriores';
  const t = new Date(at).getTime();
  const diff = now - t;
  if (diff < 15 * MIN) return 'Últimos 15 minutos';
  if (diff < 60 * MIN) return 'Última hora';
  if (new Date(t).toDateString() === new Date(now).toDateString()) return 'Hoy';
  return 'Anteriores';
}

function clock(at: string | null): string {
  if (!at) return '';
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Detalle de actividad (referencia: movimientos de Revolut). Arriba el ritmo: la última hora en
 * vivo con el pulso por minuto, o la hora pico. Después métricas en cards, el feed filtrable
 * agrupado por antigüedad (cada movimiento en su card) y el ranking del equipo.
 */
export function ActivityDetail({ data }: { data: DashboardData }) {
  const styles = useStyles();
  const { insights } = data;
  const { peak_hour: peak, customers, staff_scans, recent_activity } = insights;
  const live = insights.event.phase === 'live';
  const [filter, setFilter] = useState<Filter>('all');

  const items = filter === 'all' ? recent_activity : recent_activity.filter((a) => a.type === filter);
  const showFilters = new Set(recent_activity.map((a) => a.type)).size > 1;
  const peakRange = peak ? `${peak.label}–${nextHour(peak.label)} h` : null;

  const stats = [
    live && peakRange
      ? { label: 'Hora pico', value: peakRange }
      : { label: 'Ítems/pedido', value: formatDecimal(customers.avg_items_per_order) },
    { label: 'Compradores', value: formatInt(customers.unique) },
    {
      label: 'Recurrentes',
      value: customers.unique ? formatPercent(customers.repeat / customers.unique) : '—',
    },
  ];

  return (
    <View style={styles.wrap}>
      {live ? <LiveHero data={data} /> : peak ? <PeakHero peak={peak} range={peakRange!} /> : null}

      <Animated.View entering={enter(1)}>
        <HeroFacts facts={stats} />
      </Animated.View>

      {recent_activity.length > 0 ? (
        <Animated.View entering={enter(2)} style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Movimientos</Text>
            <Text style={styles.sectionMeta}>
              {items.length} {items.length === 1 ? 'reciente' : 'recientes'}
            </Text>
          </View>
          {showFilters ? (
            <Segmented options={ACTIVITY_FILTERS} value={filter} onChange={setFilter} />
          ) : null}
          <Feed items={items} />
        </Animated.View>
      ) : null}

      {staff_scans.length > 0 ? <Team scans={staff_scans} /> : null}

    </View>
  );
}

/** En vivo: pedidos de la última hora, lo recaudado y el pulso por minuto, en una card. */
function LiveHero({ data }: { data: DashboardData }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { live } = data.summary;
  return (
    <Animated.View entering={enter(0)} style={[styles.card, styles.hero]}>
      <View style={styles.heroHead}>
        <Text style={styles.heroCaption}>Última hora</Text>
        <View style={styles.livePill}>
          <LivePill compact />
          <Text style={styles.livePillText}>En vivo</Text>
        </View>
      </View>
      <View style={styles.heroRow}>
        <RollingNumber value={live.orders_last_hour} format={formatInt} style={styles.heroValue} />
        <Text style={styles.heroSuffix}> pedidos</Text>
      </View>
      <Text style={styles.heroMeta}>{formatMoney(live.revenue_last_hour)} recaudados</Text>
      <View style={{ gap: 6, marginTop: 10 }}>
        <PulseBars
          values={live.per_minute}
          height={56}
          live
          color={colors.chart.ramp[2]}
          highlight={colors.chart.ramp[0]}
        />
        <View style={styles.axis}>
          <Text style={styles.axisText}>hace 30 min</Text>
          <Text style={styles.axisText}>ahora</Text>
        </View>
      </View>
    </Animated.View>
  );
}

/** Fuera de vivo: la hora pico del evento. */
function PeakHero({
  peak,
  range,
}: {
  peak: NonNullable<DashboardData['insights']['peak_hour']>;
  range: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Animated.View entering={enter(0)} style={[styles.card, styles.hero]}>
      <View style={styles.heroHead}>
        <Text style={styles.heroCaption}>Hora pico</Text>
        <View style={styles.rangePill}>
          <Icon name="clock" size={12} color={colors.textSecondary} />
          <Text style={styles.rangeText}>{range}</Text>
        </View>
      </View>
      <View style={styles.heroRow}>
        <RollingNumber value={peak.orders} format={formatInt} style={styles.heroValue} />
        <Text style={styles.heroSuffix}> pedidos</Text>
      </View>
      <Text style={styles.heroMeta}>{formatMoney(peak.revenue)} recaudados en esa hora</Text>
    </Animated.View>
  );
}

/**
 * Feed agrupado por antigüedad, con el total cobrado de cada grupo. Al filtrar, las cards salen y
 * entran con fundido y el resto se reacomoda suave.
 */
export function Feed({ items }: { items: ActivityItem[] }) {
  const styles = useStyles();
  const now = useNow(15_000);

  if (items.length === 0) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={[styles.card, styles.emptyCard]}>
        <Text style={styles.empty}>Sin movimientos de este tipo</Text>
      </Animated.View>
    );
  }

  const groups: { title: string; items: ActivityItem[] }[] = [];
  for (const a of items) {
    const title = bucket(a.at, now);
    const last = groups[groups.length - 1];
    if (last?.title === title) last.items.push(a);
    else groups.push({ title, items: [a] });
  }

  return (
    <View style={{ gap: 14 }}>
      {groups.map((g) => {
        const sum = g.items.reduce((acc, a) => acc + (a.amount ?? 0), 0);
        return (
          <Animated.View key={g.title} layout={LinearTransition.duration(260)} style={{ gap: 8 }}>
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>{g.title}</Text>
              {sum > 0 ? <Text style={styles.groupSum}>+{formatMoney(sum)}</Text> : null}
            </View>
            {g.items.map((a) => (
              <FeedCard key={`${a.type}-${a.order_id}-${a.at}`} item={a} />
            ))}
          </Animated.View>
        );
      })}
    </View>
  );
}

function FeedCard({ item: a }: { item: ActivityItem }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const k = KIND[a.type];
  const tone: Record<ActivityItem['type'], string> = {
    sale: colors.primary,
    ticket_checkin: colors.chart.series[2],
    pickup: colors.success,
  };
  const title = a.customer_name ?? k.label;
  const detail = [a.customer_name ? k.label : null, a.order_number ? `#${a.order_number}` : null]
    .filter(Boolean)
    .join(' ');
  const meta = [detail, a.summary].filter(Boolean).join(' · ');

  return (
    <Animated.View
      entering={FadeIn.duration(FADE_MS).easing(FADE_EASING)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.duration(260)}
      style={[styles.card, styles.feedCard]}>
      <View>
        <View style={styles.avatar}>
          {a.customer_name ? (
            <Text style={styles.avatarText}>{initials(a.customer_name)}</Text>
          ) : (
            <Icon name={k.icon} size={16} color={tone[a.type]} />
          )}
        </View>
        {a.customer_name ? (
          <View style={[styles.badge, { backgroundColor: tone[a.type] }]}>
            <Icon name={k.icon} size={9} color={colors.onPrimary} />
          </View>
        ) : null}
      </View>
      <View style={styles.grow}>
        <Text style={styles.feedTitle} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.feedMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <View style={styles.feedRight}>
        {a.amount != null ? <Text style={styles.amount}>+{formatMoney(a.amount)}</Text> : null}
        <Text style={styles.feedMeta}>{clock(a.at)}</Text>
      </View>
    </Animated.View>
  );
}

/** Ranking de escaneos: cada persona en su card, el primero destacado. */
function Team({ scans }: { scans: DashboardData['insights']['staff_scans'] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = scans.reduce((a, s) => a + s.units_redeemed, 0);
  const max = Math.max(1, ...scans.map((s) => s.units_redeemed));

  return (
    <Animated.View entering={enter(3)} style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Equipo</Text>
        <Text style={styles.sectionMeta}>{formatInt(total)} escaneos</Text>
      </View>
      {scans.map((s, i) => {
        const first = i === 0;
        return (
          <Animated.View key={s.user_id} entering={enterRow(i)} style={[styles.card, styles.staff]}>
            <Text style={[styles.rank, first && { color: colors.text }]}>{i + 1}</Text>
            <View style={[styles.avatar, first && styles.avatarFirst]}>
              <Text style={[styles.avatarText, first && styles.avatarTextFirst]}>
                {s.name ? initials(s.name) : '?'}
              </Text>
            </View>
            <View style={[styles.grow, { gap: 8 }]}>
              <View style={styles.staffHead}>
                <Text style={styles.feedTitle} numberOfLines={1}>
                  {s.name ?? 'Sin nombre'}
                </Text>
                <Text style={styles.staffCount}>{formatInt(s.units_redeemed)}</Text>
              </View>
              <ProgressBar
                height={4}
                total={max}
                delay={260 + i * 70}
                segments={[
                  { value: s.units_redeemed, color: first ? colors.chart.ramp[0] : colors.chart.ramp[1] },
                ]}
              />
              <Text style={styles.feedMeta}>
                {total ? formatPercent(s.units_redeemed / total) : '—'} de los escaneos
              </Text>
            </View>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const AVATAR = 40;

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: 28 },
    grow: { flex: 1, gap: 2 },
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },

    hero: { padding: Spacing.three, gap: 4 },
    heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroCaption: { color: c.textSecondary, fontSize: 14, fontWeight: '500' },
    heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
    heroValue: {
      color: c.text,
      fontSize: 38,
      lineHeight: 44,
      fontFamily: DisplayFont.bold,
      letterSpacing: -1.2,
    },
    heroSuffix: { color: c.textMuted, fontSize: 15, fontWeight: '500', marginBottom: 7 },
    heroMeta: { color: c.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 9,
      height: 24,
      borderRadius: Radius.pill,
      backgroundColor: c.brandMuted,
    },
    livePillText: { color: c.brandText, fontSize: 11, fontWeight: '700' },
    rangePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      height: 24,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    rangeText: { color: c.text, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
    axis: { flexDirection: 'row', justifyContent: 'space-between' },
    axisText: { color: c.textMuted, fontSize: 11 },


    section: { gap: 10 },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    sectionTitle: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold },
    sectionMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },

    groupHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginTop: 2,
    },
    groupTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    groupSum: { color: c.textSecondary, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },

    feedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    avatarFirst: { backgroundColor: c.text },
    avatarText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
    avatarTextFirst: { color: c.surface },
    badge: {
      position: 'absolute',
      right: -3,
      bottom: -3,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.surface,
    },
    feedTitle: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold, flexShrink: 1 },
    feedMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    feedRight: { alignItems: 'flex-end', gap: 2 },
    amount: { color: c.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
    emptyCard: { paddingVertical: Spacing.four },
    empty: { color: c.textMuted, fontSize: 13, textAlign: 'center' },

    staff: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    rank: {
      width: 16,
      color: c.textMuted,
      fontSize: 14,
      fontFamily: DisplayFont.bold,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    staffHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    staffCount: {
      marginLeft: 'auto',
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
  }),
);
