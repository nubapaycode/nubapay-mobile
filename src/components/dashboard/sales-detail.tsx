import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  formatDecimal,
  formatInt,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  PAYMENT_LABEL,
} from '@/features/dashboard/format';
import type { DashboardData } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { DetailNote, enter, enterRow } from './detail-kit';
import { Donut } from './donut';
import { Icon, type IconName } from './icon';
import { PaymentMethodIcon } from './payment-method-icon';
import { ProgressBar } from './progress-bar';
import { RollingNumber } from './rolling-number';

/**
 * Detalle de cobros (referencia: analíticas de Revolut). Arriba, un donut con lo cobrado al centro
 * y un tramo por medio de pago; tocar un medio lo resalta y muestra su monto en el centro. Debajo,
 * el aviso de pendientes, métricas y cada medio y cada origen en su propia card.
 */
export function SalesDetail({ data, rangeNote }: { data: DashboardData; rangeNote: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { summary, insights } = data;
  const { cash_pending, customers, revenue_split } = insights;
  const ramp = colors.chart.ramp;
  const [active, setActive] = useState<number | null>(null);

  const methods = [...summary.payment_breakdown]
    .filter((m) => m.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
  const total = methods.reduce((a, p) => a + p.revenue, 0);
  const share = (n: number) => (total ? n / total : 0);
  const color = (i: number) => ramp[i % 3];
  const picked = active != null ? methods[active] : null;

  const splitTotal = revenue_split.tickets + revenue_split.products;
  const origin: { label: string; icon: IconName; value: number; color: string }[] = [
    { label: 'Entradas', icon: 'ticket', value: revenue_split.tickets, color: ramp[0] },
    { label: 'Barra y comida', icon: 'bar', value: revenue_split.products, color: ramp[1] },
  ];

  const toggle = (i: number) => {
    Haptics.selectionAsync();
    setActive((cur) => (cur === i ? null : i));
  };

  return (
    <View style={styles.wrap}>
      {/* Donut con el total (o el medio elegido) al centro. */}
      <Animated.View entering={enter(0)} style={styles.hero}>
        <Donut
          segments={methods.map((m, i) => ({ value: m.revenue, color: color(i) }))}
          active={active}>
          <Animated.View key={picked?.key ?? 'total'} entering={FadeIn.duration(200)}>
            <Text style={styles.centerCaption} numberOfLines={1}>
              {picked ? PAYMENT_LABEL[picked.key] : 'Cobrado'}
            </Text>
          </Animated.View>
          <RollingNumber
            value={picked ? picked.revenue : total}
            format={formatMoney}
            style={styles.centerValue}
          />
          <Text style={styles.centerMeta}>
            {picked
              ? `${formatPercent(share(picked.revenue))} · ${formatInt(picked.count)} ${
                  picked.count === 1 ? 'pedido' : 'pedidos'
                }`
              : `${formatInt(summary.order_count)} ${summary.order_count === 1 ? 'pedido' : 'pedidos'}`}
          </Text>
        </Donut>
        {total === 0 ? <Text style={styles.empty}>Todavía no hay cobros en este período</Text> : null}
      </Animated.View>

      {cash_pending.orders > 0 ? (
        <Animated.View entering={enter(1)} style={styles.callout} accessibilityRole="summary">
          <View style={styles.calloutIcon}>
            <Icon name="clock" size={15} color={colors.onBrand} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.calloutTitle}>{formatMoney(cash_pending.amount)} por cobrar</Text>
            <Text style={styles.calloutText}>
              {cash_pending.orders} {cash_pending.orders === 1 ? 'pedido' : 'pedidos'} en efectivo o
              transferencia sin confirmar
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(2)} style={styles.stats}>
        {[
          { label: 'Ticket promedio', value: formatMoneyCompact(summary.avg_ticket) },
          { label: 'Compradores', value: formatInt(customers.unique) },
          { label: 'Ítems/pedido', value: formatDecimal(customers.avg_items_per_order) },
        ].map((s) => (
          <View key={s.label} style={[styles.card, styles.stat]}>
            <Text style={styles.statLabel} numberOfLines={1}>
              {s.label}
            </Text>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {s.value}
            </Text>
          </View>
        ))}
      </Animated.View>

      {methods.length > 0 ? (
        <Animated.View entering={enter(3)} style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Por medio de pago</Text>
            {methods.length > 1 ? (
              <Text style={styles.sectionMeta}>Tocá uno para resaltarlo</Text>
            ) : null}
          </View>
          {methods.map((m, i) => {
            const on = active === i;
            return (
              <Animated.View key={m.key} entering={enterRow(i)}>
                <Pressable
                  onPress={() => toggle(i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${PAYMENT_LABEL[m.key]}: ${formatMoney(m.revenue)}, ${formatPercent(
                    share(m.revenue),
                  )}, ${m.count} pedidos`}
                  style={({ pressed }) => [
                    styles.card,
                    styles.method,
                    on && { borderColor: color(i), borderWidth: 1.5 },
                    active != null && !on && styles.dimmed,
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.methodIcon, { borderColor: color(i) }]}>
                    <PaymentMethodIcon method={m.key} size={16} />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.methodName} numberOfLines={1}>
                      {PAYMENT_LABEL[m.key]}
                    </Text>
                    <Text style={styles.methodMeta} numberOfLines={1}>
                      {formatInt(m.count)} {m.count === 1 ? 'pedido' : 'pedidos'}
                      {m.count ? ` · ${formatMoneyCompact(m.revenue / m.count)} c/u` : ''}
                    </Text>
                  </View>
                  <View style={styles.methodRight}>
                    <Text style={styles.methodAmount}>{formatMoney(m.revenue)}</Text>
                    <Text style={styles.methodMeta}>{formatPercent(share(m.revenue))}</Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.View>
      ) : null}

      {/* Solo tiene sentido si vende entradas y barra (si una parte es cero, no hay reparto). */}
      {revenue_split.tickets > 0 && revenue_split.products > 0 ? (
        <Animated.View entering={enter(4)} style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Origen de la recaudación</Text>
          </View>
          <View style={styles.originRow}>
            {origin.map((o, i) => (
              <View key={o.label} style={[styles.card, styles.origin]}>
                <View style={styles.originHead}>
                  <View style={[styles.originIcon, { borderColor: o.color }]}>
                    <Icon name={o.icon} size={14} color={colors.text} />
                  </View>
                  <Text style={styles.originPct}>{formatPercent(o.value / splitTotal)}</Text>
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={styles.methodMeta} numberOfLines={1}>
                    {o.label}
                  </Text>
                  <Text style={styles.originValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMoney(o.value)}
                  </Text>
                </View>
                <ProgressBar
                  height={4}
                  total={splitTotal}
                  delay={320 + i * 80}
                  segments={[{ value: o.value, color: o.color }]}
                />
              </View>
            ))}
          </View>
        </Animated.View>
      ) : null}

      <DetailNote>Medios de pago de {rangeNote}.</DetailNote>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: 28 },
    grow: { flex: 1, gap: 2 },
    hero: { alignItems: 'center', gap: 12, paddingTop: Spacing.two },
    centerCaption: { color: c.textSecondary, fontSize: 13, fontWeight: '500', maxWidth: 170 },
    centerValue: {
      color: c.text,
      fontSize: 28,
      lineHeight: 34,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.8,
    },
    centerMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    empty: { color: c.textSecondary, fontSize: 13 },

    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    pressed: { opacity: 0.75 },
    dimmed: { opacity: 0.55 },

    callout: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      marginTop: -8,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.brandMuted,
    },
    calloutIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brand,
    },
    calloutTitle: {
      color: c.brandText,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
      fontVariant: ['tabular-nums'],
    },
    calloutText: { color: c.brandText, fontSize: 12, opacity: 0.85 },

    stats: { flexDirection: 'row', gap: 8 },
    stat: { flex: 1, gap: 4, paddingVertical: 12, paddingHorizontal: 12 },
    statLabel: { color: c.textSecondary, fontSize: 11 },
    statValue: { color: c.text, fontSize: 18, fontFamily: DisplayFont.bold, letterSpacing: -0.4 },

    section: { gap: 8 },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 2,
    },
    sectionTitle: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold },
    sectionMeta: { color: c.textMuted, fontSize: 12 },

    method: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    methodIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    methodName: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    methodMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    methodRight: { alignItems: 'flex-end', gap: 2 },
    methodAmount: { color: c.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },

    originRow: { flexDirection: 'row', gap: 8 },
    origin: { flex: 1, gap: 12, padding: 14 },
    originHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    originIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    originPct: { color: c.textSecondary, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
    originValue: { color: c.text, fontSize: 17, fontFamily: DisplayFont.bold, letterSpacing: -0.3 },
  }),
);
