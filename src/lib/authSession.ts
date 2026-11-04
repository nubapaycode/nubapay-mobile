import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type OrganizerStaffTools = {
  dashboard: boolean;
  storefront: boolean;
  products: boolean;
  scanner: boolean;
  orders: boolean;
  pickup_points: boolean;
  payments: boolean;
};

export type StaffMembership = {
  event_id: string;
  role: string;
  tools: OrganizerStaffTools;
};

/** Mismo shape que `AuthUser` de nubapay-frontend (`lib/authSession.ts`). */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  partner?: boolean;
  tenant_id?: string;
  tenant_subdomain?: string;
  on_platform_tenant?: boolean;
  staff_memberships?: StaffMembership[];
  onboarding_completed?: boolean;
  is_platform_admin?: boolean;
};

const TOKEN_KEY = 'nubapay_token';
const USER_KEY = 'nubapay_user';

// SecureStore (Keychain/Keystore) en nativo; localStorage en web (solo para desarrollo).
const storage = {
  get: (k: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(k)) : SecureStore.getItemAsync(k),
  set: (k: string, v: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.setItem(k, v))
      : SecureStore.setItemAsync(k, v),
  remove: (k: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.removeItem(k))
      : SecureStore.deleteItemAsync(k),
};

export async function saveSession(token: string, user: AuthUser): Promise<void> {
  await Promise.all([storage.set(TOKEN_KEY, token), storage.set(USER_KEY, JSON.stringify(user))]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([storage.remove(TOKEN_KEY), storage.remove(USER_KEY)]);
}

export async function loadSession(): Promise<{ token: string | null; user: AuthUser | null }> {
  const [token, raw] = await Promise.all([storage.get(TOKEN_KEY), storage.get(USER_KEY)]);
  let user: AuthUser | null = null;
  if (raw) {
    try {
      user = JSON.parse(raw) as AuthUser;
    } catch {
      user = null;
    }
  }
  return { token, user };
}

/**
 * `/auth/me` responde 401 si el token es inválido o venció y 404 si el usuario ya no existe.
 * Cualquier otro fallo (5xx, 429, corte de red) es transitorio: no se cierra la sesión.
 */
export function isSessionRejected(status?: number): boolean {
  return status === 401 || status === 404;
}
