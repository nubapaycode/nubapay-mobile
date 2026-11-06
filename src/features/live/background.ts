import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { hasLivePulse, syncPulse } from './live-pulse';

/**
 * Refresco del widget y la Live Activity con la app en segundo plano o cerrada:
 *
 * - **Push silencioso**: el backend manda uno cuando entra una venta (como mucho cada 2 minutos
 *   por evento). iOS despierta la app unos segundos y se sincroniza. iOS raciona estos pushes:
 *   llegan casi siempre, pero no está garantizado.
 * - **Tarea periódica** (`expo-background-task`): respaldo que iOS corre cuando le parece (pedimos
 *   cada 15 minutos; puede tardar más).
 *
 * Las tareas se definen al cargar este módulo (tiene que ser en el scope global, antes de que
 * iOS lance la app en segundo plano): se importa desde el layout raíz. Todo es nativo y se carga
 * con guard: sin los módulos en el build, no hace nada.
 */
const PULSE_TASK = 'nubapay-pulse-refresh';
const PUSH_TASK = 'nubapay-pulse-push';

type TaskManagerMod = typeof import('expo-task-manager');
type BackgroundTaskMod = typeof import('expo-background-task');
type NotificationsMod = typeof import('expo-notifications');

const enabled = Platform.OS === 'ios' && hasLivePulse && !!requireOptionalNativeModule('ExpoTaskManager');
const TaskManager: TaskManagerMod | null = enabled
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-task-manager') as TaskManagerMod)
  : null;
const BackgroundTask: BackgroundTaskMod | null =
  enabled && requireOptionalNativeModule('ExpoBackgroundTask')
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-background-task') as BackgroundTaskMod)
    : null;
const Notifications: NotificationsMod | null =
  enabled && requireOptionalNativeModule('ExpoPushTokenManager')
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as NotificationsMod)
    : null;

if (TaskManager && BackgroundTask) {
  TaskManager.defineTask(PULSE_TASK, async () => {
    const ok = await syncPulse();
    return ok ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
  });
}

if (TaskManager && Notifications) {
  TaskManager.defineTask(PUSH_TASK, async ({ data }) => {
    // Solo los pushes silenciosos del pulso; los demás (pedido en efectivo, aforo) no se tocan.
    // Según cómo llegue, los datos vienen en `data.dataString` (JSON) o sueltos en `data`.
    const payload = (data ?? {}) as { data?: { dataString?: string; [k: string]: unknown } };
    const raw = payload.data ?? {};
    let info: Record<string, unknown> = raw;
    if (typeof raw.dataString === 'string') {
      try {
        info = JSON.parse(raw.dataString);
      } catch {
        info = raw;
      }
    }
    if (info.type === 'pulse') await syncPulse(typeof info.eventId === 'string' ? info.eventId : null);
  });
}

/** Registra las dos vías de refresco en segundo plano (idempotente). Llamar con sesión iniciada. */
export async function enableBackgroundPulse(): Promise<void> {
  try {
    if (TaskManager && BackgroundTask && !(await TaskManager.isTaskRegisteredAsync(PULSE_TASK))) {
      await BackgroundTask.registerTaskAsync(PULSE_TASK, { minimumInterval: 15 });
    }
    if (Notifications && TaskManager && !(await TaskManager.isTaskRegisteredAsync(PUSH_TASK))) {
      await Notifications.registerTaskAsync(PUSH_TASK);
    }
  } catch (e) {
    if (__DEV__) console.warn('[background-pulse]', e);
  }
}
