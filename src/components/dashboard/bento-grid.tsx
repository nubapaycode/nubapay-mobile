import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
import { type ComponentRef, type ReactNode, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  formatInt,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  PAYMENT_LABEL,
  relativeTime,
} from '@/features/dashboard/format';
import type { ActivityItem, DashboardData } from '@/features/dashboard/types';
import { eventOffer } from '@/features/dashboard/offer';
import { useNow } from '@/hooks/use-now';
import { makeStyles, useTheme } from '@/theme';

import { expandCard } from '@/components/motion/card-expand';

import { AnimatedNumber } from './animated-number';
import { FADE_EASING, FADE_MS, RISE_EASING, RISE_MS } from './detail-kit';
import { Icon, type IconName } from './icon';
import { LivePill } from './live-pill';
import { MilestoneHalo } from './live-moments';
import { PaymentMethodIcon } from './payment-method-icon';
import { ProgressBar } from './progress-bar';
import { Rings } from './ring';

/**
 * Resumen en grilla bento: cada tarjeta responde una sola pregunta y abre su detalle.
 * Arriba entradas y barra (cuadradas); si el evento vende una sola de las dos, esa tarjeta va a lo
 * ancho con más detalle. Abajo, cobros y actividad.
 */
export function BentoGrid({ data }: { data: DashboardData }) {
  const styles = useStyles();
  const { insights } = data;
  const offer = eventOffer(insights);
  const both = offer.tickets && offer.bar;

  return (
    <View style={styles.grid}>
      <Text style={styles.sectionLabel}>Resumen</Text>
      {both ? (
        <View style={styles.row}>
          <TicketsTile data={data} index={0} />
          <BarTile data={data} index={1} />
        </View>
      ) : offer.tickets ? (
        <TicketsTile data={data} index={0} wide />
      ) : (
        <BarTile data={data} index={0} wide />
      )}
      <SalesTile data={data} index={2} />
      {insights.recent_activity.length > 0 ? (
        <ActivityTile
          items={insights.recent_activity}
          live={insights.event.phase === 'live'}
          index={3}
        />
      ) : null}
    </View>
  );
}

/* ───────────────────────── Tiles ───────────────────────── */

function TicketsTile({ data, index, wide }: { data: DashboardData; index: number; wide?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tickets, event } = data.insights;
  const live = event.phase === 'live';
  const ratio = tickets.capacity ? tickets.sold / tickets.capacity : null;
  const inside = tickets.sold ? tickets.checked_in / tickets.sold : 0;
  const showCheckin = live || event.phase === 'ended';

  const ring = (
    <View style={styles.ringWrap}>
      {live ? <MilestoneHalo ratio={ratio} size={76} /> : null}
      <Rings
        size={76}
        stroke={4.5}
        gap={3.5}
        rings={[
          { ratio: ratio ?? 1, color: colors.chart.ramp[0] },
          ...(showCheckin ? [{ ratio: inside, color: colors.chart.ramp[1] }] : []),
        ]}
      />
      <View style={styles.ringCenter}>
        <Text style={styles.ringValue}>
          {ratio != null ? formatPercent(ratio) : formatInt(tickets.sold)}
        </Text>
      </View>
    </View>
  );

  // A lo ancho (solo entradas): anillo a la izquierda y el desglose clave–valor a la derecha.
  if (wide) {
    const rows = [
      { color: colors.chart.ramp[0], label: 'Vendidas', value: tickets.sold },
      ...(showCheckin
        ? [{ color: colors.chart.ramp[1], label: 'Adentro', value: tickets.checked_in }]
        : []),
      ...(tickets.capacity != null
        ? [
            {
              color: colors.raised,
              label: 'Disponibles',
              value: Math.max(0, tickets.capacity - tickets.sold),
            },
          ]
        : []),
    ];
    return (
      <Tile
        href="/detail/tickets"
        icon="ticket"
        title="Entradas"
        index={index}
        a11y={`${formatInt(tickets.sold)} vendidas${tickets.capacity ? ` de ${formatInt(tickets.capacity)}` : ''}`}>
        <View style={styles.wideRow}>
          {ring}
          <View style={styles.wideList}>
            {rows.map((r) => (
              <View key={r.label} style={styles.wideKv}>
                <Legend color={r.color} label={r.label} />
                <AnimatedNumber value={r.value} format={formatInt} style={styles.tileStrong} />
              </View>
            ))}
          </View>
        </View>
      </Tile>
    );
  }

  return (
    <Tile
      href="/detail/tickets"
      icon="ticket"
      title="Entradas"
      index={index}
      a11y={`${formatInt(tickets.sold)} vendidas${tickets.capacity ? ` de ${formatInt(tickets.capacity)}` : ''}`}>
      {ring}
      <View style={{ gap: 2, alignItems: 'center' }}>
        <Text style={styles.tileStrong} numberOfLines={1}>
          {formatInt(tickets.sold)}
          <Text style={styles.tileMuted}>
            {tickets.capacity ? ` / ${formatInt(tickets.capacity)}` : ' vendidas'}
          </Text>
        </Text>
        {showCheckin ? (
          <Legend color={colors.chart.ramp[1]} label={`${formatInt(tickets.checked_in)} adentro`} />
        ) : (
          <Legend color={colors.chart.ramp[0]} label="vendidas" />
        )}
      </View>
    </Tile>
  );
}

function BarTile({ data, index, wide }: { data: DashboardData; index: number; wide?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { products, event /* , pickup_points */ } = data.insights; // Puntos de retiro deshabilitado por ahora
  const pending = event.phase === 'live' && products.units_pending > 0;
  // A lo ancho (solo barra) suma el producto más pedido (los puntos de retiro están deshabilitados por ahora).
  const top = wide
    ? data.summary.top_products.find((r) => !r.name.startsWith('Entrada'))
    : undefined;

  return (
    <Tile
      href="/detail/bar"
      icon="bar"
      title="Barra"
      index={index}
      a11y={`${formatMoneyCompact(products.revenue)}, ${formatInt(products.units_sold)} ítems`}>
      <View style={{ gap: 4 }}>
        <AnimatedNumber value={products.revenue} format={formatMoneyCompact} style={styles.bigValue} />
        <Text style={styles.tileMuted}>{formatInt(products.units_sold)} ítems vendidos</Text>
      </View>
      <View style={{ gap: 8 }}>
        <ProgressBar
          height={4}
          total={Math.max(1, products.units_sold)}
          segments={[{ value: products.units_delivered, color: colors.chart.ramp[0] }]}
          delay={200}
        />
        {pending ? (
          <Chip label={`${formatInt(products.units_pending)} por retirar`} />
        ) : (
          <Text style={styles.tileMuted}>
            {formatPercent(products.units_sold ? products.units_delivered / products.units_sold : 0)}{' '}
            entregado
          </Text>
        )}
      </View>
      {wide && top /* || pickup_points.length > 0 */ ? (
        <View style={styles.wideFooter}>
          {top ? (
            <View style={styles.wideKv}>
              <Text style={styles.tileMuted}>Más pedido</Text>
              <Text style={styles.tileStrong} numberOfLines={1}>
                {top.name}
              </Text>
            </View>
          ) : null}
          {/* Puntos de retiro deshabilitado por ahora.
          {pickup_points.length > 0 ? (
            <View style={styles.wideKv}>
              <Text style={styles.tileMuted}>Puntos de retiro</Text>
              <Text style={styles.tileStrong}>{pickup_points.length}</Text>
            </View>
          ) : null}
          */}
        </View>
      ) : null}
    </Tile>
  );
}

/**
 * Cobros: la proporción por medio en una barra y, debajo, cada medio en su propia mini-card con
 * monto, cantidad y porcentaje. El efectivo sin confirmar va aparte, como aviso a atender.
 */
function SalesTile({ data, index }: { data: DashboardData; index: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { payment_breakdown } = data.summary;
  const { cash_pending } = data.insights;
  const methods = [...payment_breakdown]
    .filter((m) => m.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
  const total = methods.reduce((a, p) => a + p.revenue, 0);
  const count = methods.reduce((a, p) => a + p.count, 0);
  const color = (i: number) => colors.chart.ramp[i % 3];
  const pending = cash_pending.orders > 0 || cash_pending.amount > 0;

  return (
    <Tile
      href="/detail/sales"
      icon="cash"
      title="Cobros"
      index={index}
      right={
        count > 0 ? (
          <Text style={styles.tileMuted}>
            {formatInt(count)} {count === 1 ? 'cobro' : 'cobros'}
          </Text>
        ) : null
      }
      a11y={
        total > 0
          ? methods
              .map((m) => `${PAYMENT_LABEL[m.key]} ${formatMoney(m.revenue)}, ${formatPercent(m.revenue / total)}`)
              .join('; ')
          : 'Todavía no hay cobros'
      }>
      {total > 0 ? (
        <View style={{ gap: 10 }}>
          <ProgressBar
            height={8}
            total={total}
            segments={methods.map((m, i) => ({ value: m.revenue, color: color(i) }))}
            delay={260}
          />
          {methods.map((m, i) => (
            <View key={m.key} style={styles.method}>
              <View style={styles.methodIcon}>
                <PaymentMethodIcon method={m.key} />
                <View style={[styles.methodSwatch, { backgroundColor: color(i) }]} />
              </View>
              <View style={styles.methodTexts}>
                <Text style={styles.methodLabel} numberOfLines={1}>
                  {PAYMENT_LABEL[m.key]}
                </Text>
                <Text style={styles.tileMuted} numberOfLines={1}>
                  {formatInt(m.count)} {m.count === 1 ? 'cobro' : 'cobros'} ·{' '}
                  {formatPercent(m.revenue / total)}
                </Text>
              </View>
              <AnimatedNumber value={m.revenue} format={formatMoney} style={styles.methodAmount} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.salesEmpty}>
          <Text style={styles.tileMuted}>Todavía no hay cobros</Text>
        </View>
      )}

      {pending ? (
        <View style={[styles.pendingCard, { backgroundColor: colors.brandMuted }]}>
          <View style={[styles.pendingIcon, { backgroundColor: colors.brand }]}>
            <Icon name="clock" size={13} color={colors.onBrand} />
          </View>
          <View style={styles.methodTexts}>
            <Text style={[styles.pendingTitle, { color: colors.brandText }]} numberOfLines={1}>
              {formatMoney(cash_pending.amount)} sin confirmar
            </Text>
            <Text style={[styles.pendingText, { color: colors.brandText }]} numberOfLines={1}>
              {formatInt(cash_pending.orders)}{' '}
              {cash_pending.orders === 1 ? 'orden' : 'órdenes'} en efectivo por cobrar
            </Text>
          </View>
        </View>
      ) : null}
    </Tile>
  );
}

const ACTIVITY: Record<ActivityItem['type'], { icon: IconName; label: string }> = {
  sale: { icon: 'cart', label: 'Venta' },
  ticket_checkin: { icon: 'ticket', label: 'Ingreso' },
  pickup: { icon: 'check', label: 'Retiro' },
};

/**
 * Últimos movimientos: cada uno en su propia mini-card con ícono por tipo, detalle, monto y hace
 * cuánto. Lo nuevo entra con un fundido y el resto se reacomoda suave. En vivo, el punto que late.
 */
function ActivityTile({
  items,
  live,
  index,
}: {
  items: ActivityItem[];
  live: boolean;
  index: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const now = useNow(15_000);
  const tone: Record<ActivityItem['type'], string> = {
    sale: colors.primary,
    ticket_checkin: colors.chart.series[2],
    pickup: colors.success,
  };

  return (
    <Tile
      href="/detail/activity"
      icon="clock"
      title="Actividad"
      index={index}
      a11y="Últimos movimientos"
      right={
        live ? (
          <View style={styles.activityLive}>
            <LivePill compact />
            <Text style={[styles.chipText, { color: colors.brandText }]}>En vivo</Text>
          </View>
        ) : null
      }>
      <View style={{ gap: 8 }}>
        {items.slice(0, 3).map((a) => {
          const k = ACTIVITY[a.type];
          const detail = [a.customer_name, a.summary].filter(Boolean).join(' · ');
          return (
            <Animated.View
              key={`${a.type}-${a.order_id}-${a.at}`}
              entering={FadeIn.duration(FADE_MS).easing(FADE_EASING)}
              layout={LinearTransition.duration(260)}
              style={styles.activityCard}>
              <View style={styles.methodIcon}>
                <Icon name={k.icon} size={15} color={tone[a.type]} />
              </View>
              <View style={styles.methodTexts}>
                <Text style={styles.methodLabel} numberOfLines={1}>
                  {k.label}
                  {a.order_number != null ? (
                    <Text style={styles.activityOrder}> #{a.order_number}</Text>
                  ) : null}
                </Text>
                {detail ? (
                  <Text style={styles.tileMuted} numberOfLines={1}>
                    {detail}
                  </Text>
                ) : null}
              </View>
              <View style={styles.activityRight}>
                {a.amount != null ? (
                  <Text style={styles.activityAmount}>+{formatMoney(a.amount)}</Text>
                ) : null}
                <Text style={styles.feedTime}>{relativeTime(a.at, now)}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </Tile>
  );
}

/* ───────────────────────── Piezas ───────────────────────── */

const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };

/** Tarjeta tocable: se hunde levemente al presionar (sin rebote) y da un toque háptico al abrir. */
function Tile({
  href,
  icon,
  title,
  right,
  index,
  a11y,
  children,
}: {
  href: Href;
  icon: IconName;
  title: string;
  right?: ReactNode;
  index: number;
  a11y: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ref = useRef<ComponentRef<typeof View>>(null);
  const opening = useRef(false);

  // La tarjeta se expande hasta cubrir la pantalla y ahí se abre el detalle (con fundido).
  const open = () => {
    if (opening.current) return;
    opening.current = true;
    expandCard(ref, {
      radius: Radius.xl,
      from: colors.surface,
      to: colors.background,
      onCovered: () => {
        opening.current = false;
        router.push(href);
      },
    });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(140 + index * 70)
        .duration(RISE_MS)
        .easing(RISE_EASING)
        .withInitialValues({ opacity: 0, transform: [{ translateY: 18 }] })}
      style={styles.tileOuter}>
      <Animated.View ref={ref} collapsable={false} style={[styles.tileOuter, pressStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${a11y}. Ver detalle`}
          onPressIn={() => scale.set(withTiming(0.97, PRESS))}
          onPressOut={() => scale.set(withTiming(1, PRESS))}
          onPress={() => {
            Haptics.selectionAsync();
            open();
          }}
          style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.raised }]}>
          <View style={styles.tileHeader}>
            <View style={styles.iconChip}>
              <Icon name={icon} size={13} color={colors.textSecondary} />
            </View>
            <Text style={styles.tileTitle}>{title}</Text>
            <View style={{ flex: 1 }} />
            {right}
            <Icon name="chevronRight" size={12} color={colors.textMuted} />
          </View>
          {children}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.legend}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.tileMuted} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Pendiente a atender, en lima de marca: punto + texto (nunca solo color). */
function Chip({ label }: { label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: colors.brandMuted }]}>
      <View style={[styles.legendDot, { backgroundColor: colors.brand }]} />
      <Text style={[styles.chipText, { color: colors.brandText }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    grid: { gap: 12 },
    sectionLabel: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.2,
      marginLeft: 4,
    },
    row: { flexDirection: 'row', gap: 12 },
    tileOuter: { flex: 1 },
    tile: {
      flex: 1,
      backgroundColor: c.surface,
      boxShadow: c.cardShadow,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: Spacing.three,
      gap: 14,
      justifyContent: 'space-between',
    },
    tileHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconChip: {
      width: 26,
      height: 26,
      borderRadius: 8,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    tileTitle: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    tileStrong: {
      color: c.text,
      fontSize: 15,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    tileMuted: { color: c.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] },
    bigValue: {
      color: c.text,
      fontSize: 28,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.8,
    },
    ringWrap: { width: 76, height: 76, alignSelf: 'center' },
    wideRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
    wideList: { flex: 1, gap: 10 },
    wideKv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    wideFooter: {
      gap: 10,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderSubtle,
    },
    ringCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
    ringValue: { color: c.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    legendDot: { width: 8, height: 8, borderRadius: 2.5 },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: 6 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendValue: { color: c.text, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
    method: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      backgroundColor: c.raised,
    },
    methodIcon: {
      width: 36,
      height: 36,
      borderRadius: Radius.md,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    methodSwatch: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 12,
      height: 12,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: c.raised,
    },
    methodTexts: { flex: 1, gap: 2 },
    methodLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    methodAmount: {
      color: c.text,
      fontSize: 16,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.3,
      fontVariant: ['tabular-nums'],
    },
    salesEmpty: {
      alignItems: 'center',
      paddingVertical: 18,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      backgroundColor: c.raised,
    },
    pendingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
    },
    pendingIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingTitle: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
    pendingText: { fontSize: 12, fontWeight: '500', opacity: 0.85 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      height: 22,
      borderRadius: Radius.pill,
    },
    chipText: { fontSize: 11, fontWeight: '700' },
    activityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      backgroundColor: c.raised,
    },
    activityOrder: { color: c.textMuted, fontWeight: '500', fontVariant: ['tabular-nums'] },
    activityRight: { alignItems: 'flex-end', gap: 2 },
    activityAmount: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    activityLive: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      height: 22,
      borderRadius: Radius.pill,
      backgroundColor: c.brandMuted,
    },
    feedTime: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  }),
);
