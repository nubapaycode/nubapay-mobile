import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/dashboard/icon';
import { PaymentMethodIcon } from '@/components/dashboard/payment-method-icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { formatMoney, initials, PAYMENT_LABEL } from '@/features/dashboard/format';
import { orderKind, orderState, type OperationTone } from '@/features/operations/operations';
import type { Order } from '@/lib/api/organizer';
import type { Palette } from '@/theme';
import { makeStyles, useTheme } from '@/theme';

const KIND_ICON: Record<ReturnType<typeof orderKind>, IconName> = {
  tickets: 'ticket',
  products: 'cart',
  mixed: 'receipt',
};
const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };

export function toneColors(tone: OperationTone, c: Palette) {
  if (tone === 'danger') return { fg: c.danger, bg: c.dangerMuted };
  if (tone === 'success') return { fg: c.success, bg: c.successMuted };
  if (tone === 'attention') return { fg: c.brandText, bg: c.brandMuted };
  return { fg: c.textSecondary, bg: c.raised };
}

export function StatusChip({ order }: { order: Order }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const s = orderState(order);
  const t = toneColors(s.tone, colors);
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      <View style={[styles.chipDot, { backgroundColor: t.fg }]} />
      <Text style={[styles.chipText, { color: t.fg }]}>{s.label}</Text>
    </View>
  );
}

const clock = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Pedido en su propia card (estilo movimientos de Revolut): avatar del cliente con el tipo de compra
 * en la esquina, nombre, número y qué compró; monto y hora a la derecha; abajo el estado y el medio.
 */
export function OperationCard({ order: o, onPress }: { order: Order; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cancelled = o.status === 'cancelled';
  const kind = orderKind(o);
  const name = o.customerName || o.customerEmail || 'Sin nombre';
  const summary = o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ');

  return (
    <Animated.View style={press}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPress();
        }}
        onPressIn={() => scale.set(withTiming(0.98, PRESS))}
        onPressOut={() => scale.set(withTiming(1, PRESS))}
        accessibilityRole="button"
        accessibilityLabel={`Pedido ${o.orderNumber ?? ''}, ${name}, ${formatMoney(o.total)}, ${
          orderState(o).label
        }. Ver detalle`}
        style={[styles.card, cancelled && styles.cardCancelled]}>
        <View style={styles.top}>
          <View>
            <View style={styles.avatar}>
              {o.customerName ? (
                <Text style={styles.avatarText}>{initials(o.customerName)}</Text>
              ) : (
                <Icon name="person" size={18} color={colors.textMuted} />
              )}
            </View>
            <View style={[styles.kind, kind !== 'tickets' && { backgroundColor: colors.primary }]}>
              <Icon
                name={KIND_ICON[kind]}
                size={9}
                color={kind !== 'tickets' ? colors.onPrimary : colors.onInk}
              />
            </View>
          </View>

          <View style={styles.grow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {o.orderNumber ? <Text style={styles.number}>#{o.orderNumber} · </Text> : null}
              {summary}
            </Text>
          </View>

          <View style={styles.right}>
            <Text style={[styles.amount, cancelled && styles.amountCancelled]}>
              {formatMoney(o.total)}
            </Text>
            <Text style={styles.meta}>{clock(o.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <StatusChip order={o} />
          {o.paymentMethod ? (
            <View style={styles.method}>
              <PaymentMethodIcon method={o.paymentMethod} size={11} />
              <Text style={styles.methodText}>{PAYMENT_LABEL[o.paymentMethod]}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Icon name="chevronRight" size={12} color={colors.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const AVATAR = 42;

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      gap: 12,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
      boxShadow: c.cardShadowSubtle,
    },
    cardCancelled: { opacity: 0.7 },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    grow: { flex: 1, gap: 3 },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    avatarText: { color: c.text, fontSize: 14, fontWeight: '700' },
    kind: {
      position: 'absolute',
      right: -3,
      bottom: -3,
      width: 19,
      height: 19,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.ink,
      borderWidth: 2,
      borderColor: c.surface,
    },
    name: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    meta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    number: { color: c.textSecondary, fontWeight: '600' },
    right: { alignItems: 'flex-end', gap: 3 },
    amount: { color: c.text, fontSize: 16, fontFamily: DisplayFont.bold, fontVariant: ['tabular-nums'] },
    amountCancelled: { color: c.textMuted, textDecorationLine: 'line-through' },
    bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      height: 22,
      borderRadius: Radius.pill,
    },
    chipDot: { width: 6, height: 6, borderRadius: 3 },
    chipText: { fontSize: 11, fontWeight: '700' },
    method: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      height: 22,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    methodText: { color: c.textSecondary, fontSize: 11, fontWeight: '600' },
  }),
);
