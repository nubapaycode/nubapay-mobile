import * as Haptics from 'expo-haptics';
import type { Href } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/dashboard/icon';
import { hasLinkPreview, PreviewLink } from '@/components/motion/preview-link';
import { SwipeActions } from '@/components/motion/swipe-actions';
import { ItemStack } from '@/components/operations/item-stack';
import { uiFont } from '@/constants/theme';
import { formatMoney } from '@/features/dashboard/format';
import { orderState, type OperationTone, type OrderStateKey } from '@/features/operations/operations';
import type { Order } from '@/lib/api/organizer';
import type { Palette } from '@/theme';
import { makeStyles, useTheme } from '@/theme';
import { Text } from '@/components/ui/text';

const CARD_RADIUS = 28;
const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };

/**
 * Colores del chip de estado: amarillo pendiente, verde pagado/entregado, rojo cancelado o rechazado.
 * Las letras amarilla y verde van oscurecidas para pasar 4.5:1 de contraste sobre su fondo.
 * En oscuro el fondo es el mismo color translúcido (los pasteles claros encandilan sobre negro).
 */
const TONE_HEX: Record<Exclude<OperationTone, 'neutral'>, { fg: string; bg: string }> = {
  attention: { fg: '#A06F00', bg: '#FEF8E6' },
  success: { fg: '#008A34', bg: '#E2FBDE' },
  danger: { fg: '#FF0000', bg: '#FFE5E5' },
};
/** En oscuro van los tonos vivos originales: sobre negro sí se leen. */
const TONE_DARK_FG: Record<Exclude<OperationTone, 'neutral'>, string> = {
  attention: '#FBC42B',
  success: '#00A83E',
  danger: '#FF4D4D',
};
const TONE_DARK_BG: Record<Exclude<OperationTone, 'neutral'>, string> = {
  attention: 'rgba(251, 196, 43, 0.16)',
  success: 'rgba(0, 168, 62, 0.18)',
  danger: 'rgba(255, 0, 0, 0.16)',
};

/**
 * Indicador de estado en la esquina de la card (círculo de color con ícono): verde los pagados (reloj
 * si falta retirar, tilde si ya se entregó), ámbar entrega parcial, ámbar/rojo las excepciones, que
 * además llevan chip con el nombre.
 */
const STATE_MARK: Record<OrderStateKey, { icon: IconName; color: (c: Palette) => string }> = {
  ready: { icon: 'clock', color: () => '#00A83E' },
  partial: { icon: 'chevronsRight', color: () => '#E8A800' },
  delivered: { icon: 'checkmark', color: () => '#00A83E' },
  unpaid: { icon: 'alert', color: () => '#E8A800' },
  rejected: { icon: 'close', color: () => '#FF3B30' },
  cancelled: { icon: 'close', color: () => '#FF3B30' },
};

export function toneColors(tone: OperationTone, c: Palette) {
  if (tone === 'neutral') return { fg: c.textSecondary, bg: c.raised };
  const t = TONE_HEX[tone];
  if (c.scheme === 'dark') return { fg: TONE_DARK_FG[tone], bg: TONE_DARK_BG[tone] };
  return t;
}

const clock = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Pedido en su propia card (referencia: Fuse), solo lo justo para ubicarlo: a la izquierda las fotos de
 * lo que compró apiladas como tarjetas; arriba número y hora, con el ícono de estado en la esquina
 * (y un chip con el nombre si es una excepción); abajo el nombre y el monto a la misma altura.
 * Lo demás (qué compró, medio de pago) queda en el detalle.
 */
export function OperationCard({
  order: o,
  photos,
  onPress,
  onDeliver,
  href,
  fresh = false,
}: {
  order: Order;
  /** Foto de cada producto por id (ver `useProductPhotos`). */
  photos?: Map<string, string | null>;
  onPress: () => void;
  /** Ruta del detalle: en iOS, mantener apretado muestra la vista previa con acciones. */
  href?: Href;
  /** Si se puede entregar: deslizar a la derecha lo hace (a la izquierda abre el detalle). */
  onDeliver?: () => void;
  /** Llegó recién (en vivo o al refrescar): la card brilla un momento para que se note. */
  fresh?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);
  const canDeliver = !!onDeliver;
  const tickets = o.items.every((i) => i.isTicket);

  useEffect(() => {
    if (!fresh) return;
    glow.set(
      withSequence(
        withDelay(240, withTiming(1, { duration: reduceMotion ? 1 : 260, easing: Easing.out(Easing.quad) })),
        withDelay(900, withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })),
      ),
    );
  }, [fresh, glow, reduceMotion]);

  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const cancelled = o.status === 'cancelled';
  const name = o.customerName || o.customerEmail || 'Sin nombre';
  const state = orderState(o);
  // Primero los ítems con foto, así la tarjeta de adelante muestra una si hay.
  const thumbs = o.items
    .map((i) => photos?.get(i.productId) ?? null)
    .sort((a, b) => Number(!a) - Number(!b));
  const stateTone = toneColors(state.tone, colors);

  return (
    <SwipeActions
      radius={CARD_RADIUS}
      start={
        onDeliver
          ? {
              label: tickets ? 'Registrar ingreso' : 'Entregar',
              icon: 'checkmark',
              onTrigger: onDeliver,
              tone: { soft: colors.successMuted, strong: colors.success, fg: colors.success, onStrong: '#ffffff' },
            }
          : undefined
      }
      end={{
        label: 'Ver pedido',
        icon: 'receipt',
        onTrigger: onPress,
        tone: { soft: colors.raised, strong: colors.ink, fg: colors.textSecondary, onStrong: colors.onInk },
      }}>
    <Animated.View style={press}>
      <PreviewLink
        href={href ?? '/'}
        actions={[
          ...(onDeliver
            ? [{ title: tickets ? 'Registrar ingreso' : 'Entregar', icon: 'checkmark.circle' as const, onPress: onDeliver }]
            : []),
          { title: 'Ver pedido', icon: 'receipt' as const, onPress },
        ]}
        disabled={!href}
        zoom>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          // Con vista previa navega el Link; acá solo el toque.
          if (!(href && hasLinkPreview)) onPress();
        }}
        onPressIn={() => scale.set(withTiming(0.98, PRESS))}
        onPressOut={() => scale.set(withTiming(1, PRESS))}
        accessibilityRole="button"
        accessibilityLabel={`Pedido ${o.orderNumber ?? ''}, ${name}, ${formatMoney(o.total)}, ${
          state.label
        }, ${clock(o.createdAt)}. Ver detalle`}
        accessibilityActions={canDeliver ? [{ name: 'deliver', label: tickets ? 'Registrar ingreso' : 'Entregar' }] : undefined}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'deliver' && onDeliver?.()}
        style={StyleSheet.flatten([styles.card, cancelled && styles.cardCancelled])}>
        <ItemStack photos={thumbs} />
        <View style={styles.grow}>
          <View style={[styles.line, styles.lineTop]}>
            <Text style={[styles.meta, styles.flex]} numberOfLines={1}>
              {o.orderNumber ? `#${o.orderNumber} · ` : ''}
              {clock(o.createdAt)}
            </Text>
            {state.exception ? (
              <View style={[styles.chip, { backgroundColor: stateTone.bg }]}>
                <Text style={[styles.state, { color: stateTone.fg }]} numberOfLines={1}>
                  {state.short}
                </Text>
              </View>
            ) : null}
            <View style={[styles.mark, { backgroundColor: STATE_MARK[state.key].color(colors) }]}>
              <Icon name={STATE_MARK[state.key].icon} size={8} color="#ffffff" />
            </View>
          </View>
          <View style={styles.line}>
            <Text style={[styles.name, styles.flex]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.amount, cancelled && styles.amountCancelled]}>{formatMoney(o.total)}</Text>
          </View>
        </View>
        <Icon name="chevronRight" size={13} color={colors.textMuted} />
      </Pressable>
      </PreviewLink>
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
    </Animated.View>
    </SwipeActions>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    glow: {
      ...StyleSheet.absoluteFill,
      borderRadius: CARD_RADIUS,
      borderCurve: 'continuous',
      borderWidth: 2,
      borderColor: c.brand,
      backgroundColor: c.brandMuted,
    },
    // Estilo Fuse: más redondeada, sin sombra, borde apenas visible y con aire.
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 28,
      paddingLeft: 20,
      paddingRight: 18,
      borderRadius: CARD_RADIUS,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.borderSubtle,
      backgroundColor: c.surface,
      boxShadow: c.cardShadowSmooth,
    },
    cardCancelled: { opacity: 0.7 },
    grow: { flex: 1, gap: 12 },
    line: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
    lineTop: { alignItems: 'center' },
    flex: { flex: 1 },
    mark: {
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chip: {
      height: 24,
      paddingHorizontal: 10,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    meta: { color: c.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
    state: { fontSize: 12, ...uiFont('600') },
    name: { color: c.text, fontSize: 18, letterSpacing: -0.2, ...uiFont('500') },
    amount: {
      color: c.text,
      fontSize: 17,
      fontVariant: ['tabular-nums'],
      ...uiFont('500'),
    },
    amountCancelled: { color: c.textMuted, textDecorationLine: 'line-through' },
  }),
);
