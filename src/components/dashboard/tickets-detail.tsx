import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  formatInt,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
} from '@/features/dashboard/format';
import type { DashboardInsights } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { enter, enterRow, HeroFacts } from './detail-kit';
import { Icon } from './icon';
import { ProgressBar } from './progress-bar';
import { Rings } from './ring';
import { RollingNumber } from './rolling-number';

const RING = 220;
const STROKE = 16;
const RING_GAP = 6;

/**
 * Detalle de entradas (mismo lenguaje que Cobros): anillos concéntricos con la cifra protagonista
 * al centro (aforo vendido afuera; asistencia adentro cuando hay ingresos), el desglose y las
 * métricas en cards, y cada tipo de entrada en su propia card.
 */
export function TicketsDetail({ insights }: { insights: DashboardInsights }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [IN, SOLD] = colors.chart.ramp;
  const { tickets, event } = insights;
  const live = event.phase === 'live';
  const showCheckin = event.phase === 'live' || event.phase === 'ended';

  const pendingIn = Math.max(0, tickets.sold - tickets.checked_in);
  const available = tickets.capacity != null ? Math.max(0, tickets.capacity - tickets.sold) : null;
  const paidSold = tickets.types.filter((t) => t.price > 0).reduce((a, t) => a + t.sold, 0);
  const avgPrice = paidSold ? tickets.revenue / paidSold : 0;
  const attendance = tickets.sold ? tickets.checked_in / tickets.sold : 0;
  const soldRatio = tickets.capacity ? tickets.sold / tickets.capacity : null;

  const rings = [
    { ratio: soldRatio ?? (tickets.sold ? 1 : 0), color: SOLD },
    ...(showCheckin ? [{ ratio: attendance, color: IN }] : []),
  ];

  // Desglose: cada parte en su card con su color (el mismo del anillo).
  const parts = [
    ...(showCheckin
      ? [
          { color: IN, label: 'Ingresaron', value: tickets.checked_in },
          { color: SOLD, label: 'Sin ingresar', value: pendingIn },
        ]
      : [{ color: SOLD, label: 'Vendidas', value: tickets.sold }]),
    ...(available != null ? [{ color: colors.borderStrong, label: 'Disponibles', value: available }] : []),
  ];

  const stats = [
    { label: 'Recaudado', value: formatMoneyCompact(tickets.revenue) },
    { label: 'Precio promedio', value: formatMoneyCompact(avgPrice) },
    showCheckin
      ? { label: 'Asistencia', value: formatPercent(attendance) }
      : { label: 'Aforo vendido', value: soldRatio != null ? formatPercent(soldRatio) : '—' },
  ];

  return (
    <View style={styles.wrap}>
      {/* En vivo importa quién está adentro; antes y después, cuánto se vendió. */}
      <Animated.View entering={enter(0)} style={styles.hero}>
        <View style={{ width: RING, height: RING }}>
          <Rings
            rings={rings}
            size={RING}
            stroke={STROKE}
            gap={RING_GAP}
            ticks={soldRatio != null ? [0.25, 0.5, 0.75] : undefined}
          />
          <View style={styles.center} pointerEvents="none">
            <Text style={styles.centerCaption}>{live ? 'Adentro ahora' : 'Vendidas'}</Text>
            <RollingNumber
              value={live ? tickets.checked_in : tickets.sold}
              format={formatInt}
              style={styles.centerValue}
            />
            <Text style={styles.centerMeta}>
              {live
                ? `de ${formatInt(tickets.sold)} vendidas`
                : tickets.capacity != null
                  ? `de ${formatInt(tickets.capacity)} de aforo`
                  : 'sin tope de aforo'}
            </Text>
          </View>
        </View>
        {live && pendingIn > 0 ? (
          <Text style={styles.heroNote}>
            Faltan ingresar <Text style={styles.heroNoteStrong}>{formatInt(pendingIn)}</Text>
          </Text>
        ) : null}
        <HeroFacts facts={stats} />
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.row}>
        {parts.map((p) => (
          <View key={p.label} style={[styles.card, styles.part]}>
            <View style={styles.partHead}>
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <Text style={styles.label} numberOfLines={1}>
                {p.label}
              </Text>
            </View>
            <Text style={styles.partValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatInt(p.value)}
            </Text>
          </View>
        ))}
      </Animated.View>


      {tickets.types.length > 0 ? (
        <Animated.View entering={enter(3)} style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Por tipo de entrada</Text>
            <Text style={styles.sectionMeta}>
              {tickets.types.length} {tickets.types.length === 1 ? 'tipo' : 'tipos'}
            </Text>
          </View>

          {tickets.types.map((t, i) => {
            const soldOut = t.capacity != null && t.sold >= t.capacity;
            const free = t.price === 0;
            const paused = !t.is_active && !soldOut;
            const segments = showCheckin
              ? [
                  { value: t.checked_in, color: IN },
                  { value: Math.max(0, t.sold - t.checked_in), color: SOLD },
                ]
              : [{ value: t.sold, color: SOLD }];
            return (
              <Animated.View
                key={t.id}
                entering={enterRow(i)}
                style={[styles.card, styles.type, paused && styles.paused]}>
                <View style={styles.typeHead}>
                  <View style={styles.typeIcon}>
                    <Icon name="ticket" size={16} color={colors.text} />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.typeName} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {free ? 'Sin cargo' : `${formatMoney(t.price)} c/u`}
                    </Text>
                  </View>
                  {soldOut ? (
                    <Tag label="Agotado" strong />
                  ) : free ? (
                    <Tag label="Gratis" />
                  ) : paused ? (
                    <Tag label="Pausado" />
                  ) : null}
                </View>

                <View style={styles.typeNumbers}>
                  <Text style={styles.typeValue}>
                    {formatInt(t.sold)}
                    <Text style={styles.typeOf}>
                      {t.capacity != null ? ` / ${formatInt(t.capacity)}` : ' vendidas'}
                    </Text>
                  </Text>
                  {!free ? (
                    <Text style={styles.typeRevenue}>{formatMoneyCompact(t.revenue)}</Text>
                  ) : null}
                </View>

                <ProgressBar
                  height={6}
                  total={t.capacity ?? Math.max(1, t.sold)}
                  delay={260 + i * 80}
                  segments={segments}
                />

                <View style={styles.typeFoot}>
                  {showCheckin ? (
                    <View style={styles.partHead}>
                      <View style={[styles.dot, { backgroundColor: IN }]} />
                      <Text style={styles.meta}>
                        {formatInt(t.checked_in)} ingresaron
                        {t.sold ? ` · ${formatPercent(t.checked_in / t.sold)}` : ''}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.meta}>
                      {t.capacity
                        ? `${formatPercent(t.sold / t.capacity)} vendido`
                        : 'Sin tope de cupo'}
                    </Text>
                  )}
                  {t.capacity != null && !soldOut ? (
                    <Text style={styles.meta}>
                      {formatInt(Math.max(0, t.capacity - t.sold))} disponibles
                    </Text>
                  ) : null}
                </View>
              </Animated.View>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Tag({ label, strong }: { label: string; strong?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.tag, strong && styles.tagStrong]}>
      <Text style={[styles.tagText, strong && styles.tagTextStrong]}>{label}</Text>
    </View>
  );
}

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

    hero: { alignItems: 'center', gap: 12, paddingTop: Spacing.two },
    center: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerCaption: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    centerValue: {
      color: c.text,
      fontSize: 34,
      lineHeight: 40,
      fontFamily: DisplayFont.bold,
      letterSpacing: -1,
    },
    centerMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    heroNote: { color: c.textSecondary, fontSize: 13 },
    heroNoteStrong: { color: c.text, fontWeight: '700', fontVariant: ['tabular-nums'] },

    row: { flexDirection: 'row', gap: 8 },
    part: { flex: 1, gap: 6, padding: 12 },
    partHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
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

    type: { padding: 14, gap: 12 },
    paused: { opacity: 0.6 },
    typeHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    typeIcon: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    typeName: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    typeNumbers: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    typeValue: {
      color: c.text,
      fontSize: 22,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    typeOf: { color: c.textMuted, fontSize: 14, fontFamily: DisplayFont.semibold, letterSpacing: 0 },
    typeRevenue: { color: c.textSecondary, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
    typeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    meta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },

    tag: {
      paddingHorizontal: 8,
      height: 22,
      borderRadius: Radius.pill,
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    tagStrong: { backgroundColor: c.ink },
    tagText: { color: c.textSecondary, fontSize: 11, fontWeight: '700' },
    tagTextStrong: { color: c.onInk },
  }),
);
