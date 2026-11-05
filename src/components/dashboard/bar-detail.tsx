import { StyleSheet, Text, View } from 'react-native';

import {
  formatInt,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
} from '@/features/dashboard/format';
import type { DashboardData } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import {
  // Badge, // Puntos de retiro deshabilitado por ahora (solo lo usaba esa sección).
  Breakdown,
  DetailHero,
  DetailNote,
  DetailSection,
  ListRow,
  StatsRow,
  useRowStyles,
} from './detail-kit';
import { ProgressBar } from './progress-bar';

/**
 * Detalle de barra: recaudación protagonista, entregas vs. pendientes en una barra con desglose,
 * métricas en fila, rendimiento por punto de retiro y ranking de productos.
 */
export function BarDetail({ data, rangeNote }: { data: DashboardData; rangeNote: string }) {
  const { colors } = useTheme();
  const row = useRowStyles();
  const styles = useStyles();
  const [STRONG, MID] = colors.chart.ramp;
  const { insights, summary } = data;
  const { products, pickup_points, revenue_split, event } = insights;
  const live = event.phase === 'live';

  const pending = live ? products.units_pending : 0;
  const delivered = Math.min(products.units_delivered, products.units_sold);
  const orders = pickup_points.reduce((a, p) => a + p.orders, 0);
  const avgOrder = orders ? products.revenue / orders : 0;
  const totalSplit = revenue_split.tickets + revenue_split.products;
  const share = totalSplit ? revenue_split.products / totalSplit : null;

  // const maxPoint = Math.max(1, ...pickup_points.map((p) => p.revenue)); // Puntos de retiro deshabilitado por ahora
  const ranking = summary.top_products.filter((r) => !r.name.startsWith('Entrada')).slice(0, 6);
  const maxQty = Math.max(1, ...ranking.map((r) => r.quantity));

  return (
    <View style={styles.wrap}>
      <DetailHero
        caption="Recaudado en barra"
        value={products.revenue}
        format={formatMoney}
        meta={`${formatInt(products.units_sold)} ítems vendidos${
          products.units_sold ? ` · ${formatPercent(delivered / products.units_sold)} entregado` : ''
        }`}>
        {products.units_sold > 0 ? (
          <>
            <ProgressBar
              height={10}
              total={products.units_sold}
              delay={160}
              segments={[
                { value: delivered, color: STRONG },
                ...(pending > 0 ? [{ value: pending, color: colors.brand }] : []),
              ]}
            />
            <Breakdown
              items={[
                { color: STRONG, label: 'Entregados', value: delivered },
                ...(live
                  ? [
                      {
                        color: pending > 0 ? colors.brand : colors.raised,
                        label: 'Por retirar',
                        value: pending,
                        tone: pending > 0 ? ('attention' as const) : undefined,
                      },
                    ]
                  : []),
              ]}
            />
          </>
        ) : null}
      </DetailHero>

      <StatsRow
        stats={[
          { label: 'Pedidos', value: formatInt(orders) },
          { label: 'Ticket promedio', value: formatMoneyCompact(avgOrder) },
          { label: 'Del total', value: share != null ? formatPercent(share) : '—' },
        ]}
      />

      {/* Puntos de retiro deshabilitado por ahora.
      {pickup_points.length > 0 ? (
        <DetailSection
          title="Puntos de retiro"
          meta={`${pickup_points.length} ${pickup_points.length === 1 ? 'punto' : 'puntos'}`}
          index={2}>
          {pickup_points.map((p, i) => (
            <ListRow key={p.id} index={i}>
              <View style={row.top}>
                <Text style={row.name} numberOfLines={1}>
                  {p.name}
                </Text>
                {live && p.pending_orders > 0 ? (
                  <Badge tone="attention" label={`${p.pending_orders} en cola`} />
                ) : null}
                {!p.is_active ? <Badge label="Cerrado" /> : null}
                <Text style={row.value}>{formatMoney(p.revenue)}</Text>
              </View>
              <ProgressBar
                height={4}
                total={maxPoint}
                delay={260 + i * 80}
                segments={[{ value: p.revenue, color: STRONG }]}
              />
              <View style={row.bottom}>
                <Text style={row.meta}>{formatInt(p.orders)} pedidos</Text>
                <Text style={row.meta}>
                  {products.revenue ? formatPercent(p.revenue / products.revenue) : '—'} de la barra
                </Text>
              </View>
            </ListRow>
          ))}
        </DetailSection>
      ) : null}
      */}

      {ranking.length > 0 ? (
        <DetailSection title="Lo más pedido" meta="por unidades" index={3}>
          {ranking.map((r, i) => (
            <ListRow key={r.name} index={i}>
              <View style={row.top}>
                <View style={[styles.rank, i === 0 && styles.rankFirst]}>
                  <Text style={[styles.rankText, i === 0 && styles.rankTextFirst]}>{i + 1}</Text>
                </View>
                <Text style={[row.name, { flex: 1 }]} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={row.value}>{formatMoney(r.revenue)}</Text>
              </View>
              <View style={styles.indent}>
                <ProgressBar
                  height={4}
                  total={maxQty}
                  delay={260 + i * 70}
                  segments={[{ value: r.quantity, color: i === 0 ? STRONG : MID }]}
                />
                <Text style={row.meta}>{formatInt(r.quantity)} unidades</Text>
              </View>
            </ListRow>
          ))}
        </DetailSection>
      ) : null}

      <DetailNote>Ranking de {rangeNote}.</DetailNote>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: 32 },
    rank: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    rankFirst: { backgroundColor: c.text },
    rankText: { color: c.textSecondary, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
    rankTextFirst: { color: c.surface },
    indent: { paddingLeft: 30, gap: 6 },
  }),
);
