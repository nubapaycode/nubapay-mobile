import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { type EventDetail, getEvent } from '@/lib/api/organizer';
import { useQuery } from '@/lib/query';

/**
 * Métodos de pago del evento (son por evento en el backend: routes/events.py PATCH).
 * - Efectivo: `cash_enabled`.
 * - Mercado Pago: Access Token + Public Key (`has_mp_token`, `has_mp_public_key`); el cobro con
 *   tarjeta en el sitio es `mp_card_enabled`.
 * - Sipago: Client ID + Client Secret (`has_sipago_credentials`).
 * Las credenciales nunca vuelven del backend: solo se sabe si están cargadas.
 */
export type PaymentMethodId = 'cash' | 'mercadopago' | 'sipago';

export const METHOD_LABEL: Record<PaymentMethodId, string> = {
  cash: 'Efectivo',
  mercadopago: 'Mercado Pago',
  sipago: 'Sipago',
};

export const METHODS: PaymentMethodId[] = ['mercadopago', 'sipago', 'cash'];

/** Un método cobra si está activo y configurado. */
export function isReady(id: PaymentMethodId, e: EventDetail): boolean {
  if (id === 'cash') return e.cash_enabled;
  if (id === 'mercadopago') return e.has_mp_token;
  return e.has_sipago_credentials;
}

/** Detalle del evento seleccionado (con cache: `event:<id>`). */
export function useSelectedEventDetail() {
  const id = useSelectedEventId();
  const q = useQuery<EventDetail>(id ? `event:${id}` : null, () => getEvent(id!));
  return { eventId: id, ...q };
}

/** Comisión de Nubapay cuando el evento no cobra costo de servicio: 1 % sobre lo facturado. */
export const COMMISSION_RATE = 0.01;

/** Lo que le corresponde a Nubapay por un pago aprobado (igual que el panel web). */
export function settlementDue(amount: number, serviceFee: number, serviceFeeEnabled: boolean) {
  if (serviceFeeEnabled) return serviceFee;
  return Math.max(0, amount - serviceFee) * COMMISSION_RATE;
}
