import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

import { setSelectedEventId } from '@/features/dashboard/selected-event';
import type { EventSummary } from '@/features/dashboard/types';
import { deleteEvent } from '@/lib/api/organizer';
import { invalidate } from '@/lib/query';

/** "2026-11-04T22:00:00" en hora local, sin zona (como guarda el backend `starts_at`). */
export function toLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

/**
 * Pide confirmación y elimina el evento (DELETE /api/events/<id>, solo el dueño).
 * Si era el seleccionado, el home pasa a otro. Resuelve true si se eliminó.
 */
export function confirmDeleteEvent(
  event: EventSummary,
  opts: { selectedId: string | null; events: EventSummary[] },
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Eliminar evento',
      `“${event.name}” se elimina con su catálogo, entradas y pedidos. No se puede deshacer.`,
      [
        { text: 'Volver', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteEvent(event.id);
            if (!res.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('No se pudo eliminar', res.error);
              resolve(false);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (opts.selectedId === event.id) {
              const next = opts.events.find((e) => e.id !== event.id);
              if (next) setSelectedEventId(next.id);
            }
            await invalidate('events');
            resolve(true);
          },
        },
      ],
    );
  });
}
