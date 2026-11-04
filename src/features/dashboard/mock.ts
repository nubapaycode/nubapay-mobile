/**
 * Datos mock con la misma forma que devuelve el backend. Deterministas por evento (PRNG con semilla)
 * para que el diseño sea estable entre recargas; el evento "en vivo" además recibe ventas simuladas.
 */
import type { DashboardFilters, DashboardScope } from './filters';
import type {
  ActivityItem,
  DashboardData,
  DashboardInsights,
  DashboardSummary,
  EventPhase,
  EventSummary,
  PaymentKey,
  SeriesPoint,
} from './types';

const DAY = 86_400_000;
const HISTORY_DAYS = 60;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ISO local sin zona (igual que `starts_at` en el backend). */
function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}
const ymd = (d: Date) => localIso(d).slice(0, 10);
const dayLabel = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

type Spec = {
  phase: EventPhase;
  seed: number;
  totalRevenue: number;
  ticketShare: number;
  /** Índice del día del evento dentro del historial (59 = hoy); puede ser > 59 si es futuro. */
  eventDayIndex: number;
  tickets: {
    name: string;
    price: number;
    capacity: number | null;
    soldRatio: number;
    checkinRatio: number;
  }[];
  products: { name: string; price: number; weight: number }[];
  pickupPoints: string[];
};

const PRODUCTS = [
  { name: 'Fernet con coca', price: 6500, weight: 10 },
  { name: 'Cerveza IPA pinta', price: 5200, weight: 9 },
  { name: 'Gin tonic', price: 7800, weight: 4.5 },
  { name: 'Agua mineral', price: 2500, weight: 5 },
  { name: 'Combo 4 cervezas', price: 18000, weight: 3 },
  { name: 'Hamburguesa doble', price: 9500, weight: 3 },
  { name: 'Energizante', price: 4000, weight: 2 },
];

const NAMES = [
  'Martina López',
  'Joaquín Pérez',
  'Valentina Gómez',
  'Santiago Díaz',
  'Camila Fernández',
  'Tomás Romero',
  'Lucía Álvarez',
  'Benjamín Torres',
  'Sofía Ruiz',
  'Mateo Acosta',
  'Emilia Herrera',
  'Thiago Medina',
  'Isabella Castro',
  'Bautista Sosa',
  'Catalina Vera',
];
const STAFF = ['Lucía (puerta)', 'Mateo (barra)', 'Sofía (VIP)', 'Nicolás (puerta 2)'];

function buildEvents(now: Date): { event: EventSummary; spec: Spec }[] {
  const today = new Date(now);
  const at = (dayOffset: number, hour: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, hour, 0);
    return localIso(d);
  };
  // El evento en vivo arrancó hace ~3 h y termina en ~5 h (sirve a cualquier hora del día).
  const liveStart = new Date(now.getTime() - 3 * 3_600_000);
  const liveEnd = new Date(now.getTime() + 5 * 3_600_000);
  return [
    {
      event: {
        id: 'evt-live',
        name: 'Nuba Fest · Primavera',
        slug: 'nuba-fest-primavera',
        cover_image_url: null,
        starts_at: localIso(liveStart),
        ends_at: localIso(liveEnd),
        status: 'published',
        is_active: true,
        membership: 'owner',
      },
      spec: {
        phase: 'live',
        seed: 11,
        totalRevenue: 48_650_000,
        ticketShare: 0.64,
        eventDayIndex: 59,
        tickets: [
          { name: 'Early bird', price: 12000, capacity: 300, soldRatio: 1, checkinRatio: 0.86 },
          { name: 'General', price: 18000, capacity: 1200, soldRatio: 0.83, checkinRatio: 0.71 },
          { name: 'VIP', price: 35000, capacity: 250, soldRatio: 0.92, checkinRatio: 0.64 },
        ],
        products: PRODUCTS,
        pickupPoints: ['Barra principal', 'Barra VIP', 'Food truck'],
      },
    },
    {
      event: {
        id: 'evt-upcoming',
        name: 'Sunset Rooftop Sessions',
        slug: 'sunset-rooftop',
        cover_image_url: null,
        starts_at: at(5, 18),
        ends_at: at(5, 23),
        status: 'published',
        is_active: true,
        membership: 'owner',
      },
      spec: {
        phase: 'upcoming',
        seed: 23,
        totalRevenue: 9_870_000,
        ticketShare: 0.93,
        eventDayIndex: 64,
        tickets: [
          { name: 'Preventa 1', price: 15000, capacity: 200, soldRatio: 1, checkinRatio: 0 },
          { name: 'Preventa 2', price: 19000, capacity: 300, soldRatio: 0.41, checkinRatio: 0 },
          { name: 'Mesa x4', price: 90000, capacity: 20, soldRatio: 0.55, checkinRatio: 0 },
        ],
        products: PRODUCTS.slice(0, 5).map((p) => ({ ...p, weight: p.weight / 6 })),
        pickupPoints: ['Barra terraza'],
      },
    },
    {
      event: {
        id: 'evt-ended',
        name: 'Noche de Gala 2026',
        slug: 'noche-de-gala',
        cover_image_url: null,
        starts_at: at(-18, 21),
        ends_at: at(-17, 4),
        status: 'published',
        is_active: false,
        membership: 'staff',
      },
      spec: {
        phase: 'ended',
        seed: 37,
        totalRevenue: 61_200_000,
        ticketShare: 0.58,
        eventDayIndex: 41,
        tickets: [
          { name: 'General', price: 22000, capacity: 1400, soldRatio: 0.97, checkinRatio: 0.91 },
          { name: 'VIP', price: 45000, capacity: 300, soldRatio: 1, checkinRatio: 0.94 },
          { name: 'Invitación', price: 0, capacity: null, soldRatio: 0, checkinRatio: 0.8 },
        ],
        products: PRODUCTS,
        pickupPoints: ['Barra principal', 'Barra VIP', 'Barra patio', 'Food truck'],
      },
    },
    // Solo vende entradas (sin barra): para ver el home sin la tarjeta de Barra.
    {
      event: {
        id: 'evt-tickets-only',
        name: 'Stand-up en el Teatro',
        slug: 'stand-up-teatro',
        cover_image_url: null,
        starts_at: at(12, 21),
        ends_at: at(12, 23),
        status: 'published',
        is_active: true,
        membership: 'owner',
      },
      spec: {
        phase: 'upcoming',
        seed: 53,
        totalRevenue: 7_420_000,
        ticketShare: 1,
        eventDayIndex: 71,
        tickets: [
          { name: 'Platea', price: 16000, capacity: 320, soldRatio: 0.78, checkinRatio: 0 },
          { name: 'Pullman', price: 11000, capacity: 180, soldRatio: 0.52, checkinRatio: 0 },
        ],
        products: [],
        pickupPoints: [],
      },
    },
    // Solo vende barra (sin entradas): para ver el home sin la tarjeta de Entradas.
    {
      event: {
        id: 'evt-bar-only',
        name: 'Feria Gastronómica Costanera',
        slug: 'feria-costanera',
        cover_image_url: null,
        starts_at: at(-6, 12),
        ends_at: at(-6, 22),
        status: 'published',
        is_active: false,
        membership: 'owner',
      },
      spec: {
        phase: 'ended',
        seed: 67,
        totalRevenue: 14_300_000,
        ticketShare: 0,
        eventDayIndex: 53,
        tickets: [],
        products: PRODUCTS,
        pickupPoints: ['Stand cervezas', 'Stand comidas'],
      },
    },
  ];
}

/** Recaudación diaria de los últimos 60 días (índice 59 = hoy), escalada a `totalRevenue`. */
function dailyHistory(spec: Spec, rand: () => number): number[] {
  const raw = Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const toEvent = spec.eventDayIndex - i;
    if (toEvent < 0) return 0; // después del evento no hay ventas
    if (i < spec.eventDayIndex - 45) return 0; // antes de abrir la venta
    if (toEvent === 0) return 30 * (0.9 + rand() * 0.2); // el día del evento (puerta + barra)
    const ramp = 1 + (45 - toEvent) / 9; // la preventa acelera al acercarse la fecha
    const weekend = [5, 6].includes(new Date(Date.now() - (59 - i) * DAY).getDay()) ? 1.35 : 1;
    return ramp * weekend * (0.6 + rand() * 0.8);
  });
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((v) => (v / sum) * spec.totalRevenue);
}

const AVG_ORDER = 21_500;

function sliceTotals(values: number[]) {
  const revenue = values.reduce((a, b) => a + b, 0);
  const order_count = Math.round(revenue / AVG_ORDER);
  return {
    total_revenue: revenue,
    order_count,
    avg_ticket: order_count ? revenue / order_count : 0,
  };
}

function buildSummary(
  spec: Spec,
  /** `null` = sin rango (últimas 8 h por hora); si no, cantidad de días hacia atrás. */
  rangeDays: number | null,
  now: Date,
  rand: () => number,
): DashboardSummary {
  const history = dailyHistory(spec, rand);
  const all = sliceTotals(history);

  let totals = all;
  let series: DashboardSummary['series'];
  let comparison: DashboardSummary['comparison'] = null;
  let rangeOut: DashboardSummary['range'] = null;

  // Últimas 8 h (igual que el backend sin rango): solo hay ventas si el evento está en curso.
  const hourly = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now.getTime() - (7 - i) * 3_600_000);
    const weight = spec.phase === 'live' ? [0.2, 0.3, 0.5, 0.9, 1.6, 2.4, 2.9, 2.2][i] : 0;
    const revenue = (history[59] / 11) * weight * (0.85 + rand() * 0.3);
    return {
      label: `${String(d.getHours()).padStart(2, '0')}h`,
      revenue,
      orders: Math.round(revenue / AVG_ORDER),
    };
  });

  if (rangeDays == null) {
    series = { kind: 'hourly', points: hourly };
  } else {
    const days = Math.min(30, Math.max(1, rangeDays));
    const cur = history.slice(HISTORY_DAYS - days);
    const prev = history.slice(HISTORY_DAYS - 2 * days, HISTORY_DAYS - days);
    totals = sliceTotals(cur);
    const points: SeriesPoint[] = cur.map((revenue, i) => {
      const d = new Date(now.getTime() - (days - 1 - i) * DAY);
      return {
        label: dayLabel(d),
        revenue,
        orders: Math.round(revenue / AVG_ORDER),
        prev_revenue: prev[i],
        prev_orders: Math.round(prev[i] / AVG_ORDER),
      };
    });
    series = { kind: 'daily', points };
    const from = new Date(now.getTime() - (days - 1) * DAY);
    rangeOut = { from: ymd(from), to: ymd(now) };
    comparison = {
      ...sliceTotals(prev),
      range: {
        from: ymd(new Date(from.getTime() - days * DAY)),
        to: ymd(new Date(from.getTime() - DAY)),
      },
    };
  }

  const shares: Record<PaymentKey, number> = { mp: 0.68, cash: 0.22, transfer: 0.1 };
  const payment_breakdown = (Object.keys(shares) as PaymentKey[]).map((key) => ({
    key,
    revenue: totals.total_revenue * shares[key],
    count: Math.round(totals.order_count * shares[key]),
  }));

  const productRevenue = totals.total_revenue * (1 - spec.ticketShare);
  const weightSum = spec.products.reduce((a, p) => a + p.price * p.weight, 0) || 1;
  const productRows = spec.products.map((p) => {
    const revenue = (productRevenue * p.price * p.weight) / weightSum;
    return { name: p.name, quantity: Math.round(revenue / p.price), revenue };
  });
  const ticketRevenue = totals.total_revenue * spec.ticketShare;
  const ticketWeight =
    spec.tickets.reduce((a, t) => a + t.price * (t.capacity ?? 0) * t.soldRatio, 0) || 1;
  const ticketRows = spec.tickets
    .filter((t) => t.price > 0)
    .map((t) => {
      const revenue = (ticketRevenue * t.price * (t.capacity ?? 0) * t.soldRatio) / ticketWeight;
      return { name: `Entrada ${t.name}`, quantity: Math.round(revenue / t.price), revenue };
    });
  const top_products = [...productRows, ...ticketRows]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const delivered =
    spec.phase === 'ended'
      ? totals.order_count
      : spec.phase === 'live'
        ? Math.round(totals.order_count * 0.74)
        : 0;
  const pending = Math.max(0, totals.order_count - delivered);

  const per_minute = Array.from({ length: 30 }, (_, i) =>
    spec.phase === 'live' ? Math.round(rand() * 3 + (i > 18 ? rand() * 3 : 0)) : 0,
  );
  const ordersLastHour = spec.phase === 'live' ? per_minute.reduce((a, b) => a + b, 0) * 2 : 0;

  return {
    ...totals,
    active_orders: pending,
    delivered_orders: delivered,
    by_status: {
      pending: Math.round(pending * 0.3),
      paid: Math.round(pending * 0.6),
      delivered,
      cancelled: 0,
      partially_delivered: Math.round(pending * 0.1),
    },
    hourly: hourly.map((h) => ({ hour: h.label, revenue: h.revenue })),
    series,
    range: rangeOut,
    comparison,
    filters: { payment: null, product: null },
    payment_breakdown,
    top_products,
    live: {
      orders_last_hour: ordersLastHour,
      revenue_last_hour: ordersLastHour * AVG_ORDER,
      per_minute,
    },
  };
}

function buildActivity(
  spec: Spec,
  event: EventSummary,
  now: Date,
  rand: () => number,
): ActivityItem[] {
  const base =
    spec.phase === 'live'
      ? now.getTime()
      : spec.phase === 'ended'
        ? new Date(event.ends_at ?? now).getTime()
        : now.getTime() - 40 * 60_000;
  const items: ActivityItem[] = [];
  let t = base - 25_000;
  for (let i = 0; i < 15; i++) {
    const r = rand();
    // Solo hay ingresos si vende entradas y retiros si vende barra.
    const hasTickets = spec.tickets.length > 0;
    const hasBar = spec.products.length > 0;
    const type: ActivityItem['type'] =
      spec.phase === 'upcoming' || r < 0.45
        ? 'sale'
        : hasTickets && (!hasBar || r < 0.75)
          ? 'ticket_checkin'
          : hasBar
            ? 'pickup'
            : 'sale';
    const product = spec.products[Math.floor(rand() * spec.products.length)];
    const ticket = spec.tickets[Math.floor(rand() * spec.tickets.length)];
    const qty = 1 + Math.floor(rand() * 3);
    const sellsTicket = !product || (!!ticket?.price && rand() < 0.4);
    const amount = type === 'sale' ? qty * (sellsTicket ? ticket.price : product.price) : null;
    items.push({
      type,
      at: new Date(t).toISOString(),
      order_id: `ord-${spec.seed}-${i}`,
      order_number: 4800 - i * 3,
      customer_name: NAMES[Math.floor(rand() * NAMES.length)],
      amount,
      summary:
        type === 'ticket_checkin' || (type === 'sale' && sellsTicket)
          ? `${qty}× Entrada ${ticket.name}`
          : `${qty}× ${product.name}${type === 'sale' && rand() < 0.3 ? ', 1× Agua mineral' : ''}`,
    });
    t -= (spec.phase === 'upcoming' ? 3_600_000 : 70_000) * (0.4 + rand() * 1.6);
  }
  return items;
}

function buildInsights(
  spec: Spec,
  event: EventSummary,
  now: Date,
  rand: () => number,
): DashboardInsights {
  const types = spec.tickets.map((t, i) => {
    const sold = t.capacity == null ? 140 : Math.round(t.capacity * t.soldRatio);
    return {
      id: `tkt-${spec.seed}-${i}`,
      name: t.name,
      price: t.price,
      is_active: !(t.capacity != null && sold >= t.capacity),
      sold,
      capacity: t.capacity,
      checked_in: Math.round(sold * t.checkinRatio),
      revenue: sold * t.price,
    };
  });
  const sold = types.reduce((a, t) => a + t.sold, 0);
  const capacity = types.every((t) => t.capacity != null)
    ? types.reduce((a, t) => a + (t.capacity ?? 0), 0)
    : null;
  const ticketRevenue = types.reduce((a, t) => a + t.revenue, 0);

  const allRevenue = sliceTotals(dailyHistory(spec, rng(spec.seed))).total_revenue;
  const productRevenue = allRevenue * (1 - spec.ticketShare);
  const unitsSold = Math.round(productRevenue / 6200);
  const deliveredRatio = spec.phase === 'ended' ? 1 : spec.phase === 'live' ? 0.88 : 0;
  const unitsDelivered = Math.round(unitsSold * deliveredRatio);

  const ppShares = [0.52, 0.27, 0.13, 0.08];
  const pickup_points = spec.pickupPoints.map((name, i) => {
    const share =
      ppShares[i] / ppShares.slice(0, spec.pickupPoints.length).reduce((a, b) => a + b, 0);
    const orders = Math.round((productRevenue * share) / 9800);
    return {
      id: `pp-${spec.seed}-${i}`,
      name,
      is_active: spec.phase !== 'ended',
      orders,
      revenue: productRevenue * share,
      pending_orders: spec.phase === 'live' ? Math.round(orders * (0.004 + rand() * 0.012)) : 0,
    };
  });

  const orderCount = Math.round(allRevenue / AVG_ORDER);
  const unique = Math.round(orderCount * 0.71);

  const staff_scans =
    spec.phase === 'upcoming'
      ? []
      : STAFF.map((name, i) => ({
          user_id: `usr-${i}`,
          name,
          units_redeemed: Math.round((sold * 0.8 + unitsDelivered) * [0.36, 0.29, 0.21, 0.14][i]),
        }));

  const peakStart = new Date(new Date(event.starts_at ?? now).getTime() + 2 * 3_600_000);
  peakStart.setMinutes(0, 0, 0);

  return {
    generated_at: now.toISOString(),
    event: { phase: spec.phase, starts_at: event.starts_at, ends_at: event.ends_at },
    tickets: {
      sold,
      capacity,
      checked_in: types.reduce((a, t) => a + t.checked_in, 0),
      revenue: ticketRevenue,
      types,
    },
    products: {
      units_sold: unitsSold,
      units_delivered: unitsDelivered,
      units_pending: unitsSold - unitsDelivered,
      revenue: productRevenue,
    },
    revenue_split: { tickets: ticketRevenue, products: productRevenue },
    pickup_points,
    customers: { unique, repeat: Math.round(unique * 0.18), avg_items_per_order: 2.4 },
    cash_pending:
      spec.phase === 'ended'
        ? { orders: 0, amount: 0 }
        : {
            orders: spec.phase === 'live' ? 9 : 3,
            amount: spec.phase === 'live' ? 187_500 : 57_000,
          },
    staff_scans,
    peak_hour:
      spec.phase === 'upcoming'
        ? null
        : {
            start: localIso(peakStart),
            label: `${String(peakStart.getHours()).padStart(2, '0')}h`,
            orders: 412,
            revenue: 412 * AVG_ORDER,
          },
    recent_activity: buildActivity(spec, event, now, rand),
  };
}

export function mockEvents(now = new Date()): EventSummary[] {
  return buildEvents(now).map((e) => e.event);
}

/** Días que cubre el período (null = ritmo por hora: todo el evento, hoy o un rango de ≤ 24 h). */
function periodDays(p: DashboardFilters['period']): number | null {
  if ('preset' in p) return p.preset === '7d' ? 7 : p.preset === '30d' ? 30 : null;
  const hours = (p.to.getTime() - p.from.getTime()) / 3_600_000;
  return hours <= 24 ? null : Math.ceil(hours / 24);
}

/** Recorta el resumen a entradas o barra (en el mock: proporción fija de cada evento). */
function scopeSummary(s: DashboardSummary, share: number, scope: DashboardScope): DashboardSummary {
  const k = (n: number) => n * share;
  const ki = (n: number) => Math.round(n * share);
  return {
    ...s,
    total_revenue: k(s.total_revenue),
    order_count: ki(s.order_count),
    series: {
      ...s.series,
      points: s.series.points.map((pt) => ({
        ...pt,
        revenue: k(pt.revenue),
        orders: ki(pt.orders),
        prev_revenue: pt.prev_revenue != null ? k(pt.prev_revenue) : undefined,
        prev_orders: pt.prev_orders != null ? ki(pt.prev_orders) : undefined,
      })),
    },
    comparison: s.comparison
      ? { ...s.comparison, total_revenue: k(s.comparison.total_revenue), order_count: ki(s.comparison.order_count) }
      : null,
    payment_breakdown: s.payment_breakdown.map((p) => ({ ...p, revenue: k(p.revenue), count: ki(p.count) })),
    top_products: s.top_products.filter((r) =>
      scope === 'tickets' ? r.name.startsWith('Entrada') : !r.name.startsWith('Entrada'),
    ),
  };
}

export function mockDashboard(
  eventId: string,
  filters: DashboardFilters,
  now = new Date(),
): DashboardData | null {
  const found = buildEvents(now).find((e) => e.event.id === eventId);
  if (!found) return null;
  const { spec, event } = found;
  const base = buildSummary(spec, periodDays(filters.period), now, rng(spec.seed));
  const summary =
    filters.scope === 'all'
      ? base
      : scopeSummary(
          base,
          filters.scope === 'tickets' ? spec.ticketShare : 1 - spec.ticketShare,
          filters.scope,
        );
  const insights = buildInsights(spec, event, now, rng(spec.seed * 7));
  return { summary, insights };
}

/** Simula una venta / ingreso nuevos en un evento en curso (para ver las animaciones en vivo). */
export function applyLiveTick(data: DashboardData, tick: number): DashboardData {
  const rand = rng(1000 + tick);
  const { summary, insights } = data;
  const isSale = rand() < 0.65;
  const product = PRODUCTS[Math.floor(rand() * PRODUCTS.length)];
  const qty = 1 + Math.floor(rand() * 3);
  const amount = isSale ? product.price * qty : 0;
  const now = new Date();

  const points = summary.series.points.map((p, i, arr) =>
    i === arr.length - 1
      ? { ...p, revenue: p.revenue + amount, orders: p.orders + (isSale ? 1 : 0) }
      : p,
  );
  const per_minute = [...summary.live.per_minute];
  if (tick % 15 === 0) {
    per_minute.shift();
    per_minute.push(0);
  }
  if (isSale) per_minute[per_minute.length - 1] += 1;

  const orderCount = summary.order_count + (isSale ? 1 : 0);
  const revenue = summary.total_revenue + amount;
  const checkin = !isSale;
  const types = insights.tickets.types.map((t, i) =>
    checkin && i === 1 && t.checked_in < t.sold ? { ...t, checked_in: t.checked_in + qty } : t,
  );

  const item: ActivityItem = {
    type: isSale ? 'sale' : 'ticket_checkin',
    at: now.toISOString(),
    order_id: `ord-live-${tick}`,
    order_number: 4801 + tick,
    customer_name: NAMES[Math.floor(rand() * NAMES.length)],
    amount: isSale ? amount : null,
    summary: isSale ? `${qty}× ${product.name}` : `${qty}× Entrada General`,
  };

  return {
    summary: {
      ...summary,
      total_revenue: revenue,
      order_count: orderCount,
      avg_ticket: orderCount ? revenue / orderCount : 0,
      series: { ...summary.series, points },
      payment_breakdown: summary.payment_breakdown.map((p) =>
        p.key === 'mp' && isSale ? { ...p, revenue: p.revenue + amount, count: p.count + 1 } : p,
      ),
      live: {
        orders_last_hour: summary.live.orders_last_hour + (isSale ? 1 : 0),
        revenue_last_hour: summary.live.revenue_last_hour + amount,
        per_minute,
      },
    },
    insights: {
      ...insights,
      generated_at: now.toISOString(),
      tickets: {
        ...insights.tickets,
        types,
        checked_in: types.reduce((a, t) => a + t.checked_in, 0),
      },
      products: isSale
        ? {
            ...insights.products,
            units_sold: insights.products.units_sold + qty,
            units_pending: insights.products.units_pending + qty,
            revenue: insights.products.revenue + amount,
          }
        : insights.products,
      revenue_split: {
        ...insights.revenue_split,
        products: insights.revenue_split.products + amount,
      },
      recent_activity: [item, ...insights.recent_activity].slice(0, 15),
    },
  };
}
