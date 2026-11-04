/**
 * Cliente de la API del organizador. Mismos endpoints y formas que nubapay-frontend
 * (lib/organizerWorkspace.ts, organizerEvents.ts, organizerStaff.ts) y nubapay-backend
 * (routes/events.py, event_workspace.py, event_staff.py, event_regrets.py).
 */
import { apiFetch, type ApiResult, apiUpload } from '@/lib/api';

import { eventPaths } from './paths';

const ws = eventPaths.workspace;
const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});
type Pagination = { page: number; page_size: number; total: number };

/** Pide todas las páginas de un listado paginado. */
async function allPages<T>(
  url: (page: number) => string,
  pick: (body: Record<string, unknown>) => T[],
  maxPages = 50,
): Promise<ApiResult<T[]>> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await apiFetch<Record<string, unknown> & { pagination?: Pagination }>(url(page));
    if (!res.ok) return res;
    const items = pick(res.data);
    out.push(...items);
    const total = res.data.pagination?.total ?? out.length;
    if (out.length >= total || items.length === 0) break;
  }
  return { ok: true, data: out };
}

const unwrap = <T, K extends string>(res: ApiResult<Record<K, T>>, key: K): ApiResult<T> =>
  res.ok ? (res.data[key] != null ? { ok: true, data: res.data[key] } : { ok: false, error: 'Respuesta inválida' }) : res;

/* ───────────── Eventos ───────────── */

export type StaffTools = {
  dashboard: boolean;
  storefront: boolean;
  products: boolean;
  scanner: boolean;
  orders: boolean;
  pickup_points: boolean;
  payments: boolean;
};

export type EventDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  is_active: boolean;
  notify_pickup_point: boolean;
  cash_enabled: boolean;
  service_fee_enabled: boolean;
  has_mp_token: boolean;
  has_mp_public_key: boolean;
  mp_card_enabled: boolean;
  has_sipago_credentials: boolean;
  membership?: 'owner' | 'staff';
  tools?: StaffTools;
};

export type EventPatch = Partial<{
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  notify_pickup_point: boolean;
  cash_enabled: boolean;
  mp_card_enabled: boolean;
  mp_access_token: string | null;
  mp_public_key: string | null;
  sipago_client_id: string | null;
  sipago_client_secret: string | null;
}>;

export const getEvent = async (id: string) =>
  unwrap(await apiFetch<{ event: EventDetail }>(eventPaths.detail(id)), 'event');
export const patchEvent = async (id: string, payload: EventPatch) =>
  unwrap(await apiFetch<{ event: EventDetail }>(eventPaths.detail(id), json('PATCH', payload)), 'event');
export const deleteEvent = (id: string) => apiFetch<{ ok: true }>(eventPaths.detail(id), json('DELETE'));

/* ───────────── Pedidos (operaciones) ───────────── */

export type OrderUiStatus = 'pending' | 'partially_delivered' | 'delivered' | 'cancelled';
export type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  isTicket: boolean;
  categoryName: string | null;
  redeemedAt: string | null;
  redeemedQuantity: number | null;
};
export type Order = {
  id: string;
  orderNumber: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  items: OrderItem[];
  total: number;
  serviceFee: number;
  status: OrderUiStatus;
  /** approved | pending | rejected | refunded … */
  paymentStatus: string | null;
  createdAt: string;
  updatedAt: string;
  paymentMethod: 'mp' | 'cash' | 'transfer' | null;
};
export type OrdersQuery = {
  q?: string;
  /** unredeemed | partially_delivered | delivered | cancelled (separados por coma). */
  status?: string;
  /** approved | pending … */
  payment_status?: string;
  /** mp | cash | transfer */
  payment?: string;
  page?: number;
  page_size?: number;
};

export const listOrders = (eventId: string, query: OrdersQuery = {}) =>
  apiFetch<{ orders: Order[]; pagination: Pagination }>(ws(eventId, 'orders', { page_size: 60, ...query }));
export const getOrder = async (eventId: string, orderId: string) =>
  unwrap(await apiFetch<{ order: Order }>(ws(eventId, `orders/${orderId}`)), 'order');
export const cancelOrder = async (eventId: string, orderId: string) =>
  unwrap(await apiFetch<{ order: Order }>(ws(eventId, `orders/${orderId}`), json('PATCH', { status: 'cancelled' })), 'order');
export const confirmCash = async (eventId: string, orderId: string) =>
  unwrap(await apiFetch<{ order: Order }>(ws(eventId, `orders/${orderId}/confirm-cash`), json('POST')), 'order');

/* ───────────── Equipo ───────────── */

export type StaffRow = { id: string; user_id: string; email: string; name: string; role: string; tools: StaffTools };

export const listStaff = async (eventId: string) =>
  unwrap(await apiFetch<{ staff: StaffRow[] }>(ws(eventId, 'staff')), 'staff');
export const inviteStaff = (eventId: string, payload: { name: string; email: string; role: string; tools: StaffTools }) =>
  apiFetch<{ staff: StaffRow; email_sent?: boolean; email_error?: string }>(ws(eventId, 'staff'), json('POST', payload));
export const patchStaff = async (eventId: string, id: string, payload: Partial<{ role: string; tools: StaffTools }>) =>
  unwrap(await apiFetch<{ staff: StaffRow }>(ws(eventId, `staff/${id}`), json('PATCH', payload)), 'staff');
export const deleteStaff = (eventId: string, id: string) =>
  apiFetch<{ ok: true }>(ws(eventId, `staff/${id}`), json('DELETE'));
export const resendStaffInvite = (eventId: string, id: string) =>
  apiFetch<{ email_sent?: boolean }>(ws(eventId, `staff/${id}/resend-email`), json('POST'));

/* ───────────── Catálogo ───────────── */

export type Category = { id: string; name: string; sort_order: number; is_active: boolean };
export type Product = {
  id: string;
  category_id: string | null;
  category_name: string | null;
  name: string;
  description: string;
  price: number;
  type: 'single' | 'combo';
  is_active: boolean;
  image_url: string | null;
};
export type ProductPayload = {
  name: string;
  price: number;
  description?: string | null;
  category_id?: string | null;
  is_active?: boolean;
};

export const listCategories = (eventId: string) =>
  allPages<Category>((page) => ws(eventId, 'categories', { page, page_size: 100 }), (b) => (b.categories as Category[]) ?? []);
export const createCategory = async (eventId: string, name: string) =>
  unwrap(await apiFetch<{ category: Category }>(ws(eventId, 'categories'), json('POST', { name })), 'category');

export const listProducts = (eventId: string) =>
  allPages<Product>((page) => ws(eventId, 'products', { page, page_size: 100 }), (b) => (b.products as Product[]) ?? []);
export const createProduct = async (eventId: string, payload: ProductPayload) =>
  unwrap(await apiFetch<{ product: Product }>(ws(eventId, 'products'), json('POST', { type: 'single', ...payload })), 'product');
export const patchProduct = async (eventId: string, id: string, payload: Partial<ProductPayload>) =>
  unwrap(await apiFetch<{ product: Product }>(ws(eventId, `products/${id}`), json('PATCH', payload)), 'product');
export const deleteProduct = (eventId: string, id: string) =>
  apiFetch<{ paused_combos?: string[] }>(ws(eventId, `products/${id}`), json('DELETE'));

/** Sube la foto elegida (`file://…`) y devuelve el producto con su `image_url` nueva. */
export async function uploadProductImage(eventId: string, id: string, uri: string) {
  const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase().split('?')[0];
  const type = ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return unwrap(
    await apiUpload<{ product: Product }>(ws(eventId, `products/${id}/image`), { uri, name: `foto.${ext}`, type }),
    'product',
  );
}
export const deleteProductImage = (eventId: string, id: string) =>
  apiFetch<{ product: Product }>(ws(eventId, `products/${id}/image`), json('DELETE'));

/* ───────────── Entradas ───────────── */

export type Ticket = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number | null;
  sold: number;
  reserved?: number;
  revenue?: number;
  redeemed?: number;
  sort_order: number;
  is_active: boolean;
};

export const listTickets = async (eventId: string) =>
  unwrap(await apiFetch<{ tickets: Ticket[] }>(ws(eventId, 'tickets')), 'tickets');
export const createTicket = async (eventId: string, payload: { name: string; price: number; stock: number | null }) =>
  unwrap(await apiFetch<{ ticket: Ticket }>(ws(eventId, 'tickets'), json('POST', payload)), 'ticket');
export const patchTicket = async (eventId: string, id: string, payload: Partial<{ is_active: boolean; name: string; price: number; stock: number | null }>) =>
  unwrap(await apiFetch<{ ticket: Ticket }>(ws(eventId, `tickets/${id}`), json('PATCH', payload)), 'ticket');

/* ───────────── Puntos de retiro ───────────── */

export type PickupPoint = { id: string; name: string; description: string; is_active: boolean };

export const listPickupPoints = (eventId: string) =>
  allPages<PickupPoint>(
    (page) => ws(eventId, 'pickup-points', { page, page_size: 100 }),
    (b) => (b.pickup_points as PickupPoint[]) ?? [],
  );
export const createPickupPoint = async (eventId: string, payload: { name: string; description?: string }) =>
  unwrap(await apiFetch<{ pickup_point: PickupPoint }>(ws(eventId, 'pickup-points'), json('POST', payload)), 'pickup_point');
export const patchPickupPoint = async (eventId: string, id: string, payload: Partial<{ is_active: boolean; name: string; description: string | null }>) =>
  unwrap(await apiFetch<{ pickup_point: PickupPoint }>(ws(eventId, `pickup-points/${id}`), json('PATCH', payload)), 'pickup_point');

/* ───────────── Arrepentimientos ───────────── */

export type Regret = {
  id: string;
  fullName: string;
  email: string;
  bankAlias: string;
  whatsapp: string;
  purchaseDetail: string;
  screenshotUrl: string | null;
  status: 'pending' | 'resolved';
  createdAt: string;
};

export const listRegrets = (eventId: string) =>
  allPages<Regret>((page) => ws(eventId, 'regrets', { page, page_size: 100 }), (b) => (b.regrets as Regret[]) ?? []);
export const patchRegret = async (eventId: string, id: string, status: Regret['status']) =>
  unwrap(await apiFetch<{ regret: Regret }>(ws(eventId, `regrets/${id}`), json('PATCH', { status })), 'regret');

/* ───────────── Pagos (comisión) ───────────── */

export type Payment = {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  /** mp | cash | transfer */
  channel: string | null;
  /** Costo de servicio cobrado en el pedido (0 si el evento usa comisión). */
  service_fee?: number;
};

export const listApprovedPayments = (eventId: string) =>
  allPages<Payment>(
    (page) => ws(eventId, 'payments', { page, page_size: 200, status: 'approved' }),
    (b) => (b.payments as Payment[]) ?? [],
  );
