import { useMemo, useSyncExternalStore } from 'react';

import { useDashboardSnapshot } from '@/features/dashboard/dashboard-store';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import {
  type CatalogBlock,
  type Category,
  createBlock,
  createCategory,
  deleteBlock as apiDeleteBlock,
  deleteBlockBanner,
  deleteCategory as apiDeleteCategory,
  deleteTicket as apiDeleteTicket,
  listBlocks,
  patchBlock,
  putBlockProducts,
  renameCategory as apiRenameCategory,
  reorderBlocks,
  reorderProducts,
  reorderTickets,
  uploadBlockBanner,
  createPickupPoint,
  createProduct,
  createTicket,
  deleteProduct as apiDeleteProduct,
  deleteProductPromotion,
  deleteProductImage,
  listCategories,
  listPickupPoints,
  listProductPromotions,
  listProducts,
  listRegrets,
  listTickets,
  patchPickupPoint,
  patchProduct,
  patchRegret,
  patchTicket,
  type PickupPoint as ApiPickupPoint,
  type Product as ApiProduct,
  type ProductPromotion,
  putProductPromotion,
  type Regret,
  type Ticket as ApiTicket,
  uploadProductImage,
} from '@/lib/api/organizer';
import { invalidate, setQueryData, useQuery } from '@/lib/query';

import { parsePromo, type Promo, promoLabel, type PromoInput, promoPriceFor } from './promo';

/**
 * Gestión del evento conectada al backend (routes/event_workspace.py, event_regrets.py):
 * catálogo (productos + categorías), entradas, bloques de la tienda, puntos de retiro y
 * arrepentimientos.
 */

export type { CatalogBlock, Regret };
export type ManageKind = 'product' | 'ticket' | 'pickup';
type Result = { ok: true } | { ok: false; error: string };

export type ComboLine = { productId: string; quantity: number; name: string };

export type Product = {
  id: string;
  /** 'combo' = agrupa otros productos (`lines`) con un precio propio. */
  type: 'single' | 'combo';
  /** Productos del combo (vacío en los simples). */
  lines: ComboLine[];
  name: string;
  description: string | null;
  imageUri: string | null;
  price: number;
  category: string | null;
  categoryId: string | null;
  isActive: boolean;
  /** Vendidos según el ranking del dashboard (0 si no aparece). */
  sold: number;
  /** Promoción cargada (vigente o no); null si no tiene. */
  promo: Promo | null;
};

export type TicketType = {
  id: string;
  name: string;
  price: number;
  /** Cupo; null = sin tope. */
  stock: number | null;
  sold: number;
  revenue: number;
  isActive: boolean;
};

export type PickupPoint = {
  id: string;
  name: string;
  description: string | null;
  orders: number;
  revenue: number;
  pending: number;
  isActive: boolean;
};

/** Lo que se edita de un producto (alta y edición). */
export type ProductInput = {
  name: string;
  description: string | null;
  imageUri: string | null;
  price: number;
  category: string | null;
  /** Solo combos: productos que lo forman (al menos uno). */
  lines?: ComboLine[];
};

const key = (kind: string, eventId: string | null) => (eventId ? `${kind}:${eventId}` : null);

/* ───────────── Lectura ───────────── */

export function useCategories() {
  const eventId = useSelectedEventId();
  const q = useQuery<Category[]>(key('categories', eventId), () => listCategories(eventId!));
  return { ...q, eventId };
}

export function useProducts() {
  const eventId = useSelectedEventId();
  const snapshot = useDashboardSnapshot();
  const q = useQuery<ApiProduct[]>(key('products', eventId), () => listProducts(eventId!));
  const promos = useQuery<ProductPromotion[]>(key('promotions', eventId), () => listProductPromotions(eventId!));
  const top = snapshot?.eventId === eventId ? snapshot?.data.summary.top_products : undefined;
  const products = useMemo(() => {
    if (!q.data) return null;
    const sold = new Map((top ?? []).map((t) => [t.name, t.quantity]));
    const promoById = new Map((promos.data ?? []).map((pr) => [pr.product_id, pr]));
    return q.data.map<Product>((p) => ({
      id: p.id,
      type: p.type,
      lines: (p.combo_lines ?? []).map((l) => ({ productId: l.product_id, quantity: l.quantity, name: l.name })),
      name: p.name,
      description: p.description || null,
      imageUri: p.image_url,
      price: p.price,
      category: p.category_name,
      categoryId: p.category_id,
      isActive: p.is_active,
      sold: sold.get(p.name) ?? 0,
      promo: promoById.has(p.id) ? parsePromo(promoById.get(p.id)!, p.price) : null,
    }));
  }, [q.data, top, promos.data]);
  return { products, error: products ? null : q.error, eventId, refresh: q.refresh };
}

export function useTickets() {
  const eventId = useSelectedEventId();
  const q = useQuery<ApiTicket[]>(key('tickets', eventId), () => listTickets(eventId!));
  const tickets = useMemo(
    () =>
      q.data?.map<TicketType>((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        stock: t.stock,
        sold: t.sold,
        revenue: t.revenue ?? t.sold * t.price,
        isActive: t.is_active,
      })) ?? null,
    [q.data],
  );
  return { tickets, error: tickets ? null : q.error, eventId };
}

export function usePickupPoints() {
  const eventId = useSelectedEventId();
  const snapshot = useDashboardSnapshot();
  const q = useQuery<ApiPickupPoint[]>(key('pickups', eventId), () => listPickupPoints(eventId!));
  const stats = snapshot?.eventId === eventId ? snapshot?.data.insights.pickup_points : undefined;
  const pickups = useMemo(() => {
    if (!q.data) return null;
    const byId = new Map((stats ?? []).map((s) => [s.id, s]));
    return q.data.map<PickupPoint>((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || null,
      orders: byId.get(p.id)?.orders ?? 0,
      revenue: byId.get(p.id)?.revenue ?? 0,
      pending: byId.get(p.id)?.pending_orders ?? 0,
      isActive: p.is_active,
    }));
  }, [q.data, stats]);
  return { pickups, error: pickups ? null : q.error, eventId };
}

export function useBlocks() {
  const eventId = useSelectedEventId();
  const q = useQuery<CatalogBlock[]>(key('blocks', eventId), () => listBlocks(eventId!));
  return { blocks: q.data, error: q.data ? null : q.error, eventId };
}

/** `enabled: false` no pide nada (p. ej. si el rol no puede ver pedidos). */
export function useRegrets(enabled = true) {
  const eventId = useSelectedEventId();
  const q = useQuery<Regret[]>(enabled ? key('regrets', eventId) : null, () => listRegrets(eventId!));
  return { regrets: q.data, error: q.data ? null : q.error, eventId };
}

/* ───────────── Escritura ───────────── */

/** Busca la categoría por nombre o la crea. */
async function resolveCategory(
  eventId: string,
  name: string | null,
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (!name) return { ok: true, id: null };
  const list = await listCategories(eventId);
  if (!list.ok) return list;
  const found = list.data.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (found) return { ok: true, id: found.id };
  const created = await createCategory(eventId, name);
  if (!created.ok) return created;
  return { ok: true, id: created.data.id };
}

/** Crea una categoría (si no existe) para poder elegirla en el formulario. */
export async function addCategory(eventId: string, name: string): Promise<Result> {
  const res = await resolveCategory(eventId, name.trim());
  if (!res.ok) return res;
  await invalidate(`categories:${eventId}`);
  return { ok: true };
}

const isLocalFile = (uri: string | null) => !!uri && !/^https?:\/\//.test(uri);

/**
 * Crea o actualiza un producto o combo (si `input.lines` viene, es combo): resuelve la categoría, guarda los datos y sube (o quita) la foto.
 * `existing` = producto antes de editar (para saber si cambió la foto).
 * `promo`: undefined = no se toca; null = se quita; un valor = se crea o reemplaza (después de
 * guardar el producto, porque el backend valida el precio promo contra el de lista).
 */
export async function saveProduct(
  eventId: string,
  input: ProductInput,
  existing?: Product,
  isActive?: boolean,
  promo?: PromoInput | null,
): Promise<Result> {
  const cat = await resolveCategory(eventId, input.category);
  if (!cat.ok) return cat;
  const payload = {
    name: input.name,
    price: input.price,
    description: input.description,
    category_id: cat.id,
    ...(isActive !== undefined ? { is_active: isActive } : {}),
    ...(input.lines
      ? {
          // `type` solo cuenta al crear; las líneas reemplazan a las anteriores.
          ...(existing ? {} : { type: 'combo' as const }),
          lines: input.lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        }
      : {}),
  };
  const saved = existing ? await patchProduct(eventId, existing.id, payload) : await createProduct(eventId, payload);
  if (!saved.ok) return saved;

  let photoError: string | null = null;
  if (isLocalFile(input.imageUri)) {
    const up = await uploadProductImage(eventId, saved.data.id, input.imageUri!);
    if (!up.ok) photoError = up.error;
  } else if (existing?.imageUri && !input.imageUri) {
    await deleteProductImage(eventId, saved.data.id);
  }
  let promoError: string | null = null;
  if (promo) {
    const res = await putProductPromotion(eventId, saved.data.id, {
      badge_label: promoLabel(promo.kind, promo.amount),
      promo_price: promoPriceFor(input.price, promo.kind, promo.amount),
      is_active: true,
      starts_at: promo.startsAt.toISOString(),
      ends_at: promo.endsAt.toISOString(),
    });
    if (!res.ok) promoError = res.error;
  } else if (promo === null && existing?.promo) {
    const res = await deleteProductPromotion(eventId, saved.data.id);
    if (!res.ok) promoError = res.error;
  }

  await Promise.all([
    invalidate(`products:${eventId}`),
    invalidate(`categories:${eventId}`),
    invalidate(`promotions:${eventId}`),
  ]);
  if (photoError) return { ok: false, error: `El producto se guardó, pero no la foto: ${photoError}` };
  if (promoError) return { ok: false, error: `El producto se guardó, pero no la promoción: ${promoError}` };
  return { ok: true };
}

export async function setProductActive(eventId: string, id: string, isActive: boolean): Promise<Result> {
  setQueryData<ApiProduct[]>(
    `products:${eventId}`,
    (l) => l?.map((p) => (p.id === id ? { ...p, is_active: isActive } : p)) ?? null,
  );
  const res = await patchProduct(eventId, id, { is_active: isActive });
  if (!res.ok) await invalidate(`products:${eventId}`);
  return res.ok ? { ok: true } : res;
}

export async function deleteProduct(eventId: string, id: string): Promise<Result> {
  const res = await apiDeleteProduct(eventId, id);
  if (!res.ok) return res;
  await invalidate(`products:${eventId}`);
  return { ok: true };
}

export async function addTicket(
  eventId: string,
  t: { name: string; price: number; stock: number | null },
): Promise<Result> {
  const res = await createTicket(eventId, t);
  if (!res.ok) return res;
  await invalidate(`tickets:${eventId}`);
  return { ok: true };
}

/** Crea un tipo de entrada o, con `existing`, lo actualiza (nombre, precio, cupo y si está a la venta). */
export async function saveTicket(
  eventId: string,
  input: { name: string; price: number; stock: number | null },
  existing?: TicketType,
  isActive?: boolean,
): Promise<Result> {
  const res = existing
    ? await patchTicket(eventId, existing.id, {
        ...input,
        ...(isActive !== undefined ? { is_active: isActive } : {}),
      })
    : await createTicket(eventId, input);
  if (!res.ok) return res;
  await invalidate(`tickets:${eventId}`);
  return { ok: true };
}

export async function setTicketActive(eventId: string, id: string, isActive: boolean): Promise<Result> {
  setQueryData<ApiTicket[]>(
    `tickets:${eventId}`,
    (l) => l?.map((t) => (t.id === id ? { ...t, is_active: isActive } : t)) ?? null,
  );
  const res = await patchTicket(eventId, id, { is_active: isActive });
  if (!res.ok) await invalidate(`tickets:${eventId}`);
  return res.ok ? { ok: true } : res;
}

export async function removeTicket(eventId: string, id: string): Promise<Result> {
  const res = await apiDeleteTicket(eventId, id);
  if (!res.ok) return res;
  await invalidate(`tickets:${eventId}`);
  return { ok: true };
}

/* ── Orden (entradas, productos, bloques) ── */

export type ReorderKind = 'tickets' | 'products' | 'blocks';

export async function saveOrder(eventId: string, kind: ReorderKind, ids: string[]): Promise<Result> {
  const call = kind === 'tickets' ? reorderTickets : kind === 'products' ? reorderProducts : reorderBlocks;
  const res = await call(eventId, ids);
  await invalidate(`${kind}:${eventId}`);
  return res.ok ? { ok: true } : res;
}

/* ── Categorías ── */

export async function renameCategory(eventId: string, id: string, name: string): Promise<Result> {
  const res = await apiRenameCategory(eventId, id, name.trim());
  if (!res.ok) return res;
  await Promise.all([invalidate(`categories:${eventId}`), invalidate(`products:${eventId}`)]);
  return { ok: true };
}

/** El backend no deja borrar una categoría con productos. */
export async function removeCategory(eventId: string, id: string): Promise<Result> {
  const res = await apiDeleteCategory(eventId, id);
  if (!res.ok) return res;
  await invalidate(`categories:${eventId}`);
  return { ok: true };
}

/* ── Bloques de la tienda ── */

export type BlockInput = { title: string; isActive: boolean; productIds: string[]; bannerUri: string | null };

/**
 * Crea o actualiza un bloque: título, si se muestra, sus productos (en orden) y el banner
 * (`file://…` se sube; null lo quita).
 */
export async function saveBlock(eventId: string, input: BlockInput, existing?: CatalogBlock): Promise<Result> {
  let block: CatalogBlock;
  if (existing) {
    const res = await patchBlock(eventId, existing.id, { title: input.title.trim(), is_active: input.isActive });
    if (!res.ok) return res;
    const same =
      existing.products.length === input.productIds.length &&
      existing.products.every((p, i) => p.product_id === input.productIds[i]);
    if (!same) {
      const prods = await putBlockProducts(eventId, existing.id, input.productIds);
      if (!prods.ok) return prods;
    }
    block = res.data;
  } else {
    const res = await createBlock(eventId, {
      title: input.title.trim(),
      is_active: input.isActive,
      product_ids: input.productIds,
    });
    if (!res.ok) return res;
    block = res.data;
  }
  let bannerError: string | null = null;
  if (input.bannerUri && !/^https?:\/\//.test(input.bannerUri)) {
    const up = await uploadBlockBanner(eventId, block.id, input.bannerUri);
    if (!up.ok) bannerError = up.error;
  } else if (!input.bannerUri && existing?.banner_image_url) {
    const del = await deleteBlockBanner(eventId, block.id);
    if (!del.ok) bannerError = del.error;
  }
  await invalidate(`blocks:${eventId}`);
  if (bannerError) return { ok: false, error: `El bloque se guardó, pero no el banner: ${bannerError}` };
  return { ok: true };
}

export async function setBlockActive(eventId: string, id: string, isActive: boolean): Promise<Result> {
  setQueryData<CatalogBlock[]>(
    `blocks:${eventId}`,
    (l) => l?.map((b) => (b.id === id ? { ...b, is_active: isActive } : b)) ?? null,
  );
  const res = await patchBlock(eventId, id, { is_active: isActive });
  if (!res.ok) await invalidate(`blocks:${eventId}`);
  return res.ok ? { ok: true } : res;
}

export async function removeBlock(eventId: string, id: string): Promise<Result> {
  const res = await apiDeleteBlock(eventId, id);
  if (!res.ok) return res;
  await invalidate(`blocks:${eventId}`);
  return { ok: true };
}

export async function addPickupPoint(
  eventId: string,
  p: { name: string; description: string | null },
): Promise<Result> {
  const res = await createPickupPoint(eventId, { name: p.name, description: p.description ?? undefined });
  if (!res.ok) return res;
  await invalidate(`pickups:${eventId}`);
  return { ok: true };
}

export async function setPickupActive(eventId: string, id: string, isActive: boolean): Promise<Result> {
  setQueryData<ApiPickupPoint[]>(
    `pickups:${eventId}`,
    (l) => l?.map((p) => (p.id === id ? { ...p, is_active: isActive } : p)) ?? null,
  );
  const res = await patchPickupPoint(eventId, id, { is_active: isActive });
  if (!res.ok) await invalidate(`pickups:${eventId}`);
  return res.ok ? { ok: true } : res;
}

export async function setRegretStatus(eventId: string, id: string, status: Regret['status']): Promise<Result> {
  const res = await patchRegret(eventId, id, status);
  if (!res.ok) return res;
  setQueryData<Regret[]>(`regrets:${eventId}`, (l) => l?.map((r) => (r.id === id ? res.data : r)) ?? null);
  return { ok: true };
}

/* ── Filtros del catálogo (compartidos entre la lista y su hoja de filtros) ── */

export type CatalogFilters = { categories: string[]; status: 'all' | 'active' | 'paused' };
export const DEFAULT_CATALOG_FILTERS: CatalogFilters = { categories: [], status: 'all' };

export function matchesCatalogFilters(p: Product, f: CatalogFilters): boolean {
  if (f.categories.length && !f.categories.includes(p.category ?? '')) return false;
  if (f.status === 'active' && !p.isActive) return false;
  if (f.status === 'paused' && p.isActive) return false;
  return true;
}

export const activeCatalogFilters = (f: CatalogFilters) => f.categories.length + (f.status !== 'all' ? 1 : 0);

let catalogFilters: CatalogFilters = DEFAULT_CATALOG_FILTERS;
const catalogListeners = new Set<() => void>();

export function setCatalogFilters(next: CatalogFilters) {
  catalogFilters = next;
  catalogListeners.forEach((l) => l());
}

export function useCatalogFilters(): CatalogFilters {
  return useSyncExternalStore(
    (l) => {
      catalogListeners.add(l);
      return () => catalogListeners.delete(l);
    },
    () => catalogFilters,
  );
}
