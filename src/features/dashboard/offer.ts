import type { DashboardInsights } from './types';

/** Qué vende el evento: entradas, barra o ambas. */
export type EventOffer = { tickets: boolean; bar: boolean };

/**
 * Entradas: tiene tipos de entrada. Barra: tiene puntos de retiro o vendió productos.
 * Un evento sin nada configurado se trata como "ambas" para no esconder todo el resumen.
 */
export function eventOffer(insights: DashboardInsights): EventOffer {
  const tickets = insights.tickets.types.length > 0;
  const bar =
    insights.pickup_points.length > 0 ||
    insights.products.units_sold > 0 ||
    insights.revenue_split.products > 0;
  return tickets || bar ? { tickets, bar } : { tickets: true, bar: true };
}

/** Si vende una sola cosa, cuál (para titular la recaudación). */
export function singleOffer(offer: EventOffer): 'tickets' | 'bar' | null {
  if (offer.tickets && !offer.bar) return 'tickets';
  if (offer.bar && !offer.tickets) return 'bar';
  return null;
}
