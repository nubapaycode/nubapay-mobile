import { requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { setSelectedEventId } from '@/features/dashboard/selected-event';
import { clearPulse, liveActivityTokens } from '@/features/live/live-pulse';
import { apiFetch, authPaths } from '@/lib/api';

/**
 * Notificaciones push del organizador (pedido en efectivo para aprobar, hitos de aforo). Las manda
 * el backend (services/push_notifications.py) por el servicio de Expo.
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

const projectId = (): string | undefined =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

/**
 * Pide permiso (la primera vez), obtiene el token de Expo y lo guarda en el backend. Sin proyecto
 * de EAS (`eas init`) no hay token: avisa en desarrollo y sigue sin push.
 */
export async function registerPush(): Promise<void> {
  if (!Notifications || registered) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Avisos del evento',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#0069ff',
      });
    }
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return;

    const id = projectId();
    if (!id) {
      if (__DEV__) console.warn('[push] Falta el projectId de EAS: corré `bunx eas-cli init` para tener push.');
      return;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    const res = await apiFetch<{ ok: true }>(authPaths.pushToken(), {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    if (res.ok) registered = token;
  } catch (e) {
    if (__DEV__) console.warn('[push] No se pudo registrar', e);
  }
}

/** Al cerrar sesión: el backend deja de mandarle avisos a este teléfono. */
export async function unregisterPush(): Promise<void> {
  const token = registered;
  registered = null;
  const live = liveActivityTokens();
  clearPulse();
  if (!token && !live.length) return;
  await apiFetch(authPaths.pushToken(), {
    method: 'DELETE',
    body: JSON.stringify({ token, live_tokens: live }),
  });
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
