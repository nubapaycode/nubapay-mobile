import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { formatMoney, PAYMENT_LABEL, relativeTime } from '@/features/dashboard/format';
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

/** Pedido en su propia tarjeta: número, cliente, qué compró, monto, hora, estado y medio de pago. */
export function OperationCard({ order: o, now, onPress }: { order: Order; now: number; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cancelled = o.status === 'cancelled';
  const kind = orderKind(o);

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
        accessibilityLabel={`Pedido ${o.orderNumber ?? ''}, ${o.customerName ?? ''}, ${formatMoney(o.total)}. Ver detalle`}
        style={styles.card}>
        <View style={styles.top}>
          <View style={[styles.icon, kind !== 'tickets' && styles.iconSale]}>
            <Icon name={KIND_ICON[kind]} size={15} color={kind !== 'tickets' ? colors.primary : '#000000'} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title} numberOfLines={1}>
              Pedido{o.orderNumber ? <Text style={styles.number}> #{o.orderNumber}</Text> : null}
            </Text>
            <Text style={styles.customer} numberOfLines={1}>
              {o.customerName || o.customerEmail || 'Sin nombre'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={[styles.amount, cancelled && styles.amountCancelled]}>{formatMoney(o.total)}</Text>
            <Text style={styles.time}>{relativeTime(o.createdAt, now)}</Text>
          </View>
        </View>

        <Text style={styles.summary} numberOfLines={1}>
          {o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
        </Text>

        <View style={styles.bottom}>
          <StatusChip order={o} />
          {o.paymentMethod ? <Text style={styles.payment}>{PAYMENT_LABEL[o.paymentMethod]}</Text> : null}
          <View style={{ flex: 1 }} />
          <Icon name="chevronRight" size={12} color={colors.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      gap: 12,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    iconSale: { backgroundColor: 'rgba(0, 105, 255, 0.08)' },
    title: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    number: { color: c.textMuted, fontSize: 14 },
    customer: { color: c.textSecondary, fontSize: 13 },
    amount: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold, fontVariant: ['tabular-nums'] },
    amountCancelled: { color: c.textMuted, textDecorationLine: 'line-through' },
    time: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    summary: { color: c.textMuted, fontSize: 13 },
    bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 22, borderRadius: 7 },
    chipDot: { width: 5, height: 5, borderRadius: 3 },
    chipText: { fontSize: 11, fontWeight: '700' },
    payment: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
  }),
);
