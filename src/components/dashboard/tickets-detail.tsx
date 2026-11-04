import { Text, View } from 'react-native';

import {
  formatInt,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
} from '@/features/dashboard/format';
import type { DashboardInsights } from '@/features/dashboard/types';
import { useTheme } from '@/theme';

import {
  Badge,
  Breakdown,
  DetailHero,
  DetailSection,
  Legend,
  ListRow,
  StatsRow,
  useRowStyles,
} from './detail-kit';
import { ProgressBar } from './progress-bar';

/**
 * Detalle de entradas: una cifra protagonista, el aforo como una sola barra con su desglose
 * clave–valor, métricas en fila y la lista por tipo.
 */
export function TicketsDetail({ insights }: { insights: DashboardInsights }) {
  const { colors } = useTheme();
  const row = useRowStyles();
  const [IN, SOLD] = colors.chart.ramp;
  const { tickets, event } = insights;
  const live = event.phase === 'live';
  const showCheckin = event.phase === 'live' || event.phase === 'ended';

  const pendingIn = Math.max(0, tickets.sold - tickets.checked_in);
  const available = tickets.capacity != null ? Math.max(0, tickets.capacity - tickets.sold) : null;
  const paidSold = tickets.types.filter((t) => t.price > 0).reduce((a, t) => a + t.sold, 0);
  const avgPrice = paidSold ? tickets.revenue / paidSold : 0;
  const attendance = tickets.sold ? tickets.checked_in / tickets.sold : 0;

  const split = (checkedIn: number, sold: number) =>
    showCheckin
      ? [
          { value: checkedIn, color: IN },
          { value: Math.max(0, sold - checkedIn), color: SOLD },
        ]
      : [{ value: sold, color: IN }];

  return (
    <View style={{ gap: 32 }}>
      {/* En vivo importa quién está adentro; antes y después, cuánto se vendió. */}
      <DetailHero
        caption={live ? 'Adentro ahora' : 'Entradas vendidas'}
        value={live ? tickets.checked_in : tickets.sold}
        format={formatInt}
        suffix={
          live
            ? `/ ${formatInt(tickets.sold)} vendidas`
            : tickets.capacity != null
              ? `/ ${formatInt(tickets.capacity)} de aforo`
              : undefined
        }
        meta={
          live
            ? `Faltan ingresar ${formatInt(pendingIn)} · ${formatPercent(attendance)} de asistencia`
            : tickets.capacity
              ? `${formatPercent(tickets.sold / tickets.capacity)} del aforo vendido`
              : 'Sin tope de aforo'
        }>
        <ProgressBar
          height={10}
          total={tickets.capacity ?? Math.max(1, tickets.sold)}
          delay={160}
          segments={split(tickets.checked_in, tickets.sold)}
        />
        <Breakdown
          items={[
            ...(showCheckin
              ? [
                  { color: IN, label: 'Ingresaron', value: tickets.checked_in },
                  { color: SOLD, label: 'Vendidas sin ingresar', value: pendingIn },
                ]
              : [{ color: IN, label: 'Vendidas', value: tickets.sold }]),
            ...(available != null
              ? [{ color: colors.raised, label: 'Disponibles', value: available }]
              : []),
          ]}
        />
      </DetailHero>

      <StatsRow
        stats={[
          { label: 'Recaudado', value: formatMoneyCompact(tickets.revenue) },
          { label: 'Precio promedio', value: formatMoneyCompact(avgPrice) },
          showCheckin
            ? { label: 'Asistencia', value: formatPercent(attendance) }
            : { label: 'Disponibles', value: available != null ? formatInt(available) : '—' },
        ]}
      />

      {tickets.types.length > 0 ? (
        <DetailSection
          title="Por tipo de entrada"
          meta={`${tickets.types.length} tipos`}
          index={2}
          footer={
            showCheckin ? (
              <Legend
                items={[
                  { color: IN, label: 'Ingresaron' },
                  { color: SOLD, label: 'Sin ingresar' },
                ]}
              />
            ) : null
          }>
          {tickets.types.map((t, i) => {
            const soldOut = t.capacity != null && t.sold >= t.capacity;
            const free = t.price === 0;
            return (
              <ListRow key={t.id} index={i}>
                <View style={row.top}>
                  <Text style={row.name} numberOfLines={1}>
                    {t.name}
                  </Text>
                  {soldOut ? <Badge label="Agotado" tone="strong" /> : null}
                  {free ? <Badge label="Gratis" /> : null}
                  {!t.is_active && !soldOut ? <Badge label="Pausado" /> : null}
                  <Text style={row.value}>
                    {formatInt(t.sold)}
                    <Text style={row.valueMuted}>
                      {t.capacity != null ? ` / ${formatInt(t.capacity)}` : ''}
                    </Text>
                  </Text>
                </View>
                <ProgressBar
                  height={4}
                  total={t.capacity ?? Math.max(1, t.sold)}
                  delay={260 + i * 80}
                  segments={split(t.checked_in, t.sold)}
                />
                <View style={row.bottom}>
                  <Text style={row.meta}>
                    {free
                      ? 'Sin cargo'
                      : `${formatMoney(t.price)} · ${formatMoneyCompact(t.revenue)} recaudado`}
                  </Text>
                  <Text style={row.meta}>
                    {showCheckin
                      ? `${formatInt(t.checked_in)} ingresaron`
                      : t.capacity
                        ? `${formatPercent(t.sold / t.capacity)} vendido`
                        : 'sin tope'}
                  </Text>
                </View>
              </ListRow>
            );
          })}
        </DetailSection>
      ) : null}
    </View>
  );
}
