import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { CountBadge } from '@/components/motion/count-badge';
import { enter, enterItem } from '@/components/dashboard/detail-kit';
import { CardListSkeleton } from '@/components/dashboard/skeleton';
import { TicketMascot } from '@/components/illustrations/ticket-mascot';
import { MoodMascot } from '@/components/illustrations/mood-mascot';
import { Icon } from '@/components/dashboard/icon';
import { TabPage } from '@/components/navigation/tab-page';
import { OperationCard } from '@/components/operations/operation-card';
import { DisplayFont, Radius } from '@/constants/theme';
import { NoAccess } from '@/components/ui/no-access';
import { CoachTip } from '@/components/ui/coach-tip';
import { useEventAccess } from '@/features/access/access';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { useEvents } from '@/features/dashboard/use-event-dashboard';
import { formatInt, formatMoney } from '@/features/dashboard/format';
import {
  activeOperationFilters,
  canConfirmCash,
  CHANNEL_FILTER_LABEL,
  ordersQuery,
  setOperationFilters,
  useOperationFilters,
} from '@/features/operations/operations';
import { useNow } from '@/hooks/use-now';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { listOrders, type Order } from '@/lib/api/organizer';
import { setQueryData, useQuery } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';
import { awaitingCash, hasPending } from '@/features/operations/scan';
import { useFirstTip } from '@/features/tips/tips';

/**
 * Operaciones (referencias: Mercury y Revolut Business): buscador, el total de resultados y los pedidos agrupados por día con lo cobrado en cada uno, cada
 * pedido en su card. Los filtros van en su hoja. Búsqueda y
 * filtros van al servidor.
 */
const PAGE_SIZE = 50;
type OrdersPage = { orders: Order[]; total: number };

export default function OperationsScreen() {
  const { can } = useEventAccess();
  if (!can('orders')) {
    return (
      <TabPage title="Operaciones">
        <NoAccess text="Tu rol en este evento no incluye ver los pedidos. Pedile acceso al organizador." />
      </TabPage>
    );
  }
  return <OperationsContent />;
}

function OperationsContent() {
  const { can } = useEventAccess();
  // Misma regla que el botón "Entregar" del detalle: queda algo por entregar, no espera efectivo
  // y el rol puede escanear.
  const deliverable = (o: Order) =>
    can('scanner') && !canConfirmCash(o) && hasPending(o) && !awaitingCash(o);
  const styles = useStyles();
  const { colors } = useTheme();
  const eventId = useSelectedEventId();
  const { events } = useEvents();
  const filters = useOperationFilters();
  // Para los títulos "Hoy" / "Ayer" (se recalculan al cambiar de día).
  const now = useNow(60_000);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // Espera a que se deje de escribir para no pedir en cada letra.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const params = ordersQuery(filters, debounced);
  const key = eventId ? `orders:${eventId}:${JSON.stringify(params)}` : null;
  // Páginas cargadas para esta búsqueda: al refrescar se vuelven a pedir todas (no se pierde lo cargado).
  const [pages, setPages] = useState<{ key: string | null; n: number }>({ key: null, n: 1 });
  const loaded = pages.key === key ? pages.n : 1;
  const [loadingMore, setLoadingMore] = useState(false);
  const orders = useQuery<OrdersPage>(key, async () => {
    const all = await Promise.all(
      Array.from({ length: loaded }, (_, i) => listOrders(eventId!, { ...params, page: i + 1, page_size: PAGE_SIZE })),
    );
    const bad = all.find((r) => !r.ok);
    if (bad && !bad.ok) return bad;
    const ok = all.flatMap((r) => (r.ok ? [r.data] : []));
    return {
      ok: true,
      data: {
        orders: dedupe(ok.flatMap((d) => d.orders)),
        total: ok[0]?.pagination?.total ?? 0,
      },
    };
  });

  const loadMore = async () => {
    if (!key || loadingMore) return;
    setLoadingMore(true);
    const res = await listOrders(eventId!, { ...params, page: loaded + 1, page_size: PAGE_SIZE });
    setLoadingMore(false);
    if (!res.ok) return;
    setPages({ key, n: loaded + 1 });
    setQueryData<OrdersPage>(key, (prev) => ({
      orders: dedupe([...(prev?.orders ?? []), ...res.data.orders]),
      total: res.data.pagination?.total ?? prev?.total ?? 0,
    }));
  };

  // Pedidos que aparecen después de la primera carga (en vivo o al refrescar) brillan un momento.
  // Al cambiar la búsqueda o los filtros se empieza de cero: no es que "llegaron".
  const seen = useRef<{ key: string | null; ids: Set<string> } | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const loadedOrders = orders.data?.orders;
  useEffect(() => {
    if (!loadedOrders) return;
    const ids = loadedOrders.map((o) => o.id);
    if (!seen.current || seen.current.key !== key) {
      seen.current = { key, ids: new Set(ids) };
      setFresh(new Set());
      return;
    }
    const known = seen.current.ids;
    const added = ids.filter((id) => !known.has(id));
    added.forEach((id) => known.add(id));
    if (added.length) setFresh(new Set(added));
  }, [loadedOrders, key]);

  const pull = usePullRefresh(orders.refresh);

  const event = events?.find((e) => e.id === eventId);
  const active = activeOperationFilters(filters);
  const list = orders.data?.orders ?? [];
  const groups = groupByDay(list, now);
  // Tip de una sola vez: deslizar para entregar (solo si hay algo para entregar en la lista).
  const { tip, dismiss: dismissTip } = useFirstTip([list.some(deliverable) && 'operations-swipe']);

  const filterButton = (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push('/operations-filters');
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Filtros${active ? `, ${active} activos` : ''}`}
      style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}>
      <Icon name="filter" size={17} color={colors.text} />
      {active > 0 ? (
        <CountBadge count={active} style={styles.badge} textStyle={styles.badgeText} />
      ) : null}
    </Pressable>
  );

  return (
    <TabPage
      title="Operaciones"
      subtitle={event?.name ?? 'Elegí un evento'}
      onSubtitlePress={() => router.push('/switch-event')}
      right={filterButton}
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}>
      <Animated.View entering={enter(1)} style={{ gap: 12 }}>
        <View style={styles.search}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nombre, email o pedido"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.input}
            accessibilityLabel="Buscar operaciones"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
              <Icon name="clearCircle" size={17} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {orders.data ? (
          <Animated.View entering={FadeIn.duration(260)} style={styles.resultRow}>
            <Text style={styles.resultText}>
              {formatInt(orders.data.total)} {orders.data.total === 1 ? 'pedido' : 'pedidos'}
            </Text>
            {filters.channel !== 'all' ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setOperationFilters({ ...filters, channel: 'all' });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Quitar filtro ${CHANNEL_FILTER_LABEL[filters.channel]}`}
                style={({ pressed }) => [styles.tag, pressed && styles.pressed]}>
                <Text style={styles.tagText}>{CHANNEL_FILTER_LABEL[filters.channel]}</Text>
                <Icon name="close" size={10} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </Animated.View>

      {!orders.data && !orders.error ? (
        <CardListSkeleton variant="operation" label="Cargando operaciones" />
      ) : !orders.data ? (
        <Text style={styles.empty}>{orders.error}</Text>
      ) : list.length === 0 && !debounced.trim() && !active ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.emptyBox}>
          <TicketMascot size={128} onLight={colors.scheme === 'light'} />
          <Text style={styles.emptyTitle}>Todavía no hay pedidos</Text>
          <Text style={styles.emptyText}>Cuando alguien compre una entrada o un producto, aparece acá al instante.</Text>
        </Animated.View>
      ) : list.length === 0 ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.emptyBox}>
          <MoodMascot mood="search" size={112} onLight={colors.scheme === 'light'} />
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptyText}>
            {debounced.trim()
              ? `No encontramos pedidos para “${debounced.trim()}”.`
              : 'No hay pedidos con esos filtros.'}
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.groups}>
          {tip === 'operations-swipe' ? (
            <CoachTip strong="Deslizá un pedido" text="hacia la derecha para entregarlo o registrar el ingreso más rápido." onClose={dismissTip} />
          ) : null}
          {groups.map((g) => (
            <Animated.View key={g.key} layout={LinearTransition.duration(260)} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>{g.label}</Text>
                {g.sum > 0 ? <Text style={styles.groupSum}>{formatMoney(g.sum)}</Text> : null}
              </View>
              {g.orders.map((o, i) => (
                <Animated.View
                  key={o.id}
                  entering={enterItem(i)}
                  exiting={FadeOut.duration(160)}
                  layout={LinearTransition.duration(260)}>
                  <OperationCard
                    order={o}
                    fresh={fresh.has(o.id)}
                    href={{ pathname: '/operation/[key]', params: { key: o.id } }}
                    onPress={() => router.push({ pathname: '/operation/[key]', params: { key: o.id } })}
                    onDeliver={
                      deliverable(o)
                        ? () => router.push({ pathname: '/deliver/[id]', params: { id: o.id } })
                        : undefined
                    }
                  />
                </Animated.View>
              ))}
            </Animated.View>
          ))}
        </View>
      )}

      {orders.data && orders.data.total > list.length ? (
        <Pressable
          onPress={loadMore}
          disabled={loadingMore}
          accessibilityRole="button"
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
          {loadingMore ? (
            <ActivityIndicator color={colors.textMuted} />
          ) : (
            <Text style={styles.moreText}>
              Cargar más · {formatInt(list.length)} de {formatInt(orders.data.total)}
            </Text>
          )}
        </Pressable>
      ) : null}
    </TabPage>
  );
}

/* ── Agrupado por día ── */

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY = 86_400_000;

function dayLabel(d: Date, now: number): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / DAY);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return diff < 7 ? `${WEEKDAYS[d.getDay()]} ${base}` : base;
}

/** Grupos por día con lo cobrado en cada uno (sin contar cancelados). */
function groupByDay(list: Order[], now: number) {
  const groups: { key: string; label: string; sum: number; orders: Order[] }[] = [];
  for (const o of list) {
    const d = new Date(o.createdAt);
    const key = d.toDateString();
    let g = groups[groups.length - 1];
    if (g?.key !== key) {
      g = { key, label: dayLabel(d, now), sum: 0, orders: [] };
      groups.push(g);
    }
    g.orders.push(o);
    if (o.status !== 'cancelled') g.sum += o.total;
  }
  return groups;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    pressed: { opacity: 0.7 },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 46,
      paddingHorizontal: 14,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      backgroundColor: c.raised,
    },
    input: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 0 },
    filterBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    badge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      borderWidth: 2,
      borderColor: c.background,
    },
    badgeText: { color: c.onPrimary, fontSize: 10, fontWeight: '700' },

    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
    resultText: { color: c.textSecondary, fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 24,
      paddingHorizontal: 10,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    tagText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },

    groups: { gap: 22 },
    group: { gap: 8 },
    groupHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 2,
    },
    groupTitle: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold },
    groupSum: { color: c.textSecondary, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },

    empty: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
    emptyBox: {
      gap: 6,
      paddingVertical: 28,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    emptyIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
      marginBottom: 6,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
    more: {
      height: 48,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    moreText: { color: c.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  }),
);

/** Si entra un pedido nuevo mientras se pagina, uno puede repetirse entre páginas. */
function dedupe(list: Order[]): Order[] {
  const seen = new Set<string>();
  return list.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}
