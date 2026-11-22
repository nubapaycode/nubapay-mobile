import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon, type IconName } from '@/components/dashboard/icon';
import { PaymentMethodIcon } from '@/components/dashboard/payment-method-icon';
import { RollingNumber } from '@/components/dashboard/rolling-number';
import { Font, font, Radius, Spacing } from '@/constants/theme';
import { formatMoney, PAYMENT_LABEL, relativeTime } from '@/features/dashboard/format';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { useEventAccess } from '@/features/access/access';
import { canCancel, canConfirmCash } from '@/features/operations/operations';
import { awaitingCash, hasPending } from '@/features/operations/scan';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { useNow } from '@/hooks/use-now';
import { cancelOrder, confirmCash, getOrder, type Order } from '@/lib/api/organizer';
import { useProductPhotos } from '@/features/operations/product-photos';
import { loadClipboard } from '@/lib/native-modules';
import { invalidate, setQueryData, useQuery } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';
import { toast } from '@/components/ui/toast';
import { ErrorState } from '@/components/ui/error-state';
import { Text } from '@/components/ui/text';
import { FaceAvatar } from '@/components/ui/face-avatar';

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
 * Revolut. Ordenado por lo que hace quien lo abre (barra/puerta): cabecera con cliente y monto, el
 * recorrido compacto (creado → pagado → entregado), qué compró, el pago y al final el contacto; cada
 * dato una sola vez y en su card. Abajo solo la acción principal (aprobar efectivo o entregar);
 * cancelar (invalida el QR) vive en el menú ⋯ de la barra para no tocarlo sin querer.
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
  // Fotos de los productos: el pedido no las trae, salen del catálogo (misma caché que Productos).
  const hasProducts = !!q.data?.items.some((i) => !i.isTicket);
  const photos = useProductPhotos(hasProducts);
  useFocusStatusBar();

  const o = q.data;
  if (!o) {
    return (
      <View style={styles.missing}>
        {q.error ? (
          <ErrorState title="No pudimos cargar el pedido" message={q.error} onRetry={q.refresh} />
        ) : (
          <ActivityIndicator color={colors.textMuted} />
        )}
      </View>
    );
  }

  const cancelled = o.status === 'cancelled';
  const title = `Pedido${o.orderNumber ? ` #${o.orderNumber}` : ''}`;

  const after = async (
    res: { ok: true; data: Order } | { ok: false; error: string },
    done?: string,
  ) => {
    setBusy(null);
    if (!res.ok) {
      toast.error('No se pudo completar', res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (done) toast.success(done);
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
            await after(await cancelOrder(eventId!, o.id), 'Pedido cancelado');
          },
        },
      ],
    );

  // Cobrar efectivo y entregar son del escáner; cancelar, de quien gestiona pedidos.
  const showApprove = canConfirmCash(o) && can('scanner');
  const showDeliver = !showApprove && hasPending(o) && !awaitingCash(o) && can('scanner');
  const showCancel = canCancel(o) && can('orders');
  const showActions = showApprove || showDeliver;
  const products = o.items.filter((i) => !i.isTicket);
  const tickets = o.items.filter((i) => i.isTicket);
  // El estado de cada ítem solo se muestra si no todos están igual (o hay entregas parciales).
  const itemStates = new Set(o.items.map(itemState));
  const showItemState = itemStates.size > 1 || itemStates.has('partial');
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
      <Stack.Screen
        options={{
          title,
          ...(showCancel
            ? Platform.OS === 'ios'
              ? {
                  unstable_headerRightItems: () => [
                    {
                      type: 'menu',
                      label: 'Opciones',
                      icon: { type: 'sfSymbol', name: 'ellipsis' },
                      menu: {
                        items: [
                          {
                            type: 'action',
                            label: 'Cancelar pedido',
                            icon: { type: 'sfSymbol', name: 'xmark.circle' },
                            destructive: true,
                            onPress: cancel,
                          },
                        ],
                      },
                    },
                  ],
                }
              : {
                  headerRight: () => (
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        Alert.alert(title, undefined, [
                          { text: 'Cancelar pedido', style: 'destructive', onPress: cancel },
                          { text: 'Volver', style: 'cancel' },
                        ]);
                      }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Opciones del pedido"
                      style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
                      <Icon name="ellipsis" size={22} color={colors.text} />
                    </Pressable>
                  ),
                }
            : {}),
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, showActions && { paddingBottom: 120 }]}
        contentInsetAdjustmentBehavior="automatic">
        {/* Cabecera centrada (estilo detalle de movimiento de Revolut). */}
        {/* Destino del zoom desde la card: la card se transforma en esta cabecera (iOS 18+). */}
        <Link.AppleZoomTarget>
          <Animated.View entering={enter(0)} style={styles.hero}>
            <View style={styles.heroAvatar}>
              <FaceAvatar seed={o.customerName || o.customerEmail || o.id} size={64} />
            </View>
            <Text style={styles.heroName} numberOfLines={1}>
              {name}
            </Text>
            <RollingNumber
              value={o.total}
              format={formatMoney}
              style={cancelled ? { ...styles.heroValue, ...styles.heroCancelled } : styles.heroValue}
            />
            <Text style={styles.date}>{relativeTime(o.createdAt, now) || fullDate(o.createdAt)}</Text>
          </Animated.View>
        </Link.AppleZoomTarget>

        <Animated.View entering={enter(1)}>
          <Stepper order={o} />
        </Animated.View>

        {tickets.length ? <Items title="Entradas" items={tickets} photos={photos} showState={showItemState} index={2} /> : null}
        {products.length ? <Items title="Productos" items={products} photos={photos} showState={showItemState} index={3} /> : null}

        <Section title="Pago" index={4}>
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
                {o.paymentMethod ? (PAYMENT_LABEL[o.paymentMethod] ?? 'Otro medio de pago') : 'Medio de pago no registrado'}
              </Text>
              <Text style={styles.cardMeta}>{fullDate(o.createdAt)}</Text>
            </View>
            <PaymentPill status={o.paymentStatus} />
          </View>

          {o.serviceFee > 0 ? (
            <View style={[styles.card, styles.payCard]}>
              <View style={styles.grow}>
                <Text style={styles.cardTitle}>Costo de servicio</Text>
                <Text style={styles.cardMeta}>Incluido en el total</Text>
              </View>
              <Text style={styles.itemValue}>{formatMoney(o.serviceFee)}</Text>
            </View>
          ) : null}
        </Section>

        {o.customerEmail || o.customerPhone ? (
          <Section title="Contacto" index={5}>
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

type StepState = 'done' | 'current' | 'todo' | 'error';

/** Recorrido del pedido en una fila: creado → pagado → entregado (o cancelado). */
function Stepper({ order: o }: { order: Order }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const cancelled = o.status === 'cancelled';
  const onlyTickets = o.items.every((i) => i.isTicket);
  const paid = o.paymentStatus === 'approved';
  const rejected = o.paymentStatus === 'rejected';
  const delivered = o.status === 'delivered';
  const partial = o.status === 'partially_delivered';

  const steps: { label: string; state: StepState }[] = [
    { label: 'Creado', state: 'done' },
    {
      label: paid ? 'Pagado' : rejected ? 'Rechazado' : 'Sin pagar',
      state: paid ? 'done' : rejected ? 'error' : cancelled ? 'todo' : 'current',
    },
    cancelled
      ? { label: 'Cancelado', state: 'error' }
      : {
          label: delivered
            ? onlyTickets
              ? 'Ingresó'
              : 'Entregado'
            : partial
              ? 'Parcial'
              : onlyTickets
                ? 'Sin ingresar'
                : 'Por retirar',
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
    <View
      style={[styles.card, styles.stepper]}
      accessible
      accessibilityLabel={steps.map((st) => st.label).join(', ')}>
      {steps.map((st, i) => {
        const t = tone(st.state);
        return (
          <View key={st.label} style={styles.step}>
            <View style={styles.stepTrack}>
              <View
                style={[
                  styles.stepLine,
                  i === 0 && styles.stepLineHidden,
                  steps[i - 1]?.state === 'done' && st.state !== 'todo' && { backgroundColor: colors.success },
                ]}
              />
              <View style={[styles.stepDot, { backgroundColor: t.bg }]}>
                <Icon name={icon(st.state)} size={10} color={t.fg} />
              </View>
              <View
                style={[
                  styles.stepLine,
                  i === steps.length - 1 && styles.stepLineHidden,
                  st.state === 'done' && steps[i + 1]?.state !== 'todo' && { backgroundColor: colors.success },
                ]}
              />
            </View>
            <Text
              style={[styles.stepLabel, st.state === 'todo' && { color: colors.textMuted }]}
              numberOfLines={1}>
              {st.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

type ItemState = 'done' | 'partial' | 'pending';

function itemState(it: Order['items'][number]): ItemState {
  const redeemed = it.redeemedQuantity ?? (it.redeemedAt ? it.quantity : 0);
  return redeemed >= it.quantity ? 'done' : redeemed > 0 ? 'partial' : 'pending';
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

function Items({
  title,
  items,
  photos,
  showState,
  index,
}: {
  title: string;
  items: Order['items'];
  /** Foto de cada producto por id (las entradas no tienen). */
  photos: Map<string, string | null>;
  /** Si todos los ítems están igual, el estado ya se ve en el recorrido de arriba. */
  showState: boolean;
  index: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Section title={title} index={index}>
      {items.map((it) => {
        const state = itemState(it);
        const done = state === 'done';
        const partial = state === 'partial';
        const redeemed = it.redeemedQuantity ?? 0;
        const label = done
          ? it.isTicket
            ? 'Ingresó'
            : 'Entregado'
          : partial
            ? `${redeemed} de ${it.quantity} entregados`
            : it.isTicket
              ? 'Sin ingresar'
              : 'Por retirar';
        const fg = done ? colors.success : partial ? colors.textSecondary : colors.brandText;
        return (
          <View key={it.id} style={[styles.card, styles.item]}>
            <View style={styles.thumb}>
              {photos.get(it.productId) ? (
                <Image
                  source={{ uri: photos.get(it.productId)! }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={150}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Icon name={it.isTicket ? 'ticket' : 'cart'} size={18} color={colors.textMuted} />
              )}
            </View>
            <View style={[styles.grow, { gap: 6 }]}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {it.name}
              </Text>
              {showState ? (
                <View
                  style={[
                    styles.pill,
                    styles.pillLeft,
                    { backgroundColor: done ? colors.successMuted : partial ? colors.raised : colors.brandMuted },
                  ]}>
                  <Icon name={done ? 'check' : 'clock'} size={11} color={fg} />
                  <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.itemRight}>
              <Text style={styles.itemValue}>{formatMoney(it.subtotal)}</Text>
              <Text style={styles.cardMeta}>
                {it.quantity > 1 ? `${it.quantity} × ${formatMoney(it.price)}` : '1 unidad'}
              </Text>
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
    cardTitle: { color: c.text, fontSize: 15, ...font('medium') },
    cardMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },

    hero: { alignItems: 'center', gap: 6, paddingTop: Spacing.two },
    heroAvatar: { marginBottom: 6 },
    heroName: { color: c.textSecondary, fontSize: 15, fontFamily: Font.medium, maxWidth: '85%' },
    heroValue: {
      color: c.text,
      fontSize: 40,
      lineHeight: 46,
      ...font('medium'),
      fontVariant: ['tabular-nums'],
      letterSpacing: -1.2,
    },
    heroCancelled: { color: c.textMuted, textDecorationLine: 'line-through' },
    date: { color: c.textMuted, fontSize: 13, fontVariant: ['tabular-nums'], marginTop: 2 },
    headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    stepper: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 4 },
    step: { flex: 1, alignItems: 'center', gap: 8 },
    stepTrack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
    stepDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepLine: { flex: 1, height: 2, marginHorizontal: 4, borderRadius: 1, backgroundColor: c.border },
    stepLineHidden: { opacity: 0 },
    stepLabel: { color: c.text, fontSize: 12, ...font('medium') },

    section: { gap: 8 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontFamily: Font.medium, paddingHorizontal: 4 },
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
    contactActionText: { color: c.primary, fontSize: 13, fontFamily: Font.medium },

    item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    thumb: {
      width: 48,
      height: 48,
      borderRadius: Radius.md,
      borderCurve: 'continuous',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    itemRight: { alignItems: 'flex-end', gap: 2 },
    itemValue: { color: c.text, fontSize: 15, ...font('medium'), fontVariant: ['tabular-nums'] },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: Radius.pill,
    },
    pillLeft: { alignSelf: 'flex-start' },
    pillText: { fontSize: 11, fontFamily: Font.medium },

    payCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    payIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },

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
    actionText: { color: c.onInk, fontSize: 16, ...font('medium') },
    actionTextDanger: { color: c.danger },
    missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background, padding: 24 },
    missingText: { color: c.textSecondary, fontSize: 15, textAlign: 'center' },
  }),
);
