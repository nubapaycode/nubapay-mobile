import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiFetch, authPaths, setApiToken, setUnauthorizedHandler } from '@/lib/api';
import { clearQueries } from '@/lib/query';
import {
  type AuthUser,
  clearSession,
  isSessionRejected,
  loadSession,
  saveSession,
} from '@/lib/authSession';

type AuthState = {
  isLoading: boolean;
  token: string | null;
  user: AuthUser | null;
  /** `status`: código HTTP cuando el backend rechazó (para distinguir credenciales malas de un error de red). */
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string; status?: number }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

type AuthResponse = {
  token?: string;
  user: AuthUser;
  staff_memberships?: AuthUser['staff_memberships'];
};

/** El backend devuelve `staff_memberships` al nivel raíz; se integran al usuario (igual que nubapay-frontend). */
function toAuthUser(body: AuthResponse): AuthUser {
  return { ...body.user, staff_memberships: body.staff_memberships ?? body.user.staff_memberships };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const signOut = useCallback(async () => {
    clearQueries();
    await clearSession();
    setToken(null);
    setUser(null);
  }, []);

  // Restaura la sesión guardada y la valida contra /auth/me.
  useEffect(() => {
    (async () => {
      const stored = await loadSession();
      if (!stored.token) {
        setIsLoading(false);
        return;
      }
      setToken(stored.token);
      setUser(stored.user);
      const res = await apiFetch<AuthResponse>(authPaths.me(), { token: stored.token });
      if (res.ok) {
        const nextToken = res.data.token ?? stored.token; // sesión deslizante
        const nextUser = toAuthUser(res.data);
        await saveSession(nextToken, nextUser);
        setToken(nextToken);
        setUser(nextUser);
      } else if (isSessionRejected(res.status)) {
        await signOut();
      }
      setIsLoading(false);
    })();
  }, [signOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<AuthResponse>(authPaths.login(), {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    if (!res.ok) return { ok: false, error: res.error, status: res.status };
    if (!res.data.token) return { ok: false, error: 'Respuesta inválida del servidor' };
    const nextUser = toAuthUser(res.data);
    await saveSession(res.data.token, nextUser);
    setToken(res.data.token);
    setUser(nextUser);
    return { ok: true };
  }, []);

  // Todas las llamadas a la API usan el token de la sesión actual.
  useEffect(() => {
    setApiToken(token);
  }, [token]);

  // Si el token vence mientras se usa la app, el backend responde 401: se cierra la sesión y el
  // layout manda al login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo(
    () => ({ isLoading, token, user, signIn, signOut }),
    [isLoading, token, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
