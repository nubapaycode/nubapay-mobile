/**
 * Contratos del backend (nubapay-backend):
 * - `GET /api/events`                              → EventSummary[]
 * - `GET /api/events/<id>/dashboard`               → DashboardSummary  (routes/event_workspace.py)
 * - `GET /api/events/<id>/dashboard/insights`      → DashboardInsights (routes/event_insights.py)
 */

export type PaymentKey = 'mp' | 'cash' | 'transfer';
export type EventPhase = 'upcoming' | 'live' | 'ended' | 'unscheduled';

export type EventSummary = {
  id: string;
  name: string;
  slug: string;
  cover_image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  is_active: boolean;
  membership?: 'owner' | 'staff';
};

export type DashboardTotals = {
  total_revenue: number;
  order_count: number;
  avg_ticket: number;
};

export type SeriesPoint = {
  label: string;
  revenue: number;
  orders: number;
  prev_revenue?: number;
  prev_orders?: number;
};

export type DashboardSummary = DashboardTotals & {
  active_orders: number;
  delivered_orders: number;
  by_status: Record<'pending' | 'paid' | 'delivered' | 'cancelled' | 'partially_delivered', number>;
  hourly: { hour: string; revenue: number }[];
  series: { kind: 'hourly' | 'daily'; points: SeriesPoint[] };
  range: { from: string; to: string } | null;
  comparison: (DashboardTotals & { range: { from: string; to: string } }) | null;
  filters: { payment: PaymentKey | null; product: string | null };
  payment_breakdown: { key: PaymentKey; count: number; revenue: number }[];
  top_products: { name: string; quantity: number; revenue: number }[];
  live: { orders_last_hour: number; revenue_last_hour: number; per_minute: number[] };
};

export type TicketTypeStats = {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  sold: number;
  capacity: number | null;
  checked_in: number;
  revenue: number;
};

export type ActivityItem = {
  type: 'sale' | 'ticket_checkin' | 'pickup';
  at: string | null;
  order_id: string;
  order_number: number | null;
  customer_name: string | null;
  amount: number | null;
  summary: string;
};

export type DashboardInsights = {
  generated_at: string;
  event: { phase: EventPhase; starts_at: string | null; ends_at: string | null };
  tickets: {
    sold: number;
    capacity: number | null;
    checked_in: number;
    revenue: number;
    types: TicketTypeStats[];
  };
  products: { units_sold: number; units_delivered: number; units_pending: number; revenue: number };
  revenue_split: { tickets: number; products: number };
  pickup_points: {
    id: string;
    name: string;
    is_active: boolean;
    orders: number;
    revenue: number;
    pending_orders: number;
  }[];
  customers: { unique: number; repeat: number; avg_items_per_order: number };
  cash_pending: { orders: number; amount: number };
  staff_scans: { user_id: string; name: string | null; units_redeemed: number }[];
  peak_hour: { start: string; label: string; orders: number; revenue: number } | null;
  recent_activity: ActivityItem[];
};

export type DashboardData = { summary: DashboardSummary; insights: DashboardInsights };
