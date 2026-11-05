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
import { Icon, type IconName } from '@/components/dashboard/icon';
import { PaymentMethodIcon } from '@/components/dashboard/payment-method-icon';
import { RollingNumber } from '@/components/dashboard/rolling-number';
import { StatusChip } from '@/components/operations/operation-card';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatMoney, initials, PAYMENT_LABEL, relativeTime } from '@/features/dashboard/format';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { useEventAccess } from '@/features/access/access';
import { canCancel, canConfirmCash, orderKind } from '@/features/operations/operations';
import { awaitingCash, hasPending } from '@/features/operations/scan';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { useNow } from '@/hooks/use-now';
import { cancelOrder, confirmCash, getOrder, type Order } from '@/lib/api/organizer';
import { loadClipboard } from '@/lib/native-modules';
import { invalidate, setQueryData, useQuery } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';
import { toast } from '@/components/ui/toast';

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
 * Detalle de un pedido (GET /api/events/<id>/orders/<order_id>), estilo detalle de movimiento de
 * Revolut: cabecera centrada con cliente, monto y estado; el recorrido (creado → pagado →
 * entregado); contacto, ítems y pago, cada dato en su card. Acciones: aprobar el pago en efectivo (confirm-cash),
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
  const [copied, setCopied] = useState(false);
  const { can } = useEventAccess();
  const cacheKey = eventId && orderId ? `order:${eventId}:${orderId}` : null;
  const q = useQuery<Order>(cacheKey, () => getOrder(eventId!, orderId));
  useFocusStatusBar();

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
      toast.error('No se pudo completar', res.error);
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
  const kind = orderKind(o);
  const name = o.customerName || o.customerEmail || 'Sin nombre';
  const copyId = async () => {
    const Clipboard = await loadClipboard();
    if (!Clipboard) return;
    await Clipboard.setStringAsync(o.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, showActions && { paddingBottom: 120 }]}
        contentInsetAdjustmentBehavior="automatic">
        {/* Cabecera centrada (estilo detalle de movimiento de Revolut). */}
        <Animated.View entering={enter(0)} style={styles.hero}>
          <View>
            <View style={styles.heroAvatar}>
              {o.customerName ? (
                <Text style={styles.heroAvatarText}>{initials(o.customerName)}</Text>
              ) : (
                <Icon name="person" size={24} color={colors.textMuted} />
              )}
            </View>
            <View style={[styles.heroKind, kind !== 'tickets' && { backgroundColor: colors.primary }]}>
              <Icon
                name={KIND_ICON[kind]}
                size={12}
                color={kind !== 'tickets' ? colors.onPrimary : colors.onInk}
              />
            </View>
          </View>
          <Text style={styles.heroName} numberOfLines={1}>
            {name}
          </Text>
          <RollingNumber
            value={o.total}
            format={formatMoney}
            style={cancelled ? { ...styles.heroValue, ...styles.heroCancelled } : styles.heroValue}
          />
          <Animated.View layout={LinearTransition.duration(260)} style={styles.heroMeta}>
            <StatusChip order={o} />
            <Text style={styles.date}>{relativeTime(o.createdAt, now) || fullDate(o.createdAt)}</Text>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <Timeline order={o} />
        </Animated.View>

        {o.customerEmail || o.customerPhone ? (
          <Section title="Contacto" index={2}>
            {o.customerEmail ? (
              <ContactCard
                icon="mail"
                label="Email"
                value={o.customerEmail}
                action="Escribir"
                onPress={() => Linking.openURL(`mailto:${o.customerEmail}`)}
              />
            ) : null}
            {o.customerPhone ? (
              <ContactCard
                icon="message"
                label="WhatsApp"
                value={o.customerPhone}
                action="Abrir"
                onPress={() =>
                  Linking.openURL(`https://wa.me/${o.customerPhone!.replace(/[^\d]/g, '')}`)
                }
              />
            ) : null}
          </Section>
        ) : null}

        {tickets.length ? <Items title="Entradas" items={tickets} index={3} /> : null}
        {products.length ? <Items title="Productos" items={products} index={4} /> : null}

        <Section title="Pago" index={5}>
          <View style={[styles.card, styles.payCard]}>
            <View style={styles.payIcon}>
              {o.paymentMethod ? (
                <PaymentMethodIcon method={o.paymentMethod} size={16} />
              ) : (
                <Icon name="card" size={16} color={colors.textMuted} />
              )}
            </View>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>
                {o.paymentMethod ? PAYMENT_LABEL[o.paymentMethod] : 'Sin medio de pago'}
              </Text>
              <Text style={styles.cardMeta}>{fullDate(o.createdAt)}</Text>
            </View>
            <PaymentPill status={o.paymentStatus} />
          </View>

          <View style={[styles.card, styles.totalCard]}>
            <View style={styles.grow}>
              <Text style={styles.totalLabel}>Total</Text>
              {o.serviceFee > 0 ? (
                <Text style={styles.cardMeta}>
                  Incluye {formatMoney(o.serviceFee)} de costo de servicio
                </Text>
              ) : null}
            </View>
            <Text style={[styles.totalValue, cancelled && styles.heroCancelled]}>
              {formatMoney(o.total)}
            </Text>
          </View>
        </Section>

        <Pressable
          onPress={copyId}
          accessibilityRole="button"
          accessibilityLabel="Copiar ID del pedido"
          style={({ pressed }) => [styles.reference, pressed && styles.pressed]}>
          <Text style={styles.referenceText} numberOfLines={1}>
            {copied ? 'ID copiado' : `ID ${o.id}`}
          </Text>
          <Icon name={copied ? 'checkmark' : 'copy'} size={12} color={colors.textMuted} />
        </Pressable>
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

const KIND_ICON: Record<ReturnType<typeof orderKind>, IconName> = {
  tickets: 'ticket',
  products: 'cart',
  mixed: 'receipt',
};

type StepState = 'done' | 'current' | 'todo' | 'error';

/** Recorrido del pedido: creado → pagado → entregado (o cancelado). */
function Timeline({ order: o }: { order: Order }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const cancelled = o.status === 'cancelled';
  const onlyTickets = o.items.every((i) => i.isTicket);
  const paid = o.paymentStatus === 'approved';
  const rejected = o.paymentStatus === 'rejected';
  const delivered = o.status === 'delivered';
  const partial = o.status === 'partially_delivered';

  const steps: { label: string; detail?: string; state: StepState }[] = [
    { label: 'Pedido creado', detail: fullDate(o.createdAt), state: 'done' },
    {
      label: paid ? 'Pago aprobado' : rejected ? 'Pago rechazado' : 'Pago pendiente',
      detail: o.paymentMethod ? PAYMENT_LABEL[o.paymentMethod] : undefined,
      state: paid ? 'done' : rejected ? 'error' : cancelled ? 'todo' : 'current',
    },
    cancelled
      ? { label: 'Pedido cancelado', detail: fullDate(o.updatedAt), state: 'error' }
      : {
          label: delivered
            ? onlyTickets
              ? 'Ingresó'
              : 'Entregado'
            : partial
              ? 'Entrega parcial'
              : onlyTickets
                ? 'Sin ingresar'
                : 'Por retirar',
          detail: delivered || partial ? fullDate(o.updatedAt) : undefined,
          state: delivered ? 'done' : paid ? 'current' : 'todo',
        },
  ];

  const tone = (s: StepState) =>
    s === 'done'
      ? { fg: colors.onPrimary, bg: colors.success }
      : s === 'error'
        ? { fg: colors.onPrimary, bg: colors.danger }
        : s === 'current'
          ? { fg: colors.onBrand, bg: colors.brand }
          : { fg: colors.textMuted, bg: colors.raised };
  const icon = (s: StepState): IconName =>
    s === 'done' ? 'checkmark' : s === 'error' ? 'close' : s === 'current' ? 'clock' : 'minus';

  return (
    <View style={[styles.card, styles.timeline]}>
      {steps.map((st, i) => {
        const t = tone(st.state);
        const last = i === steps.length - 1;
        return (
          <View key={st.label} style={styles.step}>
            <View style={styles.stepRail}>
              <View style={[styles.stepDot, { backgroundColor: t.bg }]}>
                <Icon name={icon(st.state)} size={10} color={t.fg} />
              </View>
              {!last ? (
                <View
                  style={[
                    styles.stepLine,
                    st.state === 'done' && { backgroundColor: colors.success },
                  ]}
                />
              ) : null}
            </View>
            <View style={[styles.grow, !last && { paddingBottom: 16 }]}>
              <Text style={[styles.stepLabel, st.state === 'todo' && { color: colors.textMuted }]}>
                {st.label}
              </Text>
              {st.detail ? <Text style={styles.cardMeta}>{st.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PaymentPill({ status }: { status: string | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const t =
    status === 'approved'
      ? { fg: colors.success, bg: colors.successMuted }
      : status === 'rejected' || status === 'cancelled'
        ? { fg: colors.danger, bg: colors.dangerMuted }
        : status === 'refunded'
          ? { fg: colors.textSecondary, bg: colors.raised }
          : { fg: colors.brandText, bg: colors.brandMuted };
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.pillText, { color: t.fg }]}>
        {status ? (PAYMENT_STATUS[status] ?? status) : '—'}
      </Text>
    </View>
  );
}

function ContactCard({
  icon,
  label,
  value,
  action,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  action: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${action}`}
      style={({ pressed }) => [styles.card, styles.contact, pressed && styles.pressed]}>
      <View style={styles.contactIcon}>
        <Icon name={icon} size={16} color={colors.text} />
      </View>
      <View style={styles.grow}>
        <Text style={styles.cardMeta}>{label}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <View style={styles.contactAction}>
        <Text style={styles.contactActionText}>{action}</Text>
        <Icon name="external" size={10} color={colors.primary} />
      </View>
    </Pressable>
  );
}

function Items({ title, items, index }: { title: string; items: Order['items']; index: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Section title={title} index={index}>
      {items.map((it) => {
        const redeemed = it.redeemedQuantity ?? (it.redeemedAt ? it.quantity : 0);
        const done = redeemed >= it.quantity;
        const partial = !done && redeemed > 0;
        const label = done
          ? it.isTicket
            ? 'Ingresó'
            : 'Entregado'
          : partial
            ? `${redeemed} de ${it.quantity} entregados`
            : it.isTicket
              ? 'Sin ingresar'
              : 'Por retirar';
        return (
          <View key={it.id} style={[styles.card, styles.item]}>
            <View style={styles.qty}>
              <Text style={styles.qtyText}>{it.quantity}×</Text>
            </View>
            <View style={[styles.grow, { gap: 6 }]}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {it.name}
              </Text>
              <View
                style={[
                  styles.pill,
                  styles.pillLeft,
                  { backgroundColor: done ? colors.successMuted : partial ? colors.raised : colors.brandMuted },
                ]}>
                <Icon
                  name={done ? 'check' : 'clock'}
                  size={11}
                  color={done ? colors.success : partial ? colors.textSecondary : colors.brandText}
                />
                <Text
                  style={[
                    styles.pillText,
                    { color: done ? colors.success : partial ? colors.textSecondary : colors.brandText },
                  ]}>
                  {label}
                </Text>
              </View>
            </View>
            <View style={styles.itemRight}>
              <Text style={styles.itemValue}>{formatMoney(it.subtotal)}</Text>
              {it.quantity > 1 ? <Text style={styles.cardMeta}>{formatMoney(it.price)} c/u</Text> : null}
            </View>
          </View>
        );
      })}
    </Section>
  );
}

/** Título de sección y sus cards apiladas (cada dato en su propia card). */
function Section({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Animated.View entering={enter(index)} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.stack}>{children}</View>
    </Animated.View>
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
  const { colors } = useTheme();
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
        <ActivityIndicator color={tone === 'primary' ? colors.onInk : colors.danger} />
      ) : (
        <Text style={[styles.actionText, tone === 'danger' && styles.actionTextDanger]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: 24 },
    grow: { flex: 1, gap: 2 },
    pressed: { opacity: 0.7 },
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    cardTitle: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    cardMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },

    hero: { alignItems: 'center', gap: 6, paddingTop: Spacing.two },
    heroAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
      marginBottom: 6,
    },
    heroAvatarText: { color: c.text, fontSize: 20, fontFamily: DisplayFont.bold },
    heroKind: {
      position: 'absolute',
      right: -2,
      bottom: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.ink,
      borderWidth: 2,
      borderColor: c.background,
    },
    heroName: { color: c.textSecondary, fontSize: 15, fontWeight: '500', maxWidth: '85%' },
    heroValue: {
      color: c.text,
      fontSize: 40,
      lineHeight: 46,
      fontFamily: DisplayFont.bold,
      letterSpacing: -1.2,
    },
    heroCancelled: { color: c.textMuted, textDecorationLine: 'line-through' },
    heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    date: { color: c.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },

    timeline: { padding: Spacing.three },
    step: { flexDirection: 'row', gap: 12 },
    stepRail: { alignItems: 'center', width: 22 },
    stepDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepLine: { flex: 1, width: 2, marginVertical: 3, borderRadius: 1, backgroundColor: c.border },
    stepLabel: { color: c.text, fontSize: 14, fontWeight: '600', marginTop: 2 },

    section: { gap: 8 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    stack: { gap: 8 },

    contact: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    contactIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    contactAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    contactActionText: { color: c.primary, fontSize: 13, fontWeight: '600' },

    item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    qty: {
      minWidth: 38,
      height: 38,
      paddingHorizontal: 6,
      borderRadius: Radius.md,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    qtyText: { color: c.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
    itemRight: { alignItems: 'flex-end', gap: 2 },
    itemValue: { color: c.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: Radius.pill,
    },
    pillLeft: { alignSelf: 'flex-start' },
    pillText: { fontSize: 11, fontWeight: '700' },

    payCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    payIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    totalCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.three },
    totalLabel: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    totalValue: { color: c.text, fontSize: 20, fontFamily: DisplayFont.bold, fontVariant: ['tabular-nums'] },

    reference: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      gap: 6,
      maxWidth: '100%',
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    referenceText: { color: c.textMuted, fontSize: 12, flexShrink: 1 },

    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: Spacing.three,
      paddingTop: 12,
      backgroundColor: c.background,
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
    actionPrimary: { backgroundColor: c.ink },
    actionDanger: { backgroundColor: c.dangerMuted },
    actionText: { color: c.onInk, fontSize: 16, fontFamily: DisplayFont.semibold },
    actionTextDanger: { color: c.danger },
    missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background, padding: 24 },
    missingText: { color: c.textSecondary, fontSize: 15, textAlign: 'center' },
  }),
);
