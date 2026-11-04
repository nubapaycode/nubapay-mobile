import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { formatInt, formatMoney, formatPercent } from '@/features/dashboard/format';
import type { DashboardInsights } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { AnimatedNumber } from './animated-number';
import { Card } from './card';
import { ProgressBar } from './progress-bar';
import { Rings } from './ring';

/** Aforo (vendidas / capacidad) e ingreso (ingresaron / vendidas). */
export function CapacityOverview({
  insights,
  index = 0,
}: {
  insights: DashboardInsights;
  index?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [SOLD, IN] = colors.chart.series;
  const { tickets, event } = insights;
  const showCheckin = event.phase !== 'upcoming';
  const soldRatio = tickets.capacity ? tickets.sold / tickets.capacity : 0;
  const inRatio = tickets.sold ? tickets.checked_in / tickets.sold : 0;

  return (
    <Card index={index}>
      <View style={styles.top}>
        <View style={styles.ringWrap}>
          <Rings
            rings={
              showCheckin
                ? [
                    { ratio: soldRatio, color: SOLD },
                    { ratio: inRatio, color: IN },
                  ]
                : [{ ratio: soldRatio, color: SOLD }]
            }
          />
          <View style={styles.ringCenter} pointerEvents="none">
            <AnimatedNumber
              value={soldRatio * 100}
              format={(n) => `${Math.round(n)}%`}
              style={styles.ringValue}
            />
            <Text style={styles.ringLabel}>{tickets.capacity ? 'vendido' : 'sin tope'}</Text>
          </View>
        </View>
        <View style={styles.legend}>
          <LegendRow
            color={SOLD}
            label="Vendidas"
            value={
              tickets.capacity
                ? `${formatInt(tickets.sold)} / ${formatInt(tickets.capacity)}`
                : formatInt(tickets.sold)
            }
          />
          {showCheckin ? (
            <LegendRow
              color={IN}
              label="Ingresaron"
              value={`${formatInt(tickets.checked_in)} · ${formatPercent(inRatio)}`}
            />
          ) : null}
          <Text style={styles.note}>
            {event.phase === 'live'
              ? `Faltan ingresar ${formatInt(tickets.sold - tickets.checked_in)}`
              : tickets.capacity
                ? `Quedan ${formatInt(Math.max(0, tickets.capacity - tickets.sold))} disponibles`
                : `${formatMoney(tickets.revenue)} en entradas`}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/** Una fila por tipo de entrada: ingresaron + vendidas sobre la capacidad. */
export function TicketTypesCard({
  insights,
  index = 0,
}: {
  insights: DashboardInsights;
  index?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [SOLD, IN] = colors.chart.series;
  const showCheckin = insights.event.phase !== 'upcoming';
  return (
    <Card title="Por tipo de entrada" index={index}>
      <View style={{ gap: 16 }}>
        {insights.tickets.types.map((t, i) => {
          const soldOut = t.capacity != null && t.sold >= t.capacity;
          return (
            <View key={t.id} style={{ gap: 7 }}>
              <View style={styles.typeHead}>
                <Text style={styles.typeName} numberOfLines={1}>
                  {t.name}
                </Text>
                {soldOut ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Agotado</Text>
                  </View>
                ) : null}
                <Text style={styles.typeCount}>
                  {formatInt(t.sold)}
                  <Text style={styles.typeMuted}>
                    {t.capacity != null ? ` / ${formatInt(t.capacity)}` : ''}
                  </Text>
                </Text>
              </View>
              <ProgressBar
                total={t.capacity ?? Math.max(t.sold, 1)}
                delay={200 + i * 90}
                segments={
                  showCheckin
                    ? [
                        { value: t.checked_in, color: IN },
                        { value: Math.max(0, t.sold - t.checked_in), color: SOLD },
                      ]
                    : [{ value: t.sold, color: SOLD }]
                }
              />
              <Text style={styles.typeMeta}>
                {formatMoney(t.revenue)}
                {showCheckin ? ` · ${formatInt(t.checked_in)} ingresaron` : ''}
              </Text>
            </View>
          );
        })}
      </View>
      {showCheckin ? (
        <View style={styles.legendInline}>
          <View style={[styles.swatch, { backgroundColor: IN }]} />
          <Text style={styles.legendText}>Ingresaron</Text>
          <View style={[styles.swatch, { backgroundColor: SOLD, marginLeft: 10 }]} />
          <Text style={styles.legendText}>Vendidas sin ingresar</Text>
        </View>
      ) : null}
    </Card>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.legendHead}>
        <View style={[styles.swatch, { backgroundColor: color }]} />
        <Text style={styles.legendLabel}>{label}</Text>
      </View>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    ringWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
    ringCenter: { position: 'absolute', alignItems: 'center' },
    ringValue: { color: c.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
    ringLabel: { color: c.textMuted, fontSize: 11, marginTop: -2 },
    legend: { flex: 1, gap: 10 },
    legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 8, height: 8, borderRadius: 2 },
    legendLabel: { color: c.textSecondary, fontSize: 12 },
    legendValue: { color: c.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
    note: { color: c.textSecondary, fontSize: 12 },
    typeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    typeName: { color: c.text, fontSize: 15, fontWeight: '500', flexShrink: 1 },
    typeCount: {
      marginLeft: 'auto',
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    typeMuted: { color: c.textMuted, fontWeight: '400' },
    typeMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    badge: {
      paddingHorizontal: 6,
      height: 18,
      justifyContent: 'center',
      borderRadius: Radius.sm,
      backgroundColor: c.raised,
    },
    badgeText: { color: c.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
    legendInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { color: c.textMuted, fontSize: 11 },
  }),
);
