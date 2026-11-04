import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

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

import {
  Breakdown,
  DetailHero,
  DetailNote,
  DetailSection,
  enter,
  ListRow,
  StatsRow,
  useRowStyles,
} from './detail-kit';
import { Icon } from './icon';
import { ProgressBar } from './progress-bar';

/**
 * Detalle de cobros: lo cobrado como cifra protagonista con su reparto por medio de pago,
 * un aviso lima si hay cobros pendientes, métricas en fila, cada medio y el origen de la recaudación.
 */
export function SalesDetail({ data, rangeNote }: { data: DashboardData; rangeNote: string }) {
  const { colors } = useTheme();
  const row = useRowStyles();
  const styles = useStyles();
  const { summary, insights } = data;
  const { cash_pending, customers, revenue_split } = insights;
  const ramp = colors.chart.ramp;

  const methods = [...summary.payment_breakdown].sort((a, b) => b.revenue - a.revenue);
  const total = methods.reduce((a, p) => a + p.revenue, 0);
  const share = (n: number) => (total ? n / total : 0);

  const splitTotal = revenue_split.tickets + revenue_split.products;
  const origin = [
    { label: 'Entradas', value: revenue_split.tickets, color: ramp[0] },
    { label: 'Barra y comida', value: revenue_split.products, color: ramp[1] },
  ];

  return (
    <View style={styles.wrap}>
      <DetailHero
        caption="Cobrado"
        value={total}
        format={formatMoney}
        meta={`${formatInt(summary.order_count)} pedidos · ${formatMoney(summary.avg_ticket)} promedio`}>
        {total > 0 ? (
          <>
            <ProgressBar
              height={10}
              total={total}
              delay={160}
              segments={methods.map((m, i) => ({ value: m.revenue, color: ramp[i % 3] }))}
            />
            <Breakdown
              items={methods.map((m, i) => ({
                color: ramp[i % 3],
                label: `${PAYMENT_LABEL[m.key]} · ${formatPercent(share(m.revenue))}`,
                value: m.revenue,
                format: formatMoney,
              }))}
            />
          </>
        ) : null}
      </DetailHero>

      {cash_pending.orders > 0 ? (
        <Animated.View entering={enter(1)} style={styles.callout} accessibilityRole="summary">
          <View style={styles.calloutIcon}>
            <Icon name="cash" size={16} color={colors.brandText} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.calloutTitle}>
              {formatMoney(cash_pending.amount)} por cobrar
            </Text>
            <Text style={styles.calloutText}>
              {cash_pending.orders} {cash_pending.orders === 1 ? 'pedido' : 'pedidos'} en efectivo o
              transferencia sin confirmar
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <StatsRow
        index={2}
        stats={[
          { label: 'Ticket promedio', value: formatMoneyCompact(summary.avg_ticket) },
          { label: 'Compradores', value: formatInt(customers.unique) },
          { label: 'Ítems/pedido', value: formatDecimal(customers.avg_items_per_order) },
        ]}
      />

      {methods.length > 0 ? (
        <DetailSection title="Medios de pago" meta={`${methods.length} medios`} index={3}>
          {methods.map((m, i) => (
            <ListRow key={m.key} index={i}>
              <View style={row.top}>
                <View style={[styles.swatch, { backgroundColor: ramp[i % 3] }]} />
                <Text style={row.name} numberOfLines={1}>
                  {PAYMENT_LABEL[m.key]}
                </Text>
                <Text style={row.value}>{formatMoney(m.revenue)}</Text>
              </View>
              <ProgressBar
                height={4}
                total={Math.max(1, total)}
                delay={260 + i * 80}
                segments={[{ value: m.revenue, color: ramp[i % 3] }]}
              />
              <View style={row.bottom}>
                <Text style={row.meta}>
                  {formatInt(m.count)} pedidos
                  {m.count ? ` · ${formatMoneyCompact(m.revenue / m.count)} c/u` : ''}
                </Text>
                <Text style={row.meta}>{formatPercent(share(m.revenue))}</Text>
              </View>
            </ListRow>
          ))}
        </DetailSection>
      ) : null}

      {/* Solo tiene sentido si vende entradas y barra (si una parte es cero, no hay reparto). */}
      {revenue_split.tickets > 0 && revenue_split.products > 0 ? (
        <DetailSection title="Origen de la recaudación" index={4}>
          <View style={styles.origin}>
            <ProgressBar
              height={10}
              total={splitTotal}
              delay={320}
              segments={origin.map((o) => ({ value: o.value, color: o.color }))}
            />
            <Breakdown
              items={origin.map((o) => ({
                color: o.color,
                label: `${o.label} · ${formatPercent(o.value / splitTotal)}`,
                value: o.value,
                format: formatMoney,
              }))}
            />
          </View>
        </DetailSection>
      ) : null}

      <DetailNote>Medios de pago de {rangeNote}.</DetailNote>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: 32 },
    swatch: { width: 8, height: 8, borderRadius: 2.5 },
    origin: { gap: 6, paddingTop: Spacing.three, paddingBottom: 4 },
    callout: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: Spacing.three,
      marginTop: -12,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.brandMuted,
    },
    calloutIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    calloutTitle: {
      color: c.brandText,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
      fontVariant: ['tabular-nums'],
    },
    calloutText: { color: c.brandText, fontSize: 12, opacity: 0.85 },
  }),
);
