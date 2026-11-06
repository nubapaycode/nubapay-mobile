/** Base URL del API Flask (ej. http://192.168.0.10:5001). Se define en `.env.local`. */
export function getApiOrigin(): string {
  return (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
}

/**
 * Origen del sitio público (la tienda que ven los compradores), distinto del API. Se define con
 * `EXPO_PUBLIC_SITE_URL`; si falta, el sitio de producción.
 */
export function getSiteOrigin(): string {
  const env = (process.env.EXPO_PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, '');
  if (!env) return 'https://www.nubapay.app';
  return env.startsWith('http') ? env : `https://${env}`;
}

/** Catálogo público del evento (`/catalogo/:slug`, igual que nubapay-frontend). */
export const publicCatalogUrl = (slug: string) =>
  `${getSiteOrigin()}/catalogo/${encodeURIComponent(slug.trim())}`;

/** Venta pública de entradas del evento (`/tickets/:slug`). */
export const publicTicketsUrl = (slug: string) =>
  `${getSiteOrigin()}/tickets/${encodeURIComponent(slug.trim())}`;

/** Ruta API relativa al prefijo `/api` del backend (ej. `/health` → `<origin>/api/health`). */
export function apiUrl(apiPath: string): string {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  return `${getApiOrigin()}/api${path}`;
}
