/**
 * Datos que la app le pasa al widget y a la Live Activity. Los arma el backend
 * (services/live_pulse.py) ya formateados: el código del widget corre aislado (sin imports ni
 * helpers) y así la app, el widget y los push de APNs muestran siempre lo mismo.
 *
 * Además de la recaudación, el contenido se adapta a lo que vende el evento:
 * - entradas: "Entradas 860 / 1.200" (con barra de aforo) e "Ingresaron 640";
 * - productos: "Productos 312" y "Por entregar 45";
 * - las dos cosas: entradas vendidas y productos por entregar.
 */
export type EventPulseProps = {
  eventName: string;
  /** "$ 950" o, desde $1.000, compacto: "$1,2k", "$340k", "$1,3M". */
  revenue: string;
  /** Siempre compacto ("$950", "$12k", "$1,3M"): Dynamic Island compacta. */
  revenueShort: string;
  /** "Todo el evento" */
  period: string;
  /** "312 pedidos" */
  orders: string;
  /** SF Symbol según lo que vende (entradas, barra, o las dos cosas). */
  icon: 'ticket.fill' | 'wineglass.fill' | 'chart.line.uptrend.xyaxis';
  /** Dato principal según el catálogo ("Entradas" / "Productos"). */
  mainLabel: string;
  mainValue: string;
  /** Ritmo: lo vendido en la última hora ("Última hora" / "+$120K"). */
  paceLabel: string;
  paceValue: string;
  /** Lo vendido en cada tramo de 5 min de la última hora (12 montos; el último es el actual). */
  paceSeries: number[];
  /** Últimos 15 min contra los 15 anteriores; "flat" si no se vendió nada en media hora. */
  paceTrend: 'up' | 'down' | 'flat';
  /** Segundo dato según el catálogo ("Ingresaron" / "Por entregar"). */
  extraLabel: string;
  extraValue: string;
  /** Vendidas / aforo (0–1) para la barra; -1 si no hay entradas con tope. */
  ratio: number;
  /** "Actualizado 14:32" */
  updated: string;
};

/** Estado vacío (sin sesión o antes de la primera carga). */
export const EMPTY_PULSE: EventPulseProps = {
  eventName: 'Abrí Nubapay',
  revenue: '$ 0',
  revenueShort: '$0',
  period: '',
  orders: '',
  icon: 'chart.line.uptrend.xyaxis',
  mainLabel: '',
  mainValue: '',
  paceLabel: '',
  paceValue: '',
  paceSeries: [],
  paceTrend: 'flat',
  extraLabel: '',
  extraValue: '',
  ratio: -1,
  updated: '',
};
