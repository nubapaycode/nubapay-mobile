import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DisplayFont, Spacing } from '@/constants/theme';
import { daysUntil, formatEventDate, initials } from '@/features/dashboard/format';
import type { EventPhase, EventSummary } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { Icon } from './icon';

const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };

type Props = {
  event: EventSummary | null;
  phase: EventPhase | null;
  userName: string | null;
  onOpenEvents: () => void;
  onOpenProfile: () => void;
};

/** Selector de evento como título (patrón Shopify "Analytics ▾") + estado del evento. */
export function DashboardHeader({ event, phase, userName, onOpenEvents, onOpenProfile }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const open = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpenEvents();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Animated.View style={[{ flex: 1 }, pressStyle]}>
          <Pressable
            onPress={open}
            onPressIn={() => scale.set(withTiming(0.97, PRESS))}
            onPressOut={() => scale.set(withTiming(1, PRESS))}
            accessibilityRole="button"
            accessibilityLabel={`Evento: ${event?.name ?? 'sin seleccionar'}. Cambiar evento`}
            style={styles.switcher}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {event?.name ?? 'Cargando…'}
              </Text>
              <Icon name="chevronDown" size={14} color={colors.textSecondary} />
            </View>
            {event && phase ? (
              <StatusLine event={event} phase={phase} />
            ) : (
              <View style={{ height: 22 }} />
            )}
          </Pressable>
        </Animated.View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onOpenProfile();
          }}
          accessibilityRole="button"
          accessibilityLabel="Perfil: cuenta, apariencia y cerrar sesión"
          style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{userName ? initials(userName) : '·'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Fecha del evento; antes y después del evento, también cuánto falta o que terminó. */
function StatusLine({ event, phase }: { event: EventSummary; phase: EventPhase }) {
  const styles = useStyles();
  const date = formatEventDate(event.starts_at);
  const label =
    phase === 'upcoming'
      ? (() => {
          const d = daysUntil(event.starts_at);
          return d <= 0 ? 'Empieza hoy' : d === 1 ? 'Empieza mañana' : `Faltan ${d} días`;
        })()
      : phase === 'ended'
        ? 'Finalizado'
        : phase === 'unscheduled'
          ? 'Sin fecha'
          : null;
  return (
    <View style={styles.status}>
      {label ? <Text style={styles.phaseText}>{label}</Text> : null}
      {phase !== 'unscheduled' ? (
        <Text style={styles.statusText}>
          {label ? '· ' : ''}
          {date}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: Spacing.three },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
    switcher: { gap: 8 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: {
      color: c.text,
      fontSize: 24,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.6,
      flexShrink: 1,
    },
    userAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
      marginTop: 2,
    },
    userAvatarText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
    status: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 },
    statusText: { color: c.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
    phaseText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  }),
);
