import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  formatInt,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
} from '@/features/dashboard/format';
import type { DashboardData } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { DetailNote, enter, enterRow, HeroFacts } from './detail-kit';
import { Donut } from './donut';
import { Icon } from './icon';
import { ProgressBar } from './progress-bar';
import { RollingNumber } from './rolling-number';

/**
 * Detalle de barra (mismo lenguaje que Cobros y Entradas): donut de entregas con lo recaudado al
 * centro, entregados / por retirar y métricas en cards, el producto estrella destacado y el resto
 * del ranking, cada uno en su card. (Puntos de retiro deshabilitado por ahora.)
 */
export function BarDetail({ data, rangeNote }: { data: DashboardData; rangeNote: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [STRONG, MID] = colors.chart.ramp;
  const { insights, summary } = data;
  const { products, pickup_points, revenue_split, event } = insights;
  const live = event.phase === 'live';

  const pending = live ? products.units_pending : 0;
  const delivered = Math.min(products.units_delivered, products.units_sold);
  const rest = Math.max(0, products.units_sold - delivered - pending);
  const orders = pickup_points.reduce((a, p) => a + p.orders, 0);
  const avgOrder = orders ? products.revenue / orders : 0;
  const totalSplit = revenue_split.tickets + revenue_split.products;
  const share = totalSplit ? revenue_split.products / totalSplit : null;

  const ranking = summary.top_products.filter((r) => !r.name.startsWith('Entrada')).slice(0, 6);
  const maxQty = Math.max(1, ...ranking.map((r) => r.quantity));
  const [star, ...others] = ranking;

  const parts = [
    { color: STRONG, label: 'Entregados', value: delivered },
    ...(live ? [{ color: colors.brand, label: 'Por retirar', value: pending, attention: pending > 0 }] : []),
  ];

  const stats = [
    { label: 'Pedidos', value: formatInt(orders) },
    { label: 'Ticket promedio', value: formatMoneyCompact(avgOrder) },
    { label: 'Del total', value: share != null ? formatPercent(share) : '—' },
  ];

  return (
    <View style={styles.wrap}>
      <Animated.View entering={enter(0)} style={styles.hero}>
        <Donut
          segments={[
            { value: delivered, color: STRONG },
            { value: pending, color: colors.brand },
            { value: rest, color: colors.borderStrong },
          ]}>
          <Text style={styles.centerCaption}>Recaudado</Text>
          <RollingNumber value={products.revenue} format={formatMoney} style={styles.centerValue} />
          <Text style={styles.centerMeta}>
            {formatInt(products.units_sold)} {products.units_sold === 1 ? 'ítem' : 'ítems'}
            {products.units_sold ? ` · ${formatPercent(delivered / products.units_sold)} entregado` : ''}
          </Text>
        </Donut>
        {products.units_sold === 0 ? (
          <Text style={styles.empty}>Todavía no se vendió nada en la barra</Text>
        ) : (
          <HeroFacts facts={stats} />
        )}
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.row}>
        {parts.map((p) => (
          <View
            key={p.label}
            style={[styles.card, styles.part, p.attention && styles.partAttention]}>
            <View style={styles.partHead}>
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <Text
                style={[styles.label, p.attention && { color: colors.brandText }]}
                numberOfLines={1}>
                {p.label}
              </Text>
            </View>
            <Text
              style={[styles.partValue, p.attention && { color: colors.brandText }]}
              numberOfLines={1}>
              {formatInt(p.value)}
            </Text>
          </View>
        ))}
      </Animated.View>


      {star ? (
        <Animated.View entering={enter(3)} style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Lo más pedido</Text>
            <Text style={styles.sectionMeta}>por unidades</Text>
          </View>

          {/* El producto estrella, destacado. */}
          <View style={[styles.card, styles.star]}>
            <View style={styles.starHead}>
              <View style={styles.starBadge}>
                <Icon name="bolt" size={12} color={colors.onInk} />
                <Text style={styles.starBadgeText}>N.º 1</Text>
              </View>
              <Text style={styles.meta}>
                {products.units_sold ? formatPercent(star.quantity / products.units_sold) : '—'} de
                los ítems
              </Text>
            </View>
            <Text style={styles.starName} numberOfLines={2}>
              {star.name}
            </Text>
            <View style={styles.starNumbers}>
              <View>
                <Text style={styles.starValue}>{formatInt(star.quantity)}</Text>
                <Text style={styles.meta}>unidades</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.starValue}>{formatMoneyCompact(star.revenue)}</Text>
                <Text style={styles.meta}>recaudado</Text>
              </View>
            </View>
          </View>

          {others.map((r, i) => (
            <Animated.View key={r.name} entering={enterRow(i)} style={[styles.card, styles.item]}>
              <Text style={styles.rank}>{i + 2}</Text>
              <View style={[styles.grow, { gap: 8 }]}>
                <View style={styles.itemHead}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.itemValue}>{formatMoney(r.revenue)}</Text>
                </View>
                <ProgressBar
                  height={4}
                  total={maxQty}
                  delay={260 + i * 70}
                  segments={[{ value: r.quantity, color: MID }]}
                />
                <Text style={styles.meta}>{formatInt(r.quantity)} unidades</Text>
              </View>
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}

      <DetailNote>Ranking de {rangeNote}.</DetailNote>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: 28 },
    grow: { flex: 1 },
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },

    hero: { alignItems: 'center', gap: 12, paddingTop: Spacing.two },
    centerCaption: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    centerValue: {
      color: c.text,
      fontSize: 28,
      lineHeight: 34,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.8,
    },
    centerMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    empty: { color: c.textSecondary, fontSize: 13 },

    row: { flexDirection: 'row', gap: 8 },
    part: { flex: 1, gap: 6, padding: 12 },
    partAttention: { backgroundColor: c.brandMuted, borderColor: 'transparent' },
    partHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 2.5 },
    label: { color: c.textSecondary, fontSize: 11, flexShrink: 1 },
    partValue: { color: c.text, fontSize: 20, fontFamily: DisplayFont.bold, letterSpacing: -0.4 },

    section: { gap: 10 },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    sectionTitle: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold },
    sectionMeta: { color: c.textMuted, fontSize: 12 },
    meta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },

    star: { padding: Spacing.three, gap: 10 },
    starHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    starBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      height: 22,
      borderRadius: Radius.pill,
      backgroundColor: c.ink,
    },
    starBadgeText: { color: c.onInk, fontSize: 11, fontWeight: '700' },
    starName: { color: c.text, fontSize: 20, fontFamily: DisplayFont.bold, letterSpacing: -0.4 },
    starNumbers: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 2,
    },
    starValue: {
      color: c.text,
      fontSize: 22,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },

    item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    rank: {
      width: 18,
      color: c.textMuted,
      fontSize: 14,
      fontFamily: DisplayFont.bold,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    itemName: { flex: 1, color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    itemValue: { color: c.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  }),
);
