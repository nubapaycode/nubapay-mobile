/**
 * Datos que la app le pasa al widget y a la Live Activity. Ya van formateados: el código del
 * widget corre aislado (sin imports ni helpers), así que no puede formatear plata ni fechas.
 */
export type EventPulseProps = {
  eventName: string;
  /** "$ 1.284.500" */
  revenue: string;
  /** "$1,2 M": para lugares chicos (Dynamic Island compacta). */
  revenueShort: string;
  /** "Hoy", "Últimos 7 días"… */
  period: string;
  /** "860 / 1.200" o "860 vendidas". */
  sold: string;
  /** Vendidas / capacidad (0–1); -1 si no hay tope. */
  ratio: number;
  /** "312 pedidos" */
  orders: string;
  /** "Actualizado 14:32" */
  updated: string;
};
