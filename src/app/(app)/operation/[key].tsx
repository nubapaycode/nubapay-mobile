import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { RollingNumber } from '@/components/dashboard/rolling-number';
import { StatusChip } from '@/components/operations/operation-card';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatMoney, PAYMENT_LABEL, relativeTime } from '@/features/dashboard/format';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { useEventAccess } from '@/features/access/access';
import { canCancel, canConfirmCash } from '@/features/operations/operations';
import { awaitingCash, hasPending } from '@/features/operations/scan';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { useNow } from '@/hooks/use-now';
import { cancelOrder, confirmCash, getOrder, type Order } from '@/lib/api/organizer';
import { invalidate, setQueryData, useQuery } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';

const dateFmt = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const fullDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');

const PAYMENT_STATUS: Record<string, string> = {
  approved: 'Aprobado',
  pending: 'Pendiente',
  in_process: 'En proceso',
  rejected: 'Rechazado',
  refunded: 'Reintegrado',
  cancelled: 'Anulado',
};

/**
 * Detalle de un pedido (GET /api/events/<id>/orders/<order_id>): monto y estado, cliente, ítems
 * con su entrega, pago e historial. Acciones: aprobar el pago en efectivo (confirm-cash),
 * entregar sin escanear (abre /deliver) y cancelar el pedido (invalida el QR).
 */
export default function OperationScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { key: orderId } = useLocalSearchParams<{ key: string }>();
  const eventId = useSelectedEventId();
  const now = useNow(15_000);
  const [busy, setBusy] = useState<null | 'approve' | 'cancel'>(null);
  const { can } = useEventAccess();
  const cacheKey = eventId && orderId ? `order:${eventId}:${orderId}` : null;
  const q = useQuery<Order>(cacheKey, () => getOrder(eventId!, orderId));
  useFocusStatusBar('dark');

  const o = q.data;
  if (!o) {
    return (
      <View style={styles.missing}>
        {q.error ? <Text style={styles.missingText}>{q.error}</Text> : <ActivityIndicator color={colors.textMuted} />}
      </View>
    );
  }

  const cancelled = o.status === 'cancelled';
  const title = `Pedido${o.orderNumber ? ` #${o.orderNumber}` : ''}`;

  const after = async (res: { ok: true; data: Order } | { ok: false; error: string }) => {
    setBusy(null);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('No se pudo completar', res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (cacheKey) setQueryData<Order>(cacheKey, () => res.data);
    invalidate(`orders:${eventId}`);
    invalidate('dashboard');
  };

  const approve = () =>
    Alert.alert('Aprobar pago', `¿Confirmás que recibiste ${formatMoney(o.total)} en efectivo?`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Aprobar',
        onPress: async () => {
          setBusy('approve');
          await after(await confirmCash(eventId!, o.id));
        },
      },
    ]);

  const cancel = () =>
    Alert.alert(
      'Cancelar pedido',
      'El QR deja de servir y no se va a poder retirar. Si se pagó online, el reintegro se hace desde el proveedor de pago.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cancelar pedido',
          style: 'destructive',
          onPress: async () => {
            setBusy('cancel');
            await after(await cancelOrder(eventId!, o.id));
          },
        },
      ],
    );

  // Cobrar efectivo y entregar son del escáner; cancelar, de quien gestiona pedidos.
  const showApprove = canConfirmCash(o) && can('scanner');
  const showDeliver = !showApprove && hasPending(o) && !awaitingCash(o) && can('scanner');
  const showCancel = canCancel(o) && can('orders');
  const showActions = showApprove || showCancel || showDeliver;
  const primary = showApprove || showDeliver;
  const products = o.items.filter((i) => !i.isTicket);
  const tickets = o.items.filter((i) => i.isTicket);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, showActions && { paddingBottom: 120 }]}
        contentInsetAdjustmentBehavior="automatic">
        <Animated.View entering={enter(0)} style={styles.hero}>
          <Text style={styles.caption}>{relativeTime(o.createdAt, now) || 'Pedido'}</Text>
          <RollingNumber
            value={o.total}
            format={formatMoney}
            style={cancelled ? { ...styles.heroValue, ...styles.heroCancelled } : styles.heroValue}
          />
          <Animated.View layout={LinearTransition.duration(260)} style={styles.heroMeta}>
            <StatusChip order={o} />
            <Text style={styles.date}>{fullDate(o.createdAt)}</Text>
          </Animated.View>
        </Animated.View>

        <Section title="Cliente" index={1}>
          <Row icon="person" label="Nombre" value={o.customerName || 'Sin nombre'} />
          {o.customerEmail ? (
            <Row
              icon="mail"
              label="Email"
              value={o.customerEmail}
              divider
              onPress={() => Linking.openURL(`mailto:${o.customerEmail}`)}
            />
          ) : null}
          {o.customerPhone ? (
            <Row
              icon="people"
              label="Teléfono"
              value={o.customerPhone}
              divider
              onPress={() => Linking.openURL(`https://wa.me/${o.customerPhone!.replace(/[^\d]/g, '')}`)}
            />
          ) : null}
        </Section>

        {tickets.length ? <Items title="Entradas" items={tickets} index={2} /> : null}
        {products.length ? <Items title="Productos" items={products} index={3} /> : null}

        <Section title="Pago" index={4}>
          <Row label="Medio" value={o.paymentMethod ? PAYMENT_LABEL[o.paymentMethod] : '—'} />
          <Row
            label="Estado"
            value={o.paymentStatus ? (PAYMENT_STATUS[o.paymentStatus] ?? o.paymentStatus) : '—'}
            tone={o.paymentStatus === 'approved' ? undefined : o.paymentStatus === 'rejected' ? 'danger' : 'attention'}
            divider
          />
          {o.serviceFee > 0 ? <Row label="Costo de servicio" value={formatMoney(o.serviceFee)} divider /> : null}
          <View style={[styles.line, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMoney(o.total)}</Text>
          </View>
        </Section>

        <Text style={styles.reference}>Pedido {o.id}</Text>
      </ScrollView>

      {showActions ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {showCancel ? (
            <ActionButton
              label={primary ? 'Cancelar' : 'Cancelar pedido'}
              tone="danger"
              loading={busy === 'cancel'}
              disabled={!!busy}
              grow={!primary}
              onPress={cancel}
            />
          ) : null}
          {showApprove ? (
            <ActionButton
              label="Aprobar pago"
              tone="primary"
              loading={busy === 'approve'}
              disabled={!!busy}
              grow
              onPress={approve}
            />
          ) : null}
          {showDeliver ? (
            <ActionButton
              label={o.items.every((i) => i.isTicket) ? 'Registrar ingreso' : 'Entregar'}
              tone="primary"
              disabled={!!busy}
              grow
              onPress={() => router.push({ pathname: '/deliver/[id]', params: { id: o.id } })}
            />
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Items({ title, items, index }: { title: string; items: Order['items']; index: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Section title={title} index={index}>
      {items.map((it, i) => {
        const redeemed = it.redeemedQuantity ?? (it.redeemedAt ? it.quantity : 0);
        const done = redeemed >= it.quantity;
        return (
          <View key={it.id} style={[styles.line, i > 0 && styles.divider]}>
            <Text style={styles.qty}>{it.quantity}×</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.lineName} numberOfLines={2}>
                {it.name}
              </Text>
              <View style={styles.redeemRow}>
                <Icon name={done ? 'check' : 'clock'} size={12} color={done ? colors.success : colors.textMuted} />
                <Text style={[styles.redeemText, done && { color: colors.success }]}>
                  {done
                    ? it.isTicket ? 'Ingresó' : 'Entregado'
                    : redeemed > 0
                      ? `${redeemed} de ${it.quantity} entregados`
                      : it.isTicket ? 'Sin ingresar' : 'Por retirar'}
                </Text>
              </View>
            </View>
            <Text style={styles.lineValue}>{formatMoney(it.subtotal)}</Text>
          </View>
        );
      })}
    </Section>
  );
}

function Section({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Animated.View entering={enter(index)} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </Animated.View>
  );
}

function Row({
  icon,
  label,
  value,
  tone,
  divider,
  onPress,
}: {
  icon?: 'person' | 'mail' | 'people';
  label: string;
  value: string;
  tone?: 'danger' | 'attention';
  divider?: boolean;
  onPress?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = tone === 'danger' ? colors.danger : tone === 'attention' ? colors.brandText : colors.text;
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[styles.row, divider && styles.divider]}>
      {icon ? <Icon name={icon} size={16} color={colors.textMuted} /> : null}
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      {onPress ? <Icon name="external" size={12} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

function ActionButton({
  label,
  tone,
  grow,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  tone: 'primary' | 'danger';
  grow?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.action,
        tone === 'primary' ? styles.actionPrimary : styles.actionDanger,
        grow && { flex: 1 },
        (pressed || disabled) && { opacity: 0.85 },
      ]}>
      {loading ? (
        <ActivityIndicator color={tone === 'primary' ? '#ffffff' : '#000000'} />
      ) : (
        <Text style={[styles.actionText, tone === 'danger' && styles.actionTextDanger]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#ffffff' },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
    hero: { gap: 6, paddingHorizontal: 4 },
    caption: { color: c.textSecondary, fontSize: 14, fontWeight: '500' },
    heroValue: { color: c.text, fontSize: 38, lineHeight: 44, fontFamily: DisplayFont.bold, letterSpacing: -1.2 },
    heroCancelled: { color: c.textMuted },
    heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    date: { color: c.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
    section: { gap: 8 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    card: { borderRadius: Radius.xl, borderCurve: 'continuous', borderWidth: 1, borderColor: c.border, paddingHorizontal: 14 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
    rowLabel: { color: c.textSecondary, fontSize: 14 },
    rowValue: { flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '500' },
    line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    qty: { width: 28, color: c.textMuted, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
    lineName: { color: c.text, fontSize: 15 },
    lineValue: { color: c.text, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
    redeemRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    redeemText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    totalRow: { borderTopWidth: 1, borderTopColor: c.border },
    totalLabel: { flex: 1, color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    totalValue: { color: c.text, fontSize: 17, fontFamily: DisplayFont.bold, fontVariant: ['tabular-nums'] },
    reference: { color: c.textMuted, fontSize: 12, textAlign: 'center' },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: Spacing.three,
      paddingTop: 12,
      backgroundColor: '#ffffff',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    action: {
      height: 52,
      paddingHorizontal: 20,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionPrimary: { backgroundColor: '#000000' },
    actionDanger: { backgroundColor: c.raised },
    actionText: { color: '#ffffff', fontSize: 16, fontFamily: DisplayFont.semibold },
    actionTextDanger: { color: c.danger },
    missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', padding: 24 },
    missingText: { color: c.textSecondary, fontSize: 15, textAlign: 'center' },
  }),
);
