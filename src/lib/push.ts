import { requireOptionalNativeModule } from 'expo';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { setSelectedEventId } from '@/features/dashboard/selected-event';
import { clearPulse, liveActivityTokens } from '@/features/live/live-pulse';
import { apiFetch, authPaths } from '@/lib/api';

/**
 * Notificaciones push del organizador (pedido en efectivo para aprobar, hitos de aforo). Las manda
 * el backend directo a Apple (APNs, services/push_notifications.py) con el token del dispositivo:
 * no hace falta cuenta ni proyecto de Expo. Por ahora solo iOS (Android necesitaría Firebase).
 *
 * `expo-notifications` es nativo: sin el módulo en el build todo esto no hace nada.
 */
type NotificationsModule = typeof import('expo-notifications');
const Notifications: NotificationsModule | null = requireOptionalNativeModule('ExpoPushTokenManager')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-notifications') as NotificationsModule)
  : null;

// Con la app abierta también se muestran (banner + sonido), como en Mail.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let registered: string | null = null;

/** Token de APNs del teléfono (hexadecimal). Solo iOS. */
async function deviceToken(): Promise<string | null> {
  if (!Notifications || Platform.OS !== 'ios') return null;
  const t = await Notifications.getDevicePushTokenAsync();
  return typeof t.data === 'string' ? t.data : null;
}

/** Pide permiso (la primera vez), obtiene el token de APNs del teléfono y lo guarda en el backend. */
export async function registerPush(): Promise<void> {
  if (!Notifications || registered || Platform.OS !== 'ios') return;
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;

    const token = await deviceToken();
    if (!token) return;
    const res = await apiFetch<{ ok: true }>(authPaths.pushToken(), {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    if (res.ok) registered = token;
  } catch (e) {
    if (__DEV__) console.warn('[push] No se pudo registrar', e);
  }
}

/**
 * Al cerrar sesión: el backend deja de mandarle avisos a este teléfono. No depende de lo que quedó
 * en memoria (la app pudo reiniciarse desde que se registró): vuelve a pedir el token de APNs del
 * dispositivo y lee los de Live Activity guardados. Va antes de borrar la sesión, porque el backend
 * pide el token de sesión para dar de baja.
 */
export async function unregisterPush(): Promise<void> {
  let token = registered;
  registered = null;
  if (!token && Notifications) {
    try {
      if ((await Notifications.getPermissionsAsync()).granted) token = await deviceToken();
    } catch {
      // Sin token no hay nada que dar de baja en este teléfono.
    }
  }
  const live = await liveActivityTokens();
  if (token || live.length) {
    const res = await apiFetch(authPaths.pushToken(), {
      method: 'DELETE',
      body: JSON.stringify({ token, live_tokens: live }),
    });
    if (!res.ok && __DEV__) console.warn('[push] No se pudo dar de baja el dispositivo', res.error);
  }
  await clearPulse();
}

type PushData = { type?: string; eventId?: string; orderId?: string };

function open(data: PushData | undefined) {
  if (!data?.eventId || data.type === 'pulse') return;
  // El aviso es de un evento puntual: se elige ese evento y se abre lo que corresponde.
  setSelectedEventId(data.eventId);
  if (data.type === 'cash_order' && data.orderId) {
    router.push({ pathname: '/operation/[key]', params: { key: data.orderId } });
  } else {
    router.navigate('/');
  }
}

/** Tocar una notificación (con la app abierta, en segundo plano o cerrada) lleva a su pantalla. */
export function usePushRouting() {
  useEffect(() => {
    if (!Notifications) return;
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last.notification.request.content.data as PushData);
      Notifications.clearLastNotificationResponse?.();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      open(r.notification.request.content.data as PushData),
    );
    return () => sub.remove();
  }, []);
}
