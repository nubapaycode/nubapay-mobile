import { useSyncExternalStore } from 'react';

/** Evento activo del home. Estado de módulo: lo comparten el home y la hoja de selección. */
let selectedId: string | null = null;
const listeners = new Set<() => void>();

export function setSelectedEventId(id: string) {
  if (id === selectedId) return;
  selectedId = id;
  listeners.forEach((l) => l());
}

export function useSelectedEventId(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selectedId,
  );
}
