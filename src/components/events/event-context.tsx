import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/dashboard/icon';
import { LivePill } from '@/components/dashboard/live-pill';
import { DisplayFont, Radius } from '@/constants/theme';
import { eventPhase, formatEventDate, initials, PHASE_LABEL } from '@/features/dashboard/format';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { useEvents } from '@/features/dashboard/use-event-dashboard';
import { makeStyles, useTheme } from '@/theme';

/**
 * De qué evento es lo que se está viendo/editando: portada (o iniciales), "{caption}", nombre y
 * estado. "Cambiar" abre el selector de evento; la pantalla se actualiza con el nuevo.
 */
export function EventContext({ caption = 'Evento' }: { caption?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { events } = useEvents();
  const selectedId = useSelectedEventId();
  const event = events?.find((e) => e.id === selectedId);
  if (!event) return <View style={styles.placeholder} />;

  const phase = eventPhase(event);
  const date = event.starts_at ? formatEventDate(event.starts_at) : null;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push('/switch-event');
      }}
      accessibilityRole="button"
      accessibilityLabel={`${caption}: ${event.name}. Cambiar evento`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <View style={styles.thumb}>
        {event.cover_image_url ? (
          <Image
            source={{ uri: event.cover_image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Text style={styles.thumbText}>{initials(event.name)}</Text>
        )}
      </View>
      <View style={styles.texts}>
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {event.name}
        </Text>
        <View style={styles.statusRow}>
          {phase === 'live' ? <LivePill compact /> : null}
          <Text style={[styles.status, phase === 'live' && { color: colors.brandText }]} numberOfLines={1}>
            {PHASE_LABEL[phase]}
            {date && phase !== 'live' ? ` · ${date}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.change}>
        <Text style={styles.changeText}>Cambiar</Text>
        <Icon name="chevronUpDown" size={10} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

const THUMB = 48;

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    placeholder: { height: 74 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: Radius.md,
      borderCurve: 'continuous',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    thumbText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    texts: { flex: 1, gap: 1 },
    caption: { color: c.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
    name: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    status: { color: c.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'], flexShrink: 1 },
    change: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 28,
      paddingHorizontal: 10,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    changeText: { color: c.text, fontSize: 12, fontWeight: '600' },
  }),
);
