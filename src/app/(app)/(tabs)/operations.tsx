import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { TabPage } from '@/components/navigation/tab-page';
import { OperationCard } from '@/components/operations/operation-card';
import { Radius } from '@/constants/theme';
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
import { useQuery } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';

/**
 * Operaciones: pedidos del evento actual como tarjetas, con buscador (cliente, email o número
 * de pedido) y filtros por retiro, pago y medio. Búsqueda y filtros van al servidor.
 */
export default function OperationsScreen() {
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
  const orders = useQuery<{ orders: Order[]; total: number }>(key, async () => {
    const res = await listOrders(eventId!, params);
    return res.ok
      ? { ok: true, data: { orders: res.data.orders, total: res.data.pagination?.total ?? res.data.orders.length } }
      : res;
  });

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
        <Text style={styles.note}>
          Mostrando los últimos {list.length} de {orders.data.total} pedidos. Buscá o filtrá para encontrar otros.
        </Text>
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
    note: { color: c.textMuted, fontSize: 12, textAlign: 'center' },
  }),
);
