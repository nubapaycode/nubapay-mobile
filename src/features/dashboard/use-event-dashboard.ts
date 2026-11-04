import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { apiFetch, eventPaths } from '@/lib/api';
import { useQuery } from '@/lib/query';
import { useAuth } from '@/providers/auth-provider';

import { publishDashboardSnapshot } from './dashboard-store';
import { type DashboardFilters, filtersQuery } from './filters';
import { applyLiveTick, mockDashboard, mockEvents } from './mock';
import type { DashboardData, DashboardInsights, DashboardSummary, EventSummary } from './types';

/** Mientras el home se diseña con datos simulados. En `false` usa el backend real. */
export const USE_MOCK = false;

const MOCK_LATENCY_MS = 650;
/** Actualización automática: rápida con el evento en curso, más espaciada el resto del tiempo. */
const LIVE_REFRESH_MS = 4000;
const IDLE_REFRESH_MS = 30_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchDashboard(
  eventId: string,
  filters: DashboardFilters,
  token: string | null,
): Promise<{ ok: true; data: DashboardData } | { ok: false; error: string }> {
  if (USE_MOCK) {
    await sleep(MOCK_LATENCY_MS);
    const data = mockDashboard(eventId, filters);
    return data ? { ok: true, data } : { ok: false, error: 'Evento no encontrado' };
  }
  const [summary, insights] = await Promise.all([
    apiFetch<DashboardSummary>(eventPaths.dashboard(eventId, filtersQuery(filters)), { token }),
    apiFetch<DashboardInsights>(eventPaths.dashboardInsights(eventId), { token }),
  ]);
  if (!summary.ok) return summary;
  if (!insights.ok) return insights;
  return { ok: true, data: { summary: summary.data, insights: insights.data } };
}

/** Eventos del usuario (dueño o staff), con cache: se refrescan con `invalidate('events')`. */
export function useEvents() {
  const { token } = useAuth();
  const q = useQuery<EventSummary[]>(token ? 'events' : null, async () => {
    if (USE_MOCK) {
      await sleep(250);
      return { ok: true, data: mockEvents() };
    }
    const res = await apiFetch<{ events: EventSummary[] }>(`${eventPaths.list()}?page_size=100`);
    return res.ok ? { ok: true, data: res.data.events } : res;
  });
  return { events: q.data, error: q.data ? null : q.error, refresh: q.refresh };
}

type State =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: DashboardData; updatedAt: number };

/**
 * `filters` debe ser estable entre renders (memoizado): cambia la referencia → se vuelve a pedir.
 * `publish: false` para pantallas con filtros propios (no pisan los datos que comparten home y detalles).
 */
export function useEventDashboard(
  eventId: string | null,
  filters: DashboardFilters,
  { publish = true }: { publish?: boolean } = {},
) {
  const { token } = useAuth();
  const [state, setState] = useState<State>({ status: 'idle' });
  const [refreshing, setRefreshing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const requestId = useRef(0);
  const tick = useRef(0);
  const loadedEventId = useRef<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (!eventId) return;
      const id = ++requestId.current;
      if (mode === 'initial') setState({ status: 'loading' });
      if (mode === 'refresh') setRefreshing(true);
      setFetching(true);
      const res = await fetchDashboard(eventId, filters, token);
      if (id !== requestId.current) return; // respuesta vieja (cambió el evento o los filtros)
      setFetching(false);
      if (mode === 'refresh') setRefreshing(false);
      if (res.ok) {
        loadedEventId.current = eventId;
        setState({ status: 'ready', data: res.data, updatedAt: Date.now() });
      } else if (mode === 'initial') setState({ status: 'error', error: res.error });
    },
    [eventId, filters, token],
  );

  // Mismo evento con otros filtros: se mantienen los datos visibles mientras llega la respuesta.
  useEffect(() => {
    load(loadedEventId.current === eventId ? 'silent' : 'initial');
  }, [load, eventId]);

  // Actualización automática siempre (sin tirar para refrescar). Se pausa con la app en segundo
  // plano y refresca apenas vuelve. En mock, el evento en curso recibe ventas e ingresos simulados.
  const phase = state.status === 'ready' ? state.data.insights.event.phase : null;
  useEffect(() => {
    if (!eventId || !phase) return;
    const live = phase === 'live';
    const poll = () => {
      if (USE_MOCK && live) {
        tick.current += 1;
        setState((s) =>
          s.status === 'ready'
            ? { status: 'ready', data: applyLiveTick(s.data, tick.current), updatedAt: Date.now() }
            : s,
        );
      } else {
        load('silent');
      }
    };
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(poll, live ? LIVE_REFRESH_MS : IDLE_REFRESH_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        poll();
        start();
      } else {
        stop();
      }
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [eventId, phase, load]);

  // Las pantallas de detalle leen estos mismos datos.
  useEffect(() => {
    if (publish && state.status === 'ready' && eventId) {
      publishDashboardSnapshot({
        eventId,
        filters,
        data: state.data,
        updatedAt: state.updatedAt,
      });
    }
  }, [state, eventId, filters, publish]);

  const refresh = useCallback(() => load('refresh'), [load]);

  return { state, refreshing, fetching, refresh };
}
