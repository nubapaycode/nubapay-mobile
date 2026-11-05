import type { Order, OrderItem } from '@/lib/api/organizer';

/**
 * Escaneo de retiros e ingresos (POST /scan-qr/preview y /scan-qr), igual que el escáner del panel
 * web (nubapay-frontend/components/organizer/ScannerView.tsx).
 */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** El QR trae la URL del pedido (`…/order/<id>`) o el ID solo. */
export function parseOrderId(data: string): string | null {
  const raw = data.trim();
  try {
    const parts = new URL(raw).pathname.split('/');
    const idx = parts.indexOf('order');
    if (idx !== -1 && parts[idx + 1] && UUID.test(parts[idx + 1])) return parts[idx + 1];
  } catch {
    // No es una URL: se busca el ID en el texto.
  }
  return raw.match(UUID)?.[0] ?? null;
}

export const redeemedOf = (i: OrderItem) => i.redeemedQuantity ?? (i.redeemedAt ? i.quantity : 0);
export const remainingOf = (i: OrderItem) => Math.max(0, i.quantity - redeemedOf(i));
export const hasPending = (o: Order) => o.status !== 'cancelled' && o.items.some((i) => remainingOf(i) > 0);

/** Un pedido en efectivo sin cobrar: primero se confirma que se recibió la plata. */
export const awaitingCash = (o: Order) => o.paymentMethod === 'cash' && o.paymentStatus !== 'approved';

type ScanKind = 'tickets' | 'products' | 'mixed';
export function scanKind(o: Order): ScanKind {
  if (o.items.length > 0 && o.items.every((i) => i.isTicket)) return 'tickets';
  if (o.items.some((i) => i.isTicket)) return 'mixed';
  return 'products';
}

/** Las entradas se "usan"; los productos se "entregan". */
export const SCAN_COPY: Record<
  ScanKind,
  { prompt: string; confirm: (n: number) => string; done: string; partial: string; pendingNote: string; alreadyDone: string }
> = {
  products: {
    prompt: '¿Qué entregás ahora?',
    confirm: (n) => `Marcar ${n} entregado${n === 1 ? '' : 's'}`,
    done: 'Pedido entregado',
    partial: 'Entrega parcial registrada',
    pendingNote: 'Quedan productos pendientes. Podés volver a escanear este QR para entregarlos.',
    alreadyDone: 'El pedido ya fue entregado',
  },
  tickets: {
    prompt: 'Entradas a usar',
    confirm: (n) => `Marcar ${n} entrada${n === 1 ? '' : 's'} como usada${n === 1 ? '' : 's'}`,
    done: 'Entradas usadas',
    partial: 'Uso parcial registrado',
    pendingNote: 'Quedan entradas sin usar. Podés volver a escanear este QR para usarlas.',
    alreadyDone: 'Las entradas ya fueron usadas',
  },
  mixed: {
    prompt: 'Entradas a usar y productos a entregar',
    confirm: (n) => `Confirmar ${n}`,
    done: 'Pedido completado',
    partial: 'Registro parcial guardado',
    pendingNote: 'Quedan entradas o productos pendientes. Podés volver a escanear este QR.',
    alreadyDone: 'El pedido ya fue completado',
  },
};
