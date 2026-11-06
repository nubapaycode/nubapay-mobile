import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * Tips de una sola vez ("Mantené apretada una card…"): cada uno aparece la primera vez que tiene
 * sentido y, al cerrarlo, no vuelve. Lo visto queda guardado en el teléfono; en web no se muestran.
 * Como mucho uno por pantalla: `useFirstTip` elige el primero que no se vio de una lista.
 *
 * Lo visto vive fuera de React (lo comparten varias pantallas) y se lee con `useSyncExternalStore`:
 * leerlo directo de un Map en el render lo memoriza el React Compiler y nunca se actualiza.
 */
export type TipId = 'bento-preview' | 'mascot-tap' | 'live-activity' | 'operations-swipe';

const canStore = Platform.OS !== 'web';
const key = (id: TipId) => `nubapay.tipSeen.${id}`;

/** `true` visto, `false` sin ver; sin entrada, todavía no se leyó del teléfono. */
let seen: Partial<Record<TipId, boolean>> = {};
const loading = new Set<TipId>();
const listeners = new Set<() => void>();

function update(id: TipId, value: boolean) {
  // Objeto nuevo en cada cambio: `useSyncExternalStore` compara por referencia.
  seen = { ...seen, [id]: value };
  listeners.forEach((l) => l());
}

function load(id: TipId) {
  if (id in seen || loading.has(id)) return;
  if (!canStore) return update(id, true);
  loading.add(id);
  SecureStore.getItemAsync(key(id))
    .then((v) => update(id, v === '1'))
    .catch(() => update(id, true))
    .finally(() => loading.delete(id));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => seen;

export function dismissTip(id: TipId) {
  update(id, true);
  if (canStore) SecureStore.setItemAsync(key(id), '1').catch(() => {});
}

/**
 * De los tips candidatos (los `false` no aplican ahora), el primero que todavía no se vio, o
 * `null`. Respeta el orden: si el primero todavía no se leyó, espera antes de mostrar el segundo.
 */
export function useFirstTip(candidates: (TipId | false | null | undefined)[]) {
  const ids = candidates.filter((c): c is TipId => !!c);
  const signature = ids.join('|');
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (signature) (signature.split('|') as TipId[]).forEach(load);
  }, [signature]);

  let tip: TipId | null = null;
  for (const id of ids) {
    if (!(id in state)) break; // todavía leyendo: no saltear al siguiente
    if (!state[id]) {
      tip = id;
      break;
    }
  }

  const dismiss = useCallback(() => {
    if (tip) dismissTip(tip);
  }, [tip]);

  return { tip, dismiss };
}
