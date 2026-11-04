import { useSyncExternalStore } from 'react';

import type { DashboardFilters } from './filters';
import type { DashboardData } from './types';

/**
 * Última respuesta del dashboard del evento activo. La escribe el home y la leen las pantallas de
 * detalle: así comparten los mismos datos (y las actualizaciones en vivo) sin volver a pedirlos.
 */
export type DashboardSnapshot = {
  eventId: string;
  filters: DashboardFilters;
  data: DashboardData;
  updatedAt: number;
};

let snapshot: DashboardSnapshot | null = null;
const listeners = new Set<() => void>();

export function publishDashboardSnapshot(next: DashboardSnapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

export function useDashboardSnapshot(): DashboardSnapshot | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}
