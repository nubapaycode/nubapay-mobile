import { useSyncExternalStore } from 'react';

import type { Order, OrdersQuery } from '@/lib/api/organizer';

/**
 * Operaciones = pedidos del evento (GET /api/events/<id>/orders, routes/event_workspace.py).
 * Búsqueda y filtros van al servidor; aprobar efectivo y cancelar usan sus endpoints.
 */

export type OperationTone = 'attention' | 'success' | 'danger' | 'neutral';

/** Estado legible del pedido, combinando retiro y pago. */
export function orderState(o: Order): { label: string; tone: OperationTone } {
  if (o.status === 'cancelled') return { label: 'Cancelado', tone: 'danger' };
  if (o.paymentStatus && o.paymentStatus !== 'approved') {
    return { label: o.paymentStatus === 'rejected' ? 'Pago rechazado' : 'Pendiente de pago', tone: 'attention' };
  }
  if (o.status === 'delivered') return { label: 'Entregado', tone: 'success' };
  if (o.status === 'partially_delivered') return { label: 'Entrega parcial', tone: 'neutral' };
  return { label: 'Pagado · por retirar', tone: 'success' };
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

export type RetrievalFilter = 'all' | 'unredeemed' | 'partially_delivered' | 'delivered' | 'cancelled';
export type PaymentStatusFilter = 'all' | 'approved' | 'pending';
export type ChannelFilter = 'all' | 'mp' | 'cash' | 'transfer';
export type OperationFilters = {
  status: RetrievalFilter;
  payment: PaymentStatusFilter;
  channel: ChannelFilter;
};

export const DEFAULT_OPERATION_FILTERS: OperationFilters = { status: 'all', payment: 'all', channel: 'all' };

export const STATUS_FILTER_LABEL: Record<RetrievalFilter, string> = {
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

export const activeOperationFilters = (f: OperationFilters) =>
  (f.status !== 'all' ? 1 : 0) + (f.payment !== 'all' ? 1 : 0) + (f.channel !== 'all' ? 1 : 0);

/** Filtros + búsqueda → query del endpoint de pedidos. */
export function ordersQuery(f: OperationFilters, q: string): OrdersQuery {
  return {
    q: q.trim().replace(/^#/, '') || undefined,
    status: f.status !== 'all' ? f.status : undefined,
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
