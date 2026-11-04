/** Base URL del API Flask (ej. http://192.168.0.10:5001). Se define en `.env.local`. */
export function getApiOrigin(): string {
  return (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
}

/** Ruta API relativa al prefijo `/api` del backend (ej. `/health` → `<origin>/api/health`). */
export function apiUrl(apiPath: string): string {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  return `${getApiOrigin()}/api${path}`;
}
