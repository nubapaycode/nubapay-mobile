import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { enter, enterRow, StatsRow } from '@/components/dashboard/detail-kit';
import { ProgressBar } from '@/components/dashboard/progress-bar';
import { AddButton } from '@/components/manage/manage-ui';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  formatInt,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
} from '@/features/dashboard/format';
import { setTicketActive, type TicketType, useTickets } from '@/features/manage/manage';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';

/** Desde este % del cupo se avisa que quedan pocas. */
const ALMOST = 0.9;

/**
 * Entradas (gestión): métricas, aforo total vendido y cada tipo de entrada en su tarjeta con
 * precio, cupo (barra que avisa cuando se está por agotar), recaudado y switch de activo/pausado.
 */
export default function TicketsAdminScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tickets: list, error, eventId } = useTickets();
  useFocusStatusBar('dark');

  const tickets = list ?? [];
  const sold = tickets.reduce((a, t) => a + t.sold, 0);
  const revenue = tickets.reduce((a, t) => a + t.revenue, 0);
  // Aforo total solo si todos los tipos tienen cupo.
  const capacity = tickets.length && tickets.every((t) => t.stock != null)
    ? tickets.reduce((a, t) => a + (t.stock ?? 0), 0)
    : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      {!list ? (
        <Text style={styles.muted}>{error ?? 'Cargando…'}</Text>
      ) : (
        <>
          <StatsRow
            index={0}
            stats={[
              { label: 'Tipos', value: formatInt(tickets.length) },
              { label: 'Vendidas', value: formatInt(sold) },
              { label: 'Recaudado', value: formatMoneyCompact(revenue) },
            ]}
          />

          {capacity ? (
            <Animated.View entering={enter(1)} style={styles.capacity}>
              <View style={styles.capacityHead}>
                <Text style={styles.capacityLabel}>Aforo vendido</Text>
                <Text style={styles.capacityValue}>
                  {formatPercent(sold / capacity)}
                  <Text style={styles.capacityOf}>
                    {'  '}
                    {formatInt(sold)} / {formatInt(capacity)}
                  </Text>
                </Text>
              </View>
              <ProgressBar
                height={8}
                total={capacity}
                delay={160}
                segments={[{ value: sold, color: colors.chart.ramp[0] }]}
              />
            </Animated.View>
          ) : null}

          <Animated.View entering={enter(2)}>
            <AddButton
              label="Agregar tipo de entrada"
              onPress={() => router.push({ pathname: '/manage/new/[kind]', params: { kind: 'ticket' } })}
            />
          </Animated.View>

          {tickets.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Este evento todavía no vende entradas.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {tickets.map((t, i) => (
                <TicketCard key={t.id} ticket={t} index={i} eventId={eventId} />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function TicketCard({
  ticket: t,
  index,
  eventId,
}: {
  ticket: TicketType;
  index: number;
  eventId: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const free = t.price === 0;
  const ratio = t.stock ? t.sold / t.stock : null;
  const soldOut = t.stock != null && t.sold >= t.stock;
  const almost = !soldOut && ratio != null && ratio >= ALMOST;
  const left = t.stock != null ? Math.max(0, t.stock - t.sold) : null;
  const barColor = soldOut ? colors.text : almost ? colors.brand : colors.chart.ramp[0];

  return (
    <Animated.View
      entering={enterRow(index)}
      layout={LinearTransition.duration(260)}
      style={[styles.card, !t.isActive && styles.cardOff]}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.name, !t.isActive && styles.off]} numberOfLines={1}>
            {t.name}
          </Text>
          <Text style={[styles.price, !t.isActive && styles.off]}>
            {free ? 'Gratis' : formatMoney(t.price)}
          </Text>
        </View>
        <Switch
          value={t.isActive}
          onValueChange={(v) => {
            Haptics.selectionAsync();
            if (eventId) setTicketActive(eventId, t.id, v);
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel={`${t.name}: ${t.isActive ? 'a la venta' : 'pausada'}`}
        />
      </View>

      <ProgressBar
        height={6}
        total={t.stock ?? Math.max(1, t.sold)}
        delay={220 + index * 70}
        segments={[{ value: t.sold, color: t.isActive ? barColor : colors.border }]}
      />

      <View style={styles.bottom}>
        {!t.isActive ? (
          <Badge label="Pausada" />
        ) : soldOut ? (
          <Badge label="Agotada" tone="strong" />
        ) : almost ? (
          <Badge label={`Últimas ${formatInt(left ?? 0)}`} tone="attention" />
        ) : null}
        <Text style={styles.meta}>
          {formatInt(t.sold)}
          {t.stock != null ? ` / ${formatInt(t.stock)}` : ''} vendidas
          {t.stock == null ? ' · sin tope' : ''}
        </Text>
        <View style={{ flex: 1 }} />
        {!free ? <Text style={styles.revenue}>{formatMoneyCompact(t.revenue)}</Text> : null}
      </View>
    </Animated.View>
  );
}

function Badge({ label, tone }: { label: string; tone?: 'strong' | 'attention' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bg = tone === 'strong' ? colors.text : tone === 'attention' ? colors.brandMuted : colors.raised;
  const fg = tone === 'strong' ? colors.surface : tone === 'attention' ? colors.brandText : colors.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#ffffff' },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
    muted: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 32 },

    capacity: {
      gap: 12,
      padding: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.canvas,
    },
    capacityHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    capacityLabel: { color: c.textSecondary, fontSize: 14, fontWeight: '500' },
    capacityValue: {
      color: c.text,
      fontSize: 22,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    capacityOf: {
      color: c.textMuted,
      fontSize: 13,
      fontFamily: undefined,
      fontWeight: '500',
      letterSpacing: 0,
    },

    list: { gap: 10 },
    empty: {
      padding: 20,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center' },

    card: {
      gap: 12,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    cardOff: { backgroundColor: c.canvas },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    name: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    price: {
      color: c.text,
      fontSize: 20,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.4,
      fontVariant: ['tabular-nums'],
    },
    off: { color: c.textMuted },
    bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    meta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    revenue: { color: c.text, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
    badge: { paddingHorizontal: 8, height: 22, justifyContent: 'center', borderRadius: 7 },
    badgeText: { fontSize: 11, fontWeight: '700' },
  }),
);
