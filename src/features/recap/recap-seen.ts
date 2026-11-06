import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * El resumen del evento se abre solo una vez, al entrar al inicio después de que terminó. Qué
 * eventos ya lo mostraron queda guardado en el teléfono (sobrevive a reiniciar la app); después
 * se vuelve a ver desde la card "Así fue…".
 */
const canStore = Platform.OS !== 'web';
const key = (eventId: string) => `nubapay.recapSeen.${eventId}`;

/** Solo se abre solo si el evento terminó hace menos de esto (no saltan resúmenes viejos). */
export const AUTO_RECAP_WINDOW_MS = 3 * 24 * 3_600_000;

export async function hasSeenRecap(eventId: string): Promise<boolean> {
  if (!canStore) return true;
  try {
    return (await SecureStore.getItemAsync(key(eventId))) === '1';
  } catch {
    return true;
  }
}

export async function markRecapSeen(eventId: string): Promise<void> {
  if (!canStore) return;
  await SecureStore.setItemAsync(key(eventId), '1').catch(() => {});
}

/**
 * Cuándo terminó el evento (hora local de Argentina sin zona, como guarda el backend): `ends_at`
 * o, sin él, 12 h después del inicio (la misma regla que `eventPhase`).
 */
export function eventEndedAt(e: { starts_at: string | null; ends_at: string | null }): Date | null {
  if (e.ends_at) return new Date(e.ends_at);
  if (e.starts_at) return new Date(new Date(e.starts_at).getTime() + 12 * 3_600_000);
  return null;
}
