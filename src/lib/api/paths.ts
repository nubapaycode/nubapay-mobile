/** Rutas HTTP del backend Flask, alineadas con `nubapay-backend/routes/`. */
import { apiUrl } from './url';

export const systemPaths = {
  health: () => apiUrl('/health'),
};

export const authPaths = {
  login: () => apiUrl('/auth/login'),
  me: () => apiUrl('/auth/me'),
  forgotPassword: () => apiUrl('/auth/forgot-password'),
};

export const eventPaths = {
  list: () => apiUrl('/events'),
  detail: (eventId: string) => apiUrl(`/events/${eventId}`),
  /** Ventas, comparación, serie, medios de pago, top productos, ritmo en vivo. Query: from, to, payment, product. */
  dashboard: (eventId: string, query?: string) =>
    apiUrl(`/events/${eventId}/dashboard${query ? `?${query}` : ''}`),
  /** Aforo/ingreso por entrada, retiros pendientes, puntos de retiro, clientes, efectivo por cobrar, actividad. */
  dashboardInsights: (eventId: string) => apiUrl(`/events/${eventId}/dashboard/insights`),
  /** Herramientas del evento (routes/event_workspace.py, event_staff.py, event_regrets.py). */
  workspace: (eventId: string, sub: string, query?: Record<string, string | number | boolean | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v === undefined || v === '') continue;
      q.set(k, typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v));
    }
    const qs = q.toString();
    return apiUrl(`/events/${eventId}/${sub.replace(/^\//, '')}${qs ? `?${qs}` : ''}`);
  },
};
