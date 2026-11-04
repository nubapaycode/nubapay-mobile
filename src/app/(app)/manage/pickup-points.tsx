import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { enter, enterRow, StatsRow } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { ProgressBar } from '@/components/dashboard/progress-bar';
import { AddButton } from '@/components/manage/manage-ui';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatInt, formatMoneyCompact, formatPercent } from '@/features/dashboard/format';
import { type PickupPoint, setPickupActive, usePickupPoints } from '@/features/manage/manage';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';

/**
 * Puntos de retiro: métricas, y cada punto en su tarjeta con su parte de los pedidos, lo
 * recaudado, la cola de pedidos por retirar (en vivo) y el switch de abierto/cerrado.
 */
export default function PickupPointsScreen() {
  const styles = useStyles();
  const { pickups, error, eventId } = usePickupPoints();
  useFocusStatusBar('dark');

  const points = pickups ?? [];
  const open = points.filter((p) => p.isActive).length;
  const orders = points.reduce((a, p) => a + p.orders, 0);
  const queue = points.reduce((a, p) => a + p.pending, 0);
  const max = Math.max(1, ...points.map((p) => p.orders));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      {!pickups ? (
        <Text style={styles.muted}>{error ?? 'Cargando…'}</Text>
      ) : (
        <>
          <StatsRow
            index={0}
            stats={[
              { label: 'Puntos', value: formatInt(points.length) },
              { label: 'Abiertos', value: formatInt(open) },
              { label: 'Pedidos', value: formatInt(orders) },
            ]}
          />

          {queue > 0 ? (
            <Animated.View entering={enter(1)} style={styles.queue}>
              <View style={styles.queueDot} />
              <Text style={styles.queueText}>
                {formatInt(queue)} {queue === 1 ? 'pedido espera' : 'pedidos esperan'} ser retirados
              </Text>
            </Animated.View>
          ) : null}

          <Animated.View entering={enter(2)}>
            <AddButton
              label="Agregar punto de retiro"
              onPress={() => router.push({ pathname: '/manage/new/[kind]', params: { kind: 'pickup' } })}
            />
          </Animated.View>

          {points.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Todavía no hay puntos de retiro. Creá uno para que tus clientes sepan dónde retirar.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {points.map((p, i) => (
                <PointCard key={p.id} point={p} index={i} max={max} total={orders} eventId={eventId} />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function PointCard({
  point: p,
  index,
  max,
  total,
  eventId,
}: {
  point: PickupPoint;
  index: number;
  max: number;
  total: number;
  eventId: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={enterRow(index)}
      layout={LinearTransition.duration(260)}
      style={[styles.card, !p.isActive && styles.cardOff]}>
      <View style={styles.top}>
        <View style={[styles.icon, !p.isActive && styles.iconOff]}>
          <Icon name="store" size={17} color={p.isActive ? '#000000' : colors.textMuted} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, !p.isActive && styles.off]} numberOfLines={1}>
              {p.name}
            </Text>
            {!p.isActive ? (
              <Badge label="Cerrado" />
            ) : p.pending > 0 ? (
              <Badge label={`${formatInt(p.pending)} en cola`} tone="attention" />
            ) : null}
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {p.description ?? (p.isActive ? 'Abierto para retirar pedidos' : 'No recibe pedidos')}
          </Text>
        </View>
        <Switch
          value={p.isActive}
          onValueChange={(v) => {
            Haptics.selectionAsync();
            if (eventId) setPickupActive(eventId, p.id, v);
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel={`${p.name}: ${p.isActive ? 'abierto' : 'cerrado'}`}
        />
      </View>

      {p.orders > 0 ? (
        <View style={{ gap: 8 }}>
          <ProgressBar
            height={4}
            total={max}
            delay={220 + index * 70}
            segments={[{ value: p.orders, color: p.isActive ? colors.chart.ramp[0] : colors.border }]}
          />
          <View style={styles.bottom}>
            <Text style={styles.meta}>
              {formatInt(p.orders)} pedidos · {total ? formatPercent(p.orders / total) : '—'} del total
            </Text>
            <Text style={styles.revenue}>{formatMoneyCompact(p.revenue)}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.meta}>Todavía sin pedidos</Text>
      )}
    </Animated.View>
  );
}

function Badge({ label, tone }: { label: string; tone?: 'attention' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: tone ? colors.brandMuted : colors.raised }]}>
      <Text style={[styles.badgeText, { color: tone ? colors.brandText : colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#ffffff' },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
    muted: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 32 },

    queue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.brandMuted,
    },
    queueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.brand },
    queueText: { flex: 1, color: c.brandText, fontSize: 14, fontWeight: '600' },

    list: { gap: 10 },
    empty: {
      padding: 20,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

    card: {
      gap: 14,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    cardOff: { backgroundColor: c.canvas },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    iconOff: { backgroundColor: c.border },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold, flexShrink: 1 },
    off: { color: c.textMuted },
    description: { color: c.textMuted, fontSize: 13 },
    bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    meta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    revenue: { color: c.text, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
    badge: { paddingHorizontal: 8, height: 22, justifyContent: 'center', borderRadius: 7 },
    badgeText: { fontSize: 11, fontWeight: '700' },
  }),
);
