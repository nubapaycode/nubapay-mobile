import { requireOptionalNativeModule } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { apiFetch, authPaths, eventPaths } from '@/lib/api';
import { loadSession } from '@/lib/authSession';
import { EMPTY_PULSE, type EventPulseProps } from '@/widgets/types';

/**
 * Pulso del evento fuera de la app (iOS): widget de inicio y Live Activity.
 *
 * Los números vienen ya formateados del backend (`GET /events/<id>/live-pulse`), que también los
 * manda por APNs: así la Live Activity se actualiza con la app cerrada y nunca muestra dos
 * versiones distintas del mismo dato. Se sincroniza:
 * - con la app abierta, cada vez que carga el inicio (`useLivePulse`);
 * - en segundo plano, con un push silencioso del backend en cada venta y con una tarea periódica
 *   que iOS corre cuando le conviene (`syncPulse`, ver `background.ts`).
 *
 * `expo-widgets` es nativo y sus definiciones crean objetos nativos al importarse: solo se cargan
 * si el build trae el módulo.
 */
type WidgetMod = typeof import('@/widgets/EventPulseWidget');
type ActivityMod = typeof import('@/widgets/LiveEventActivity');
type WidgetsLib = typeof import('expo-widgets');
const native =
  Platform.OS === 'ios' && requireOptionalNativeModule('ExpoWidgets')
    ? {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        widget: (require('@/widgets/EventPulseWidget') as WidgetMod).default,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        activity: (require('@/widgets/LiveEventActivity') as ActivityMod).default,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        lib: require('expo-widgets') as WidgetsLib,
      }
    : null;

export const hasLivePulse = !!native;

type Pulse = { props: EventPulseProps; live: boolean; ends_at: string | null };

/** Evento que muestran el widget y la Live Activity (para la tarea en segundo plano). */
const EVENT_KEY = 'nubapay.pulseEvent';
const canStore = Platform.OS !== 'web';

/**
 * Tokens de APNs ya enviados al backend: en memoria para no repetir, y guardados para poder darlos
 * de baja al cerrar sesión aunque la app se haya reiniciado desde que se registraron.
 */
const sentTokens = new Set<string>();
const TOKENS_KEY = 'nubapay.liveTokens';

async function storedTokens(): Promise<string[]> {
  if (!canStore) return [];
  try {
    const raw = await SecureStore.getItemAsync(TOKENS_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

async function rememberToken(token: string) {
  if (!canStore) return;
  const list = await storedTokens();
  if (list.includes(token)) return;
  // Los tokens rotan: con los últimos 20 alcanza.
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify([...list, token].slice(-20))).catch(() => {});
}

/** Todos los tokens de Live Activity de este teléfono (memoria + guardados). */
export async function liveActivityTokens(): Promise<string[]> {
  return [...new Set([...sentTokens, ...(await storedTokens())])];
}

async function sendToken(token: string, kind: 'update' | 'start', eventId?: string, auth?: string | null) {
  if (sentTokens.has(token)) return;
  const res = await apiFetch(authPaths.liveActivityToken(), {
    method: 'POST',
    body: JSON.stringify({ token, kind, event_id: eventId }),
    ...(auth !== undefined ? { token: auth } : {}),
  });
  if (res.ok) {
    sentTokens.add(token);
    await rememberToken(token);
  }
}

// Token "push-to-start" del teléfono (iOS 17.2+): con él el backend puede abrir la Live Activity
// cuando entra una venta aunque la app esté cerrada. Llega solo, en cualquier momento.
let pendingStart: string | null = null;
native?.lib.addPushToStartTokenListener((e) => {
  pendingStart = e.activityPushToStartToken;
  loadSession()
    .then(({ token }) => (token ? sendToken(e.activityPushToStartToken, 'start', undefined, token) : undefined))
    .catch(() => {});
});

/** Con sesión recién iniciada: manda el push-to-start que haya llegado antes de entrar. */
export function flushStartToken() {
  if (pendingStart) sendToken(pendingStart, 'start').catch(() => {});
}

/** Registra el token de cada Live Activity abierta (y los que lleguen después) para este evento. */
function trackActivityTokens(eventId: string, auth?: string | null) {
  if (!native) return;
  for (const a of native.activity.getInstances()) {
    a.getPushToken()
      .then((t) => (t ? sendToken(t, 'update', eventId, auth) : undefined))
      .catch(() => {});
    a.addPushTokenListener((e) => {
      sendToken(e.pushToken, 'update', eventId, auth).catch(() => {});
    });
  }
}

function apply(eventId: string, pulse: Pulse, auth?: string | null) {
  if (!native) return;
  native.widget.updateSnapshot(pulse.props);
  const running = native.activity.getInstances();
  if (pulse.live) {
    if (running.length) {
      running.forEach((a) => a.update(pulse.props).catch(() => {}));
    } else {
      // Se da por vieja al terminar el evento (hora local de Argentina, UTC−3).
      const stale = pulse.ends_at ? new Date(`${pulse.ends_at}-03:00`) : undefined;
      native.activity.start(pulse.props, 'nubapaybusiness://', stale);
    }
    trackActivityTokens(eventId, auth);
  } else {
    running.forEach((a) => a.end('default', pulse.props).catch(() => {}));
  }
}

/**
 * Trae el pulso y actualiza widget + Live Activity. Sirve sin la UI montada (segundo plano): lee la
 * sesión y el evento guardados. Devuelve false si no pudo.
 */
export async function syncPulse(eventId?: string | null): Promise<boolean> {
  if (!native) return false;
  try {
    const { token } = await loadSession();
    if (!token) return false;
    const id = eventId ?? (canStore ? await SecureStore.getItemAsync(EVENT_KEY) : null);
    if (!id) return false;
    const res = await apiFetch<Pulse>(eventPaths.livePulse(id), { token });
    if (!res.ok) return false;
    apply(id, res.data, token);
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[live-pulse]', e);
    return false;
  }
}

/**
 * Con la app abierta: sincroniza cada vez que cambian los datos del inicio (`version`) y recuerda
 * el evento para la tarea en segundo plano.
 */
export function useLivePulse(eventId: string | null, version: string | null) {
  useEffect(() => {
    if (!native || !eventId || !version) return;
    if (canStore) SecureStore.setItemAsync(EVENT_KEY, eventId).catch(() => {});
    syncPulse(eventId);
  }, [eventId, version]);
}

/** Al cerrar sesión: se cierra la Live Activity, el widget vuelve al estado vacío y se olvidan los tokens. */
export async function clearPulse() {
  sentTokens.clear();
  pendingStart = null;
  if (canStore) {
    await SecureStore.deleteItemAsync(TOKENS_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(EVENT_KEY).catch(() => {});
  }
  if (!native) return;
  try {
    native.activity.getInstances().forEach((a) => a.end('immediate').catch(() => {}));
    native.widget.updateSnapshot(EMPTY_PULSE);
  } catch {
    // Nada que limpiar.
  }
}
