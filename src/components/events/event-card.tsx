import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { daysUntil, eventPhase, formatEventDate, PHASE_LABEL } from '@/features/dashboard/format';
import type { EventSummary } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

/** Ancho de cada acción revelada detrás de la tarjeta (Editar y Eliminar). */
const BTN_W = 78;
const GAP = 8;
const ACTION_W = BTN_W * 2 + GAP * 2;
const SNAP = { duration: 260, easing: Easing.out(Easing.cubic) };
const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };

type Props = {
  event: EventSummary;
  selected: boolean;
  onSelect: () => void;
  /**
   * Deslizar a la izquierda revela "Editar" y "Eliminar" (solo para dueños).
   * `open` indica si es la tarjeta abierta: hay una sola a la vez.
   */
  swipe?: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onEdit: () => void;
    onDelete: () => void;
  };
};

/**
 * Tarjeta de evento: nombre, fecha y estado, con selección tipo radio.
 * Con `swipe`, se desliza a la izquierda para editar o eliminar: pasada la mitad (o con un gesto rápido)
 * queda abierta; si no, vuelve. Sin rebote.
 */
export function EventCard({ event, selected, onSelect, swipe }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const status = statusFor(event);
  const canSwipe = !!swipe && event.membership !== 'staff';
  const open = swipe?.open ?? false;

  const tx = useSharedValue(0);
  const start = useSharedValue(0);
  const scale = useSharedValue(1);

  // Otra tarjeta se abrió (o se pidió cerrar desde afuera): volver a su lugar.
  useEffect(() => {
    tx.set(withTiming(open ? -ACTION_W : 0, SNAP));
  }, [open, tx]);

  const notify = (next: boolean) => {
    if (next) Haptics.selectionAsync();
    swipe?.onOpenChange(next);
  };

  const pan = usePanGesture({
    enabled: canSwipe,
    activeOffsetX: [-10, 10],
    failOffsetY: [-12, 12],
    onActivate: () => {
      'worklet';
      start.set(tx.get());
    },
    onUpdate: (e) => {
      'worklet';
      const next = start.get() + e.translationX;
      // Hacia la derecha no se mueve; más allá de la acción, resistencia (se estira a un tercio).
      tx.set(next > 0 ? 0 : next < -ACTION_W ? -ACTION_W + (next + ACTION_W) / 3 : next);
    },
    onDeactivate: (e) => {
      'worklet';
      const shouldOpen = e.velocityX < -500 || (e.velocityX < 500 && tx.get() < -ACTION_W / 2);
      tx.set(withTiming(shouldOpen ? -ACTION_W : 0, SNAP));
      scheduleOnRN(notify, shouldOpen);
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { scale: scale.value }],
  }));
  // La acción aparece a medida que se descubre (fundido + leve escala).
  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-tx.value, [0, ACTION_W * 0.6], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(-tx.value, [0, ACTION_W], [0.85, 1], 'clamp') }],
  }));

  return (
    <View>
      {canSwipe ? (
        <View style={styles.actionTrack}>
          <Animated.View style={[styles.actionInner, actionStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Editar ${event.name}`}
              onPress={() => {
                Haptics.selectionAsync();
                swipe?.onEdit();
              }}
              style={({ pressed }) => [styles.action, styles.edit, pressed && { opacity: 0.8 }]}>
              <Icon name="pencil" size={17} color="#000000" />
              <Text style={[styles.actionText, { color: '#000000' }]}>Editar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eliminar ${event.name}`}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                swipe?.onDelete();
              }}
              style={({ pressed }) => [styles.action, styles.delete, pressed && { opacity: 0.8 }]}>
              <Icon name="trash" size={17} color="#ffffff" />
              <Text style={styles.actionText}>Eliminar</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}

      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${event.name}, ${status.label}, ${formatEventDate(event.starts_at)}`}
            accessibilityHint={canSwipe ? 'Deslizá a la izquierda para editar o eliminar' : undefined}
            onPressIn={() => scale.set(withTiming(0.98, PRESS))}
            onPressOut={() => scale.set(withTiming(1, PRESS))}
            onPress={() => (open ? swipe?.onOpenChange(false) : onSelect())}
            style={[styles.card, selected && styles.cardSelected]}>
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {event.name}
              </Text>
              <View style={styles.metaRow}>
                <Chip label={status.label} live={status.live} />
                <Text style={styles.date} numberOfLines={1}>
                  {formatEventDate(event.starts_at)}
                </Text>
                {event.membership === 'staff' ? (
                  <Text style={styles.staff} numberOfLines={1}>
                    · Staff
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.radio, selected && styles.radioOn]}>
              {selected ? <Icon name="checkmark" size={11} color={colors.onPrimary} /> : null}
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Estado del evento: "En vivo" destacado en lima; el resto neutro. */
function statusFor(event: EventSummary): { label: string; live: boolean } {
  const phase = eventPhase(event);
  if (phase === 'live') return { label: 'En vivo', live: true };
  if (phase === 'upcoming') {
    const d = daysUntil(event.starts_at);
    return {
      label: d <= 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d} días`,
      live: false,
    };
  }
  return { label: PHASE_LABEL[phase], live: false };
}

function Chip({ label, live }: { label: string; live: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.chip, live && styles.chipLive]}>
      <Text style={[styles.chipText, live && styles.chipTextLive]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    actionTrack: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
      width: ACTION_W,
    },
    actionInner: { flex: 1, flexDirection: 'row', gap: GAP, paddingLeft: GAP },
    action: {
      width: BTN_W,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
    },
    edit: { backgroundColor: c.raised },
    delete: { backgroundColor: c.danger },
    actionText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    cardSelected: { borderColor: c.primary, backgroundColor: 'rgba(0, 105, 255, 0.035)' },

    body: { flex: 1, gap: 8 },
    name: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold, letterSpacing: -0.3 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    date: { color: c.textMuted, fontSize: 13, fontVariant: ['tabular-nums'], flexShrink: 1 },
    staff: { color: c.textMuted, fontSize: 13 },
    chip: {
      paddingHorizontal: 8,
      height: 22,
      justifyContent: 'center',
      borderRadius: 7,
      backgroundColor: c.raised,
    },
    chipLive: { backgroundColor: c.brandMuted },
    chipText: { color: c.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.1 },
    chipTextLive: { color: c.brandText },

    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: c.primary, backgroundColor: c.primary },
  }),
);
