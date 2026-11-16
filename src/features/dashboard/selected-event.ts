import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const LAST_KEY = 'nubapay.lastEventId';
const canStore = Platform.OS !== 'web';

/** Evento activo del home. Estado de módulo: lo comparten el home y la hoja de selección. */
let selectedId: string | null = null;
const listeners = new Set<() => void>();

export function setSelectedEventId(id: string) {
  if (id === selectedId) return;
  selectedId = id;
  listeners.forEach((l) => l());
  // Se recuerda para que el próximo ingreso abra en el último evento usado.
  if (canStore) SecureStore.setItemAsync(LAST_KEY, id).catch(() => {});
}

/** Último evento usado (guardado en el teléfono); null si no hay. */
export async function loadLastEventId(): Promise<string | null> {
  if (!canStore) return null;
  try {
    return await SecureStore.getItemAsync(LAST_KEY);
  } catch {
    return null;
  }
}

/** Al cerrar sesión: se olvida la selección en memoria (la guardada sirve para el próximo ingreso). */
export function resetSelectedEvent() {
  if (selectedId === null) return;
  selectedId = null;
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
