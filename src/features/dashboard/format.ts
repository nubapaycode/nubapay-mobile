import type { EventPhase, PaymentKey } from './types';

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export const formatMoney = (n: number) => money.format(Math.round(n));
export const formatInt = (n: number) => integer.format(Math.round(n));
export const formatDecimal = (n: number) => oneDecimal.format(n);

/** $1,2M · $340K · $900 — para ejes y etiquetas compactas. */
export function formatMoneyCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${oneDecimal.format(n / 1_000_000)}M`;
  if (abs >= 1_000) return `$${integer.format(n / 1_000)}K`;
  return `$${integer.format(n)}`;
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(ratio * 100)}%`;
}

/** Variación relativa; null si no hay base de comparación. */
export function deltaRatio(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return (current - previous) / previous;
}

export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return 'ahora';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `starts_at` del backend es hora local (Argentina) sin zona: se lee tal cual. */
export function formatEventDate(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  const [date, time = '00:00'] = iso.split('T');
  const [, mm, dd] = date.split('-').map(Number);
  const hhmm = time.slice(0, 5);
  return `${dd} ${MONTHS[mm - 1]}${hhmm !== '00:00' ? ` · ${hhmm}` : ''}`;
}

export const PAYMENT_LABEL: Record<PaymentKey, string> = {
  mp: 'Mercado Pago',
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

export const PHASE_LABEL: Record<EventPhase, string> = {
  live: 'En vivo',
  upcoming: 'Próximo',
  ended: 'Finalizado',
  unscheduled: 'Sin fecha',
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /[A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(w[0] ?? ''))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Misma regla que el backend (`_event_phase`): sin `ends_at`, en curso hasta 12 h después del inicio. */
export function eventPhase(
  e: { starts_at: string | null; ends_at: string | null },
  now = new Date(),
): EventPhase {
  if (!e.starts_at) return 'unscheduled';
  const starts = new Date(e.starts_at);
  const ends = e.ends_at ? new Date(e.ends_at) : new Date(starts.getTime() + 12 * 3_600_000);
  if (now < starts) return 'upcoming';
  if (now <= ends) return 'live';
  return 'ended';
}

export function daysUntil(iso: string | null, now = new Date()): number {
  if (!iso) return 0;
  const d = new Date(iso);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}
