import { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { ApiResult } from './api';

/**
 * Cache mínimo de consultas: cada clave guarda su último resultado y las pantallas que la usan se
 * enteran cuando cambia. `invalidate(prefix)` vuelve a pedir lo que empiece con ese prefijo
 * (p. ej. después de crear o editar algo).
 */
type Entry<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  fetcher: () => Promise<ApiResult<T>>;
  promise: Promise<void> | null;
};

const cache = new Map<string, Entry<unknown>>();
const listeners = new Map<string, Set<() => void>>();
let version = 0;

function emit(key: string) {
  version++;
  listeners.get(key)?.forEach((l) => l());
}

function run<T>(key: string): Promise<void> {
  const e = cache.get(key) as Entry<T> | undefined;
  if (!e) return Promise.resolve();
  if (e.promise) return e.promise;
  e.loading = true;
  emit(key);
  e.promise = e.fetcher().then((res) => {
    const cur = cache.get(key) as Entry<T> | undefined;
    if (!cur) return;
    cur.loading = false;
    cur.promise = null;
    if (res.ok) {
      cur.data = res.data;
      cur.error = null;
    } else {
      cur.error = res.error;
    }
    emit(key);
  });
  return e.promise;
}

/** Vuelve a pedir todas las consultas cuya clave empieza con `prefix`. */
export function invalidate(prefix: string): Promise<void> {
  return Promise.all(
    [...cache.keys()].filter((k) => k.startsWith(prefix)).map((k) => run(k)),
  ).then(() => undefined);
}

/** Reemplaza el dato de una clave sin volver a pedirlo (actualización optimista). */
export function setQueryData<T>(key: string, update: (prev: T | null) => T | null) {
  const e = cache.get(key) as Entry<T> | undefined;
  if (!e) return;
  e.data = update(e.data);
  emit(key);
}

/**
 * Consulta con cache por `key` (null = no pedir todavía). Devuelve el último dato aunque esté
 * recargando, así la pantalla no parpadea.
 */
export function useQuery<T>(key: string | null, fetcher: () => Promise<ApiResult<T>>) {
  if (key && !cache.has(key)) {
    cache.set(key, { data: null, error: null, loading: false, fetcher, promise: null });
  } else if (key) {
    (cache.get(key) as Entry<T>).fetcher = fetcher;
  }

  useSyncExternalStore(
    (l) => {
      if (!key) return () => {};
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(l);
      return () => listeners.get(key)?.delete(l);
    },
    () => (key ? version : 0),
  );

  useEffect(() => {
    if (!key) return;
    const e = cache.get(key) as Entry<T>;
    if (e.data == null && !e.promise) run<T>(key);
  }, [key]);

  const refresh = useCallback(() => (key ? run<T>(key) : Promise.resolve()), [key]);
  const e = key ? (cache.get(key) as Entry<T>) : null;
  return {
    data: e?.data ?? null,
    error: e?.error ?? null,
    loading: !!e?.loading && e.data == null,
    refreshing: !!e?.loading && e.data != null,
    refresh,
  };
}

/** Borra todo el cache (al cerrar sesión). */
export function clearQueries() {
  cache.clear();
  version++;
}
