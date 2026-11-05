import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enterRow } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { AddEventButton } from '@/components/events/add-event-button';
import { EventCard } from '@/components/events/event-card';
import { Sheet, useSheet } from '@/components/ui/sheet';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { setSelectedEventId, useSelectedEventId } from '@/features/dashboard/selected-event';
import { useEvents } from '@/features/dashboard/use-event-dashboard';
import { confirmDeleteEvent } from '@/features/events/event-actions';
import { makeStyles, useTheme } from '@/theme';

/** Cuántos eventos entran en la hoja; el resto está en la página de eventos. */
const VISIBLE = 3;

/**
 * Hoja para cambiar de evento: hasta 3 eventos (el seleccionado siempre incluido), el acceso a la
 * página con todos y el botón para agregar uno. Deslizar una tarjeta revela Editar y Eliminar.
 */
export default function SwitchEventSheet() {
  return (
    <Sheet>
      <SwitchEventContent />
    </Sheet>
  );
}

function SwitchEventContent() {
  const styles = useStyles();
  const { dismiss } = useSheet();
  const { colors } = useTheme();
  const { events } = useEvents();
  const selectedId = useSelectedEventId();
  const [openId, setOpenId] = useState<string | null>(null);
  const all = events ?? [];

  const selected = all.find((e) => e.id === selectedId);
  const visible = [
    ...(selected ? [selected] : []),
    ...all.filter((e) => e.id !== selectedId),
  ].slice(0, VISIBLE);
  const hidden = all.length - visible.length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tus eventos</Text>

      <View style={styles.list}>
        {visible.map((e, i) => (
          <Animated.View key={e.id} entering={enterRow(i)}>
            <EventCard
              event={e}
              selected={e.id === selectedId}
              onSelect={() => {
                Haptics.selectionAsync();
                setSelectedEventId(e.id);
                dismiss();
              }}
              swipe={{
                open: openId === e.id,
                onOpenChange: (open) => setOpenId(open ? e.id : null),
                // Cerrar la hoja y abrir la edición encima del home.
                onEdit: () =>
                  dismiss(() =>
                    router.push({ pathname: '/edit-event/[id]', params: { id: e.id } }),
                  ),
                onDelete: () => {
                  setOpenId(null);
                  confirmDeleteEvent(e, { selectedId, events: all });
                },
              }}
            />
          </Animated.View>
        ))}
      </View>

      {hidden > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver todos los eventos, ${all.length} en total`}
          onPress={() => {
            Haptics.selectionAsync();
            // Cerrar la hoja (con su animación) y recién después abrir la página completa.
            dismiss(() => router.push('/events'));
          }}
          style={({ pressed }) => [styles.more, pressed && { backgroundColor: colors.raised }]}>
          <Text style={styles.moreText}>Ver todos los eventos</Text>
          <View style={styles.moreCount}>
            <Text style={styles.moreCountText}>{all.length}</Text>
          </View>
          <Icon name="chevronRight" size={12} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <AddEventButton onPress={() => dismiss(() => router.push('/new-event'))} />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flexGrow: 0 },
    content: { padding: Spacing.three, paddingTop: Spacing.two, gap: 12 },
    title: {
      color: c.text,
      fontSize: 22,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
      paddingHorizontal: 4,
      marginBottom: 4,
    },
    list: { gap: 10 },
    more: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 50,
      paddingHorizontal: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.canvas,
    },
    moreText: { flex: 1, color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    moreCount: {
      minWidth: 24,
      height: 22,
      paddingHorizontal: 7,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    moreCountText: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
  }),
);
