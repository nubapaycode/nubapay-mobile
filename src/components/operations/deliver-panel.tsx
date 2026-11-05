import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { formatMoney } from '@/features/dashboard/format';
import { awaitingCash, remainingOf, SCAN_COPY, scanKind } from '@/features/operations/scan';
import { confirmCash, type Order, type OrderItem, redeemItems } from '@/lib/api/organizer';
import { makeStyles, useTheme } from '@/theme';

/**
 * Entrega de un pedido validado: cobrar el efectivo si falta y elegir cuánto de cada ítem se
 * entrega (o cuántas entradas se usan) ahora. Por defecto va todo lo pendiente.
 * Lo usan el escáner y el detalle del pedido.
 */
export function DeliverPanel({
  eventId,
  order: initial,
  canConfirmCash,
  onDone,
  onCancel,
}: {
  eventId: string;
  order: Order;
  /** El rol permite aprobar pagos en efectivo (herramienta "scanner"). */
  canConfirmCash: boolean;
  /** Se registró la entrega: el pedido ya actualizado. */
  onDone: (order: Order) => void;
  onCancel: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [order, setOrder] = useState(initial);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(initial.items.map((i) => [i.id, remainingOf(i)])),
  );
  const [busy, setBusy] = useState<null | 'cash' | 'redeem'>(null);
  const [error, setError] = useState<string | null>(null);

  const copy = SCAN_COPY[scanKind(order)];
  const pending = order.items.filter((i) => remainingOf(i) > 0);
  const done = order.items.filter((i) => remainingOf(i) === 0);
  const selected = Object.values(qty).reduce((a, n) => a + n, 0);
  const title = `Pedido${order.orderNumber ? ` #${order.orderNumber}` : ''}`;

  const step = (item: OrderItem, d: number) => {
    Haptics.selectionAsync();
    setQty((q) => ({ ...q, [item.id]: Math.min(remainingOf(item), Math.max(0, (q[item.id] ?? 0) + d)) }));
  };

  const receiveCash = async () => {
    setBusy('cash');
    setError(null);
    const res = await confirmCash(eventId, order.id);
    setBusy(null);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOrder(res.data);
  };

  const redeem = async () => {
    const items = Object.fromEntries(Object.entries(qty).filter(([, n]) => n > 0));
    if (!Object.keys(items).length) return;
    setBusy('redeem');
    setError(null);
    const res = await redeemItems(eventId, order.id, items);
    setBusy(null);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(res.error);
      if (res.order) setOrder(res.order);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone(res.data);
  };

  return (
    <Animated.View entering={FadeIn.duration(220)} layout={LinearTransition.duration(220)} style={styles.panel}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.customer} numberOfLines={1}>
            {order.customerName || 'Sin nombre'}
          </Text>
        </View>
        <Text style={styles.total}>{formatMoney(order.total)}</Text>
      </View>

      {awaitingCash(order) ? (
        <>
          <View style={styles.cashCard}>
            <Icon name="cash" size={22} color="#000000" />
            <Text style={styles.cashLabel}>Pago en efectivo pendiente. Debés recibir</Text>
            <Text style={styles.cashValue}>{formatMoney(order.total)}</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {canConfirmCash ? (
            <PrimaryButton label="Ya lo recibí" loading={busy === 'cash'} disabled={!!busy} onPress={receiveCash} />
          ) : (
            <Text style={styles.note}>Tu rol no puede aprobar pagos en efectivo.</Text>
          )}
          <SecondaryButton label="Cancelar" disabled={!!busy} onPress={onCancel} />
        </>
      ) : (
        <>
          {order.paymentStatus && order.paymentStatus !== 'approved' ? (
            <View style={styles.warn}>
              <Icon name="warning" size={14} color={colors.warning} />
              <Text style={styles.warnText}>El pago de este pedido no figura como aprobado.</Text>
            </View>
          ) : null}

          <Text style={styles.prompt}>{copy.prompt}</Text>
          <View style={styles.list}>
            {pending.map((it) => {
              const n = qty[it.id] ?? 0;
              const left = remainingOf(it);
              return (
                <View key={it.id} style={[styles.item, n > 0 && styles.itemOn]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {it.name}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {left === it.quantity ? `${it.quantity} en total` : `Quedan ${left} de ${it.quantity}`}
                    </Text>
                  </View>
                  <View style={styles.stepper}>
                    <StepButton icon="minus" label={`Menos ${it.name}`} disabled={n === 0} onPress={() => step(it, -1)} />
                    <Text style={styles.stepValue}>{n}</Text>
                    <StepButton icon="plus" label={`Más ${it.name}`} disabled={n >= left} onPress={() => step(it, 1)} />
                  </View>
                </View>
              );
            })}
            {done.map((it) => (
              <View key={it.id} style={[styles.item, styles.itemDone]}>
                <Text style={[styles.itemName, styles.muted, { flex: 1 }]} numberOfLines={2}>
                  {it.quantity}× {it.name}
                </Text>
                <View style={styles.doneTag}>
                  <Icon name="check" size={12} color={colors.success} />
                  <Text style={[styles.doneText, { color: colors.success }]}>
                    {it.isTicket ? 'Usada' : 'Entregado'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label={selected ? copy.confirm(selected) : 'Elegí qué entregar'}
            loading={busy === 'redeem'}
            disabled={!!busy || selected === 0}
            onPress={redeem}
          />
          <SecondaryButton label="Cancelar" disabled={!!busy} onPress={onCancel} />
        </>
      )}
    </Animated.View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'plus' | 'minus';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.step, disabled && { opacity: 0.3 }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={14} color="#000000" />
    </Pressable>
  );
}

function PrimaryButton({
  label,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.primary, disabled && !loading && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}>
      {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

function SecondaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.secondary, pressed && { backgroundColor: colors.border }]}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    panel: { gap: 12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { color: c.text, fontSize: 20, fontFamily: DisplayFont.bold, letterSpacing: -0.4 },
    customer: { color: c.textMuted, fontSize: 14 },
    total: { color: c.text, fontSize: 18, fontFamily: DisplayFont.semibold, fontVariant: ['tabular-nums'] },
    prompt: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    list: { gap: 8 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    itemOn: { borderColor: '#000000' },
    itemDone: { backgroundColor: c.canvas },
    itemName: { color: c.text, fontSize: 15, fontWeight: '500' },
    itemMeta: { color: c.textMuted, fontSize: 12 },
    muted: { color: c.textMuted },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    step: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    stepValue: {
      minWidth: 18,
      textAlign: 'center',
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    doneTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    doneText: { fontSize: 12, fontWeight: '600' },
    cashCard: {
      alignItems: 'center',
      gap: 6,
      padding: 18,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.raised,
    },
    cashLabel: { color: c.textSecondary, fontSize: 14, textAlign: 'center' },
    cashValue: { color: c.text, fontSize: 30, fontFamily: DisplayFont.bold, letterSpacing: -0.8 },
    warn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: Radius.md,
      backgroundColor: c.warningMuted,
    },
    warnText: { flex: 1, color: c.warning, fontSize: 13 },
    error: { color: c.danger, fontSize: 14, textAlign: 'center' },
    note: { color: c.textMuted, fontSize: 13, textAlign: 'center' },
    primary: {
      height: 52,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
    },
    primaryText: { color: '#ffffff', fontSize: 16, fontFamily: DisplayFont.semibold },
    secondary: {
      height: 48,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    secondaryText: { color: '#000000', fontSize: 15, fontWeight: '600' },
  }),
);
