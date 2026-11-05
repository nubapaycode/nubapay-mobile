import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
import { daysUntil, formatEventDate, initials } from '@/features/dashboard/format';
import type { EventPhase, EventSummary } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { Icon } from './icon';
import { LivePill } from './live-pill';

const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };

type Props = {
  event: EventSummary | null;
  phase: EventPhase | null;
  userName: string | null;
  /** Cuántos filtros difieren del default (contador del botón). */
  filterCount: number;
  /** Sin permiso de métricas no hay nada que filtrar: se oculta el botón. */
  showFilters: boolean;
  onOpenEvents: () => void;
  onOpenProfile: () => void;
  onOpenFilters: () => void;
};

/**
 * Cabecera del inicio sobre el degradé: perfil a la izquierda, el selector de evento al centro
 * (miniatura, nombre y estado; abre la hoja para cambiarlo) y filtros a la derecha.
 */
export function PulseHeader({
  event,
  phase,
  userName,
  filterCount,
  showFilters,
  onOpenEvents,
  onOpenProfile,
  onOpenFilters,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onOpenProfile();
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Perfil: cuenta, apariencia y cerrar sesión"
        style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
        <Text style={styles.avatarText}>{userName ? initials(userName) : '·'}</Text>
      </Pressable>

      <EventSelector event={event} phase={phase} onPress={onOpenEvents} />

      {showFilters ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onOpenFilters();
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Filtros${filterCount ? `, ${filterCount} activos` : ''}`}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
          <Icon name="filter" size={17} color={colors.text} />
          {filterCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : (
        <View style={styles.roundSpacer} />
      )}
    </View>
  );
}

/** Botón del evento: portada (o iniciales), nombre y estado, con el indicador de cambio. */
function EventSelector({
  event,
  phase,
  onPress,
}: {
  event: EventSummary | null;
  phase: EventPhase | null;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const status = event && phase ? statusLabel(event, phase) : null;

  return (
    <Animated.View style={[styles.selectorSlot, pressStyle]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => scale.set(withTiming(0.97, PRESS))}
        onPressOut={() => scale.set(withTiming(1, PRESS))}
        accessibilityRole="button"
        accessibilityLabel={`Evento: ${event?.name ?? 'sin seleccionar'}${
          status ? `, ${status}` : ''
        }. Cambiar evento`}
        style={styles.selector}>
        <View style={styles.thumb}>
          {event?.cover_image_url ? (
            <Image
              source={{ uri: event.cover_image_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <Text style={styles.thumbText}>{event ? initials(event.name) : ''}</Text>
          )}
        </View>

        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {event?.name ?? 'Cargando…'}
          </Text>
          {status ? (
            <Animated.View key={status} entering={FadeIn.duration(180)} style={styles.statusRow}>
              {phase === 'live' ? <LivePill compact /> : null}
              <Text
                style={[styles.status, phase === 'live' && styles.statusLive]}
                numberOfLines={1}>
                {status}
              </Text>
            </Animated.View>
          ) : (
            <Text style={styles.status}>Elegí un evento</Text>
          )}
        </View>

        <View style={styles.chevron}>
          <Icon name="chevronUpDown" size={11} color={colors.textSecondary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** "En vivo"; antes, cuánto falta y la fecha; después, que terminó. */
function statusLabel(event: EventSummary, phase: EventPhase): string {
  if (phase === 'live') return 'En vivo';
  if (phase === 'unscheduled') return 'Sin fecha';
  const date = formatEventDate(event.starts_at);
  if (phase === 'ended') return `Finalizado · ${date}`;
  const d = daysUntil(event.starts_at);
  const when = d <= 0 ? 'Empieza hoy' : d === 1 ? 'Mañana' : `En ${d} días`;
  return `${when} · ${date}`;
}

const ROUND = 44;
const SELECTOR = 56;
const THUMB = 38;

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    round: {
      width: ROUND,
      height: ROUND,
      borderRadius: ROUND / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.hero.glass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hero.glassBorder,
    },
    roundSpacer: { width: ROUND, height: ROUND },
    pressed: { opacity: 0.7 },
    avatarText: { color: c.text, fontSize: 14, fontWeight: '700' },
    selectorSlot: { flex: 1 },
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: SELECTOR,
      paddingLeft: 9,
      paddingRight: 10,
      borderRadius: Radius.lg + 2,
      backgroundColor: c.hero.glass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hero.glassBorder,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: Radius.md,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    thumbText: { color: c.onPrimary, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
    texts: { flex: 1, gap: 2 },
    name: { color: c.text, fontSize: 15, fontWeight: '600' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    status: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
      flexShrink: 1,
    },
    statusLive: { color: c.brandText, fontWeight: '700' },
    chevron: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.hero.glassBorder,
    },
    badge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    badgeText: { color: c.onPrimary, fontSize: 10, fontWeight: '700' },
  }),
);
