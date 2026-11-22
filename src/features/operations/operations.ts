import { useSyncExternalStore } from 'react';

import type { Order, OrdersQuery } from '@/lib/api/organizer';

/**
 * Operaciones = pedidos del evento (GET /api/events/<id>/orders, routes/event_workspace.py).
 * Búsqueda y filtros van al servidor; aprobar efectivo y cancelar usan sus endpoints.
 */

export type OperationTone = 'attention' | 'success' | 'danger' | 'neutral';

export type OrderStateKey = 'ready' | 'partial' | 'delivered' | 'unpaid' | 'rejected' | 'cancelled';

/**
 * Estado legible del pedido, combinando retiro y pago. `short` es la etiqueta del chip de la card;
 * `exception` marca los que salen del caso normal (no pagados o cancelados) y llevan chip.
 */
export function orderState(o: Order): {
  key: OrderStateKey;
  label: string;
  short: string;
  tone: OperationTone;
  exception: boolean;
} {
  if (o.status === 'cancelled')
    return { key: 'cancelled', label: 'Cancelado', short: 'Cancelado', tone: 'danger', exception: true };
  if (o.paymentStatus && o.paymentStatus !== 'approved') {
    return o.paymentStatus === 'rejected'
      ? { key: 'rejected', label: 'Pago rechazado', short: 'Rechazado', tone: 'danger', exception: true }
      : { key: 'unpaid', label: 'Pendiente de pago', short: 'Sin pagar', tone: 'attention', exception: true };
  }
  if (o.status === 'delivered')
    return { key: 'delivered', label: 'Entregado', short: 'Entregado', tone: 'success', exception: false };
  if (o.status === 'partially_delivered')
    return { key: 'partial', label: 'Entrega parcial', short: 'Parcial', tone: 'neutral', exception: false };
  return { key: 'ready', label: 'Pagado · por retirar', short: 'Por retirar', tone: 'success', exception: false };
}

/** Qué tipo de compra es (para el ícono): solo entradas, solo productos o mixta. */
export function orderKind(o: Order): 'tickets' | 'products' | 'mixed' {
  const t = o.items.some((i) => i.isTicket);
  const p = o.items.some((i) => !i.isTicket);
  return t && p ? 'mixed' : t ? 'tickets' : 'products';
}

export const canConfirmCash = (o: Order) =>
  o.paymentMethod === 'cash' && o.status !== 'cancelled' && o.paymentStatus !== 'approved';
export const canCancel = (o: Order) => o.status !== 'cancelled' && o.status !== 'delivered';

/* ── Filtros (compartidos entre la pestaña y su hoja) ── */

/** `active`: todo menos cancelados (por retirar, entrega parcial y entregados). */
export type RetrievalFilter = 'active' | 'all' | 'unredeemed' | 'partially_delivered' | 'delivered' | 'cancelled';
export type PaymentStatusFilter = 'all' | 'approved' | 'pending';
export type ChannelFilter = 'all' | 'mp' | 'cash' | 'transfer';
export type OperationFilters = {
  status: RetrievalFilter;
  payment: PaymentStatusFilter;
  channel: ChannelFilter;
};

/**
 * Por defecto se ven solo los pedidos pagados y no cancelados (por retirar, entrega parcial y
 * entregados): pendientes de pago, rechazados y cancelados quedan detrás de los filtros.
 */
export const DEFAULT_OPERATION_FILTERS: OperationFilters = { status: 'active', payment: 'approved', channel: 'all' };

export const STATUS_FILTER_LABEL: Record<RetrievalFilter, string> = {
  active: 'Sin cancelados',
  all: 'Todos',
  unredeemed: 'Por retirar',
  partially_delivered: 'Entrega parcial',
  delivered: 'Entregados',
  cancelled: 'Cancelados',
};
export const PAYMENT_FILTER_LABEL: Record<PaymentStatusFilter, string> = {
  all: 'Todos',
  approved: 'Aprobados',
  pending: 'Pendientes',
};
export const CHANNEL_FILTER_LABEL: Record<ChannelFilter, string> = {
  all: 'Todos',
  mp: 'Mercado Pago',
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

/** Cuántos filtros difieren de los de por defecto (para el badge del botón). */
export const activeOperationFilters = (f: OperationFilters) =>
  (f.status !== DEFAULT_OPERATION_FILTERS.status ? 1 : 0) +
  (f.payment !== DEFAULT_OPERATION_FILTERS.payment ? 1 : 0) +
  (f.channel !== DEFAULT_OPERATION_FILTERS.channel ? 1 : 0);

/** `active` = los estados no cancelados; el backend acepta varios separados por coma. */
const STATUS_QUERY: Partial<Record<RetrievalFilter, string>> = {
  active: 'unredeemed,partially_delivered,delivered',
};

/** Filtros + búsqueda → query del endpoint de pedidos. */
export function ordersQuery(f: OperationFilters, q: string): OrdersQuery {
  return {
    q: q.trim().replace(/^#/, '') || undefined,
    status: f.status !== 'all' ? (STATUS_QUERY[f.status] ?? f.status) : undefined,
    payment_status: f.payment !== 'all' ? f.payment : undefined,
    payment: f.channel !== 'all' ? f.channel : undefined,
  };
}

let opFilters: OperationFilters = DEFAULT_OPERATION_FILTERS;
const listeners = new Set<() => void>();

export function setOperationFilters(next: OperationFilters) {
  opFilters = next;
  listeners.forEach((l) => l());
}

export function useOperationFilters(): OperationFilters {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => opFilters,
  );
}
