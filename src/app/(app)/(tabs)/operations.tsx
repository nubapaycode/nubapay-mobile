import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { TabPage } from '@/components/navigation/tab-page';
import { OperationCard } from '@/components/operations/operation-card';
import { Radius } from '@/constants/theme';
import { NoAccess } from '@/components/ui/no-access';
import { useEventAccess } from '@/features/access/access';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { useEvents } from '@/features/dashboard/use-event-dashboard';
import {
  activeOperationFilters,
  CHANNEL_FILTER_LABEL,
  ordersQuery,
  PAYMENT_FILTER_LABEL,
  STATUS_FILTER_LABEL,
  useOperationFilters,
} from '@/features/operations/operations';
import { useNow } from '@/hooks/use-now';
import { listOrders, type Order } from '@/lib/api/organizer';
import { setQueryData, useQuery } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';

/**
 * Operaciones: pedidos del evento actual como tarjetas, con buscador (cliente, email o número
 * de pedido) y filtros por retiro, pago y medio. Búsqueda y filtros van al servidor.
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
  const styles = useStyles();
  const { colors } = useTheme();
  const eventId = useSelectedEventId();
  const { events } = useEvents();
  const filters = useOperationFilters();
  const now = useNow(15_000);
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

  const event = events?.find((e) => e.id === eventId);
  const active = activeOperationFilters(filters);
  const activeLabels = [
    filters.status !== 'all' ? STATUS_FILTER_LABEL[filters.status] : null,
    filters.payment !== 'all' ? `Pago ${PAYMENT_FILTER_LABEL[filters.payment].toLowerCase()}` : null,
    filters.channel !== 'all' ? CHANNEL_FILTER_LABEL[filters.channel] : null,
  ].filter(Boolean) as string[];
  const list = orders.data?.orders ?? [];

  return (
    <TabPage title="Operaciones" subtitle={event?.name}>
      <Animated.View entering={enter(1)} style={{ gap: 10 }}>
        <View style={styles.searchRow}>
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
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/operations-filters');
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Filtros${active ? `, ${active} activos` : ''}`}
            style={({ pressed }) => [styles.filterBtn, pressed && { backgroundColor: colors.border }]}>
            <Icon name="filter" size={17} color="#000000" />
            {active > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{active}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        {activeLabels.length ? (
          <Animated.Text entering={FadeIn.duration(260)} style={styles.activeFilters}>
            Filtrando: {activeLabels.join(' · ')}
          </Animated.Text>
        ) : null}
      </Animated.View>

      {!orders.data ? (
        <Text style={styles.empty}>{orders.error ?? 'Cargando operaciones…'}</Text>
      ) : list.length === 0 ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptyText}>
            {debounced.trim()
              ? `No encontramos pedidos para “${debounced.trim()}”.`
              : active
                ? 'No hay pedidos con esos filtros.'
                : 'Todavía no hay pedidos en este evento.'}
          </Text>
        </Animated.View>
      ) : (
        <View style={[styles.list, orders.refreshing && { opacity: 0.6 }]}>
          {list.map((o) => (
            <Animated.View
              key={o.id}
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition.duration(260)}>
              <OperationCard
                order={o}
                now={now}
                onPress={() => router.push({ pathname: '/operation/[key]', params: { key: o.id } })}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {orders.data && orders.data.total > list.length ? (
        <Pressable
          onPress={loadMore}
          disabled={loadingMore}
          accessibilityRole="button"
          style={({ pressed }) => [styles.more, pressed && { backgroundColor: colors.border }]}>
          {loadingMore ? (
            <ActivityIndicator color={colors.textMuted} />
          ) : (
            <Text style={styles.moreText}>
              Cargar más · {list.length} de {orders.data.total}
            </Text>
          )}
        </Pressable>
      ) : null}
    </TabPage>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    search: {
      flex: 1,
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
      width: 46,
      height: 46,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      borderWidth: 2,
      borderColor: '#ffffff',
    },
    badgeText: { color: c.onPrimary, fontSize: 10, fontWeight: '700' },
    activeFilters: { color: c.textSecondary, fontSize: 13, paddingHorizontal: 4 },
    list: { gap: 10 },
    empty: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
    emptyBox: {
      gap: 6,
      padding: 20,
      alignItems: 'center',
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '600' },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
    more: {
      height: 48,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    moreText: { color: '#000000', fontSize: 15, fontWeight: '600' },
  }),
);

/** Si entra un pedido nuevo mientras se pagina, uno puede repetirse entre páginas. */
function dedupe(list: Order[]): Order[] {
  const seen = new Set<string>();
  return list.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}
