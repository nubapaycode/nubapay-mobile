import { useFocusEffect, type Href } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, Share } from 'react-native';

import type { IconName } from '@/components/dashboard/icon';
import { useEventAccess } from '@/features/access/access';
import { eventPhase } from '@/features/dashboard/format';
import { useEvents } from '@/features/dashboard/use-event-dashboard';
import { useProducts, useTickets } from '@/features/manage/manage';
import { isReady, METHODS, useSelectedEventDetail } from '@/features/payouts/payment-methods';
import { apiFetch } from '@/lib/api';
import { apiUrl, publicCatalogUrl, publicTicketsUrl } from '@/lib/api/url';
import { useQuery } from '@/lib/query';

/**
 * Qué le falta al evento seleccionado para vender (checklist de la pestaña Más, el punto azul de
 * la barra y el aviso de "Tu tienda"). Cada paso se calcula con datos reales, no con "ya lo vi":
 * si se borra la portada, vuelve. Los obligatorios (portada, fecha, catálogo y cobros) no se pueden
 * saltear; con solo opcionales pendientes (compartir), el checklist se puede saltear.
 *
 * La tienda pública (`/catalog/storefront/<slug>`) solo abre con portada y algo activo para
 * vender; sin eso responde 404 y el link no sirve. Por eso "Compartí tu tienda" se habilita recién
 * cuando la tienda responde, y se tacha al compartirla (se recuerda en el teléfono).
 */
export type SetupStepKey = 'cover' | 'date' | 'catalog' | 'pay' | 'share';

export type SetupStep = {
  key: SetupStepKey;
  label: string;
  /** Por qué importa, en una línea. */
  why: string;
  icon: IconName;
  done: boolean;
  /** No se puede hacer todavía (compartir sin tienda abierta). */
  locked: boolean;
  /** Hace falta para vender. Mientras quede alguno, el checklist no se puede saltear. */
  required: boolean;
  /** Adónde lleva tocarlo (o `null` si es una acción, como compartir). */
  href: Href | null;
};

type PublicStorefront = { products: unknown[]; combos: unknown[]; tickets: unknown[] };

const canStore = Platform.OS !== 'web';
const sharedKey = (eventId: string) => `nubapay.storeShared.${eventId}`;
const skippedKey = (eventId: string) => `nubapay.setupSkipped.${eventId}`;

// Checklist salteado por evento: lo leen la pestaña Más y el punto de la barra a la vez.
const skippedCache = new Map<string, boolean>();
const skippedListeners = new Set<() => void>();

const subscribeSkipped = (l: () => void) => {
  skippedListeners.add(l);
  return () => {
    skippedListeners.delete(l);
  };
};

/**
 * Si el checklist de este evento se salteó (`null` mientras se lee del teléfono). Se lee con
 * `useSyncExternalStore`: el valor vive fuera de React y el React Compiler no lo puede memorizar.
 */
function useSetupSkipped(eventId: string | null) {
  useEffect(() => {
    if (!eventId || skippedCache.has(eventId)) return;
    if (!canStore) {
      skippedCache.set(eventId, false);
      skippedListeners.forEach((x) => x());
      return;
    }
    SecureStore.getItemAsync(skippedKey(eventId))
      .then((v) => skippedCache.set(eventId, v === '1'))
      .catch(() => skippedCache.set(eventId, false))
      .finally(() => skippedListeners.forEach((x) => x()));
  }, [eventId]);
  return useSyncExternalStore(subscribeSkipped, () => (eventId ? (skippedCache.get(eventId) ?? null) : null));
}

function skipSetup(eventId: string) {
  skippedCache.set(eventId, true);
  skippedListeners.forEach((l) => l());
  if (canStore) SecureStore.setItemAsync(skippedKey(eventId), '1').catch(() => {});
}

/** La tienda pública del evento (lo que ve un comprador, sin sesión). `null` si no abre. */
export function usePublicStore() {
  const { events } = useEvents();
  const { eventId } = useSelectedEventDetail();
  const slug = events?.find((e) => e.id === eventId)?.slug?.trim() || null;
  const { data, error, refresh } = useQuery<PublicStorefront>(slug ? `storefront:${slug}` : null, () =>
    apiFetch<PublicStorefront>(apiUrl(`/catalog/storefront/${encodeURIComponent(slug!)}`), { token: null }),
  );
  useFocusEffect(
    useCallback(() => {
      if (slug) refresh();
    }, [slug, refresh]),
  );
  const hasProducts = !!data && (data.products?.length ?? 0) + (data.combos?.length ?? 0) > 0;
  const hasTickets = !!data && (data.tickets?.length ?? 0) > 0;
  return {
    slug,
    /** Respondió y tiene algo para vender. */
    open: hasProducts || hasTickets,
    /** Ya se sabe la respuesta (abierta o no). */
    loaded: !!data || !!error,
    catalogUrl: slug && hasProducts ? publicCatalogUrl(slug) : null,
    ticketsUrl: slug && hasTickets ? publicTicketsUrl(slug) : null,
    refresh,
  };
}

/** Quién ve el checklist: el dueño, o el equipo con permiso de catálogo y de la tienda. */
export function useCanSetup() {
  const { can, isOwner } = useEventAccess();
  return isOwner || (can('products') && can('storefront'));
}

export function useEventSetup() {
  const { eventId, data: detail } = useSelectedEventDetail();
  const { events } = useEvents();
  const summary = events?.find((e) => e.id === eventId) ?? null;
  // Un evento terminado ya no necesita prepararse.
  const ended = !!summary && eventPhase(summary) === 'ended';
  const { products } = useProducts();
  const { tickets } = useTickets();
  const store = usePublicStore();
  // Si ya se compartió la tienda de este evento (guardado en el teléfono; en web, nunca).
  const [sharedState, setSharedState] = useState<{ eventId: string; value: boolean } | null>(null);
  useEffect(() => {
    if (!eventId || !canStore) return;
    let cancelled = false;
    SecureStore.getItemAsync(sharedKey(eventId))
      .then((v) => !cancelled && setSharedState({ eventId, value: v === '1' }))
      .catch(() => !cancelled && setSharedState({ eventId, value: false }));
    return () => {
      cancelled = true;
    };
  }, [eventId]);
  const shared = !canStore ? false : sharedState?.eventId === eventId ? sharedState.value : null;

  const skipped = useSetupSkipped(eventId);
  const ready =
    !!detail && detail.id === eventId && products != null && tickets != null && shared != null && skipped != null;
  if (!ready || !eventId)
    return {
      ready: false as const,
      steps: [] as SetupStep[],
      doneCount: 0,
      total: 0,
      canSkip: false,
      pending: false,
      ended: false,
      share: async () => {},
      skip: () => {},
    };

  const hasCatalog = products.some((p) => p.isActive) || tickets.some((t) => t.isActive);
  const canCharge = METHODS.some((m) => isReady(m, detail));
  const editHref: Href = { pathname: '/edit-event/[id]', params: { id: eventId } };

  const steps: SetupStep[] = [
    { key: 'cover', label: 'Subí una portada', why: 'Sin portada tu tienda no abre.', icon: 'photo', done: !!detail.cover_image_url, locked: false, required: true, href: editHref },
    { key: 'date', label: 'Poné fecha y hora', why: 'Así sabemos cuándo está en vivo.', icon: 'calendar', done: !!detail.starts_at, locked: false, required: true, href: editHref },
    { key: 'catalog', label: 'Cargá productos o entradas', why: 'Lo que vas a vender.', icon: 'cart', done: hasCatalog, locked: false, required: true, href: '/manage/products' },
    { key: 'pay', label: 'Elegí cómo cobrar', why: 'Mercado Pago o efectivo.', icon: 'bank', done: canCharge, locked: false, required: true, href: '/payment-methods' },
    { key: 'share', label: 'Compartí tu tienda', why: store.open ? 'Mandá el link a tus clientes.' : 'Se habilita cuando tu tienda abra.', icon: 'send', done: shared && store.open, locked: !store.open, required: false, href: null },
  ];

  /** Abre la hoja de compartir con el link de la tienda y tacha el paso. */
  const share = async () => {
    const url = store.catalogUrl ?? store.ticketsUrl;
    if (!url) return;
    const res = await Share.share({ message: `Comprá en ${detail.name}: ${url}`, url }).catch(() => null);
    if (res && res.action !== Share.dismissedAction) {
      setSharedState({ eventId, value: true });
      if (canStore) await SecureStore.setItemAsync(sharedKey(eventId), '1').catch(() => {});
    }
  };

  const doneCount = steps.filter((s) => s.done).length;
  // Se puede saltear recién cuando no falta ningún paso obligatorio (lo opcional, como compartir).
  const canSkip = steps.every((s) => s.done || !s.required);
  const complete = doneCount === steps.length;
  return {
    ready: true as const,
    steps,
    doneCount,
    total: steps.length,
    canSkip,
    /** Hay algo por hacer y no se salteó: muestra el checklist en Más y el punto en la barra. */
    pending: !complete && !skipped && !ended,
    ended,
    share,
    skip: () => canSkip && skipSetup(eventId),
  };
}

/**
 * Por qué la tienda no abre todavía, para avisarlo en lugar de esconder el link: el primer
 * requisito que falta (portada o catálogo). `null` si abre o si todavía no se sabe.
 */
export function storeBlocker(steps: SetupStep[]): SetupStep | null {
  return steps.find((s) => (s.key === 'cover' || s.key === 'catalog') && !s.done) ?? null;
}
