export { apiUrl, getApiOrigin } from './api/url';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

/**
 * Token de la sesión actual. Lo fija el AuthProvider; así cada llamada no tiene que recibirlo.
 * Si una llamada pasa `token` explícito (incluso `null`), se usa ese.
 */
let sessionToken: string | null = null;
export function setApiToken(token: string | null) {
  sessionToken = token;
}

async function parse<T>(res: Response): Promise<ApiResult<T>> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, error: body?.error ?? `Error ${res.status}` };
  }
  return { ok: true, data: body as T };
}

/** fetch JSON con manejo uniforme de errores. Devuelve `{ ok, data }` o `{ ok: false, error }`. */
export async function apiFetch<T>(
  url: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<ApiResult<T>> {
  const { token, headers, ...rest } = init;
  const auth = token === undefined ? sessionToken : token;
  try {
    const res = await fetch(url, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...(headers as Record<string, string> | undefined),
      },
    });
    return await parse<T>(res);
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor' };
  }
}

/** Sube un archivo local (`file://…`) como multipart en el campo `field`. */
export async function apiUpload<T>(
  url: string,
  file: { uri: string; name: string; type: string },
  field = 'file',
): Promise<ApiResult<T>> {
  const form = new FormData();
  // React Native acepta { uri, name, type } como archivo en FormData.
  form.append(field, file as unknown as Blob);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
      body: form,
    });
    return await parse<T>(res);
  } catch {
    return { ok: false, error: 'No se pudo subir el archivo' };
  }
}

export { authPaths, eventPaths, systemPaths } from './api/paths';
