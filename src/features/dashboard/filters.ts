import { useSyncExternalStore } from 'react';

import type { EventPhase } from './types';

/** Período del dashboard: un atajo o un rango personalizado con fecha y hora. */
export type RangePreset = 'event' | 'today' | '7d' | '30d';
export type DashboardPeriod = { preset: RangePreset } | { from: Date; to: Date };
/** Qué recaudación mirar: todo, solo entradas o solo barra. */
export type DashboardScope = 'all' | 'tickets' | 'bar';
export type DashboardFilters = { period: DashboardPeriod; scope: DashboardScope };

export const PRESET_LABEL: Record<RangePreset, string> = {
  event: 'Todo el evento',
  today: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
};

export const SCOPE_LABEL: Record<DashboardScope, string> = {
  all: 'Todo',
  tickets: 'Entradas',
  bar: 'Barra',
};

/** Sin filtros elegidos: en curso → todo el evento (ritmo de las últimas horas); si no, 30 días. */
export function defaultFilters(phase: EventPhase | null): DashboardFilters {
  return { period: { preset: phase === 'live' ? 'event' : '30d' }, scope: 'all' };
}

export const isCustom = (p: DashboardPeriod): p is { from: Date; to: Date } => !('preset' in p);

const dayFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

/** "Últimos 30 días" · "12 nov 20:00 – 13 nov 04:00". */
export function periodLabel(p: DashboardPeriod): string {
  if (!isCustom(p)) return PRESET_LABEL[p.preset];
  const fmt = (d: Date) => `${dayFmt.format(d)} ${timeFmt.format(d)}`;
  return `${fmt(p.from)} – ${fmt(p.to)}`;
}

/** Texto para notas al pie de los detalles ("Ranking de los últimos 30 días."). */
export function periodNote(p: DashboardPeriod): string {
  if (isCustom(p)) return `del ${periodLabel(p)}`;
  return { event: 'todo el evento', today: 'hoy', '7d': 'los últimos 7 días', '30d': 'los últimos 30 días' }[
    p.preset
  ];
}

/** Clave estable para dependencias de hooks (las fechas no se comparan por referencia). */
export function filtersKey(f: DashboardFilters): string {
  const p = isCustom(f.period) ? `${f.period.from.getTime()}-${f.period.to.getTime()}` : f.period.preset;
  return `${p}|${f.scope}`;
}

/** Cuántos filtros difieren del default (para el contador del botón). */
export function activeFilterCount(f: DashboardFilters, base: DashboardFilters): number {
  const samePeriod =
    !isCustom(f.period) && !isCustom(base.period) && f.period.preset === base.period.preset;
  return (samePeriod ? 0 : 1) + (f.scope === base.scope ? 0 : 1);
}

const p2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/**
 * Query del endpoint de dashboard. El backend acepta `from`/`to` como fechas (YYYY-MM-DD,
 * inclusive, hora de Argentina): del rango personalizado se usan los días, no la hora.
 * TODO(backend): soportar hora en `from`/`to` y un filtro por tipo (`scope=tickets|bar`).
 */
export function filtersQuery(f: DashboardFilters, now = new Date()): string | undefined {
  const parts: string[] = [];
  const p = f.period;
  if (isCustom(p)) {
    parts.push(`from=${ymd(p.from)}`, `to=${ymd(p.to)}`);
  } else if (p.preset === 'today') {
    parts.push(`from=${ymd(now)}`, `to=${ymd(now)}`);
  } else if (p.preset !== 'event') {
    const days = p.preset === '7d' ? 7 : 30;
    parts.push(`from=${ymd(new Date(now.getTime() - (days - 1) * 86_400_000))}`, `to=${ymd(now)}`);
  }
  if (f.scope !== 'all') parts.push(`scope=${f.scope}`);
  return parts.length ? parts.join('&') : undefined;
}

/* ── Estado compartido (home ↔ hoja de filtros). `null` = sin elegir: se usa el default. ── */

let current: DashboardFilters | null = null;
const listeners = new Set<() => void>();

export function setDashboardFilters(next: DashboardFilters | null) {
  current = next;
  listeners.forEach((l) => l());
}

export function useDashboardFilters(): DashboardFilters | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
