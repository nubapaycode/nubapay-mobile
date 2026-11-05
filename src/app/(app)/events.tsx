import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enter, enterRow } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { AddEventButton } from '@/components/events/add-event-button';
import { EventCard } from '@/components/events/event-card';
import { DisplayFont, Spacing } from '@/constants/theme';
import { eventPhase } from '@/features/dashboard/format';
import { setSelectedEventId, useSelectedEventId } from '@/features/dashboard/selected-event';
import type { EventPhase, EventSummary } from '@/features/dashboard/types';
import { useEvents } from '@/features/dashboard/use-event-dashboard';
import { useEventAccess } from '@/features/access/access';
import { openAddEvent } from '@/features/events/add-event';
import { confirmDeleteEvent } from '@/features/events/event-actions';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';

const GROUPS: { phase: EventPhase; title: string }[] = [
  { phase: 'live', title: 'En vivo' },
  { phase: 'upcoming', title: 'Próximos' },
  { phase: 'ended', title: 'Finalizados' },
  { phase: 'unscheduled', title: 'Sin fecha' },
];

/**
 * Página de eventos: todos los eventos agrupados por estado, crear uno nuevo y deslizar a la
 * izquierda para editar o eliminar. Tocar un evento lo selecciona y vuelve al home.
 */
export default function EventsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { events } = useEvents();
  const selectedId = useSelectedEventId();
  const [openId, setOpenId] = useState<string | null>(null);
  const { canCreateEvents } = useEventAccess();
  useFocusStatusBar();

  const all = events ?? [];
  const groups = GROUPS.map((g) => ({
    ...g,
    items: all.filter((e) => eventPhase(e) === g.phase),
  })).filter((g) => g.items.length > 0);

  const select = (e: EventSummary) => {
    Haptics.selectionAsync();
    setSelectedEventId(e.id);
    router.back();
  };

  let row = 0;
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: canCreateEvents
            ? () => (
                <Pressable
                  onPress={openAddEvent}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Agregar evento"
                  style={({ pressed }) => [styles.headerAdd, pressed && { opacity: 0.5 }]}>
                  <Icon name="plus" size={14} color={colors.ink} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        // Al scrollear se cierra la tarjeta deslizada.
        onScrollBeginDrag={() => setOpenId(null)}>
        <Animated.View entering={enter(0)} style={styles.summary}>
          <Text style={styles.count}>{all.length}</Text>
          <Text style={styles.countLabel}>
            {all.length === 1 ? 'evento' : 'eventos'} · deslizá a la izquierda para eliminar
          </Text>
        </Animated.View>

        {groups.map((g) => (
          <View key={g.phase} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>{g.title}</Text>
              <Text style={styles.groupCount}>{g.items.length}</Text>
            </View>
            <View style={styles.list}>
              {g.items.map((e) => (
                <Animated.View key={e.id} entering={enterRow(row++)}>
                  <EventCard
                    event={e}
                    selected={e.id === selectedId}
                    onSelect={() => select(e)}
                    swipe={{
                      open: openId === e.id,
                      onOpenChange: (open) => setOpenId(open ? e.id : null),
                      onEdit: () => {
                        setOpenId(null);
                        router.push({ pathname: '/edit-event/[id]', params: { id: e.id } });
                      },
                      onDelete: () => {
                        setOpenId(null);
                        confirmDeleteEvent(e, { selectedId, events: all });
                      },
                    }}
                  />
                </Animated.View>
              ))}
            </View>
          </View>
        ))}

        <AddEventButton />
      </ScrollView>
    </>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
    summary: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
    count: {
      color: c.text,
      fontSize: 28,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.8,
      fontVariant: ['tabular-nums'],
    },
    countLabel: { color: c.textMuted, fontSize: 13, flexShrink: 1 },
    group: { gap: 10 },
    groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
    groupTitle: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold },
    groupCount: { color: c.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
    list: { gap: 10 },
    headerAdd: {
      width: 30,
      height: 30,
      borderRadius: 10,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
  }),
);
