import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { enter, StatsRow } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { AddButton } from '@/components/manage/manage-ui';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatInt, formatMoney } from '@/features/dashboard/format';
import {
  activeCatalogFilters,
  matchesCatalogFilters,
  type Product,
  setProductActive,
  useCatalogFilters,
  useProducts,
} from '@/features/manage/manage';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';

const NO_CATEGORY = 'Sin categoría';
const LAYOUT = LinearTransition.duration(260);

/**
 * Catálogo: métricas, buscador con filtros (categoría y estado) y los productos agrupados
 * por categoría. Cada producto en su tarjeta (foto, precio, vendidos y switch de venta);
 * al tocarla se abre su edición.
 */
export default function ProductsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { products: list, error, eventId } = useProducts();
  const [query, setQuery] = useState('');
  const filters = useCatalogFilters();
  const activeFilters = activeCatalogFilters(filters);
  useFocusStatusBar('dark');

  const products = useMemo(() => list ?? [], [list]);
  const onSale = products.filter((p) => p.isActive).length;
  const sold = products.reduce((a, p) => a + p.sold, 0);

  // Categorías con su cantidad (para las etiquetas del filtro).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.category ?? NO_CATEGORY, (m.get(p.category ?? NO_CATEGORY) ?? 0) + 1));
    return [...m.entries()];
  }, [products]);

  const q = query.trim().toLowerCase();
  const filtered = products.filter(
    (p) =>
      matchesCatalogFilters(p, filters) &&
      (!q || `${p.name} ${p.category ?? ''}`.toLowerCase().includes(q)),
  );
  const groups = counts
    .map(([name]) => ({ name, items: filtered.filter((p) => (p.category ?? NO_CATEGORY) === name) }))
    .filter((g) => g.items.length > 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag">
      {!list ? (
        <Text style={styles.muted}>{error ?? 'Cargando…'}</Text>
      ) : (
        <>
          <StatsRow
            index={0}
            stats={[
              { label: 'Productos', value: formatInt(products.length) },
              { label: 'A la venta', value: formatInt(onSale) },
              { label: 'Vendidos', value: formatInt(sold) },
            ]}
          />

          <Animated.View entering={enter(1)} style={styles.searchRow}>
            <View style={styles.search}>
              <Icon name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar producto"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                returnKeyType="search"
                style={styles.input}
                accessibilityLabel="Buscar producto"
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
                router.push('/manage/products-filters');
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Filtros${activeFilters ? `, ${activeFilters} activos` : ''}`}
              style={({ pressed }) => [styles.filterBtn, pressed && { backgroundColor: colors.border }]}>
              <Icon name="filter" size={17} color="#000000" />
              {activeFilters > 0 ? (
                <View style={styles.badgeCount}>
                  <Text style={styles.badgeCountText}>{activeFilters}</Text>
                </View>
              ) : null}
            </Pressable>
          </Animated.View>

          <Animated.View entering={enter(2)}>
            <AddButton
              label="Agregar producto"
              onPress={() => router.push({ pathname: '/manage/product/[id]', params: { id: 'new' } })}
            />
          </Animated.View>

          {groups.length === 0 ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
              <Text style={styles.emptyText}>
                {products.length === 0
                  ? 'Todavía no hay productos en el catálogo.'
                  : `No encontramos productos${q ? ` para “${query.trim()}”` : activeFilters ? ' con esos filtros' : ''}.`}
              </Text>
            </Animated.View>
          ) : (
            groups.map((g) => (
              <Animated.View
                key={g.name}
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(160)}
                layout={LAYOUT}
                style={styles.group}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupTitle}>{g.name}</Text>
                  <Text style={styles.groupCount}>{g.items.length}</Text>
                </View>
                {g.items.map((p) => (
                  <Animated.View
                    key={p.id}
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(160)}
                    layout={LAYOUT}>
                    <ProductCard product={p} eventId={eventId} />
                  </Animated.View>
                ))}
              </Animated.View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

function ProductCard({ product: p, eventId }: { product: Product; eventId: string | null }) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: '/manage/product/[id]', params: { id: p.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${formatMoney(p.price)}. Editar`}
      style={({ pressed }) => [styles.card, !p.isActive && styles.cardOff, pressed && styles.cardPressed]}>
      <View style={styles.top}>
        {p.imageUri ? (
          <Image source={{ uri: p.imageUri }} style={[styles.thumb, !p.isActive && { opacity: 0.5 }]} contentFit="cover" />
        ) : null}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.name, !p.isActive && styles.off]} numberOfLines={2}>
            {p.name}
          </Text>
          <Text style={[styles.price, !p.isActive && styles.off]}>{formatMoney(p.price)}</Text>
        </View>
        <Switch
          value={p.isActive}
          onValueChange={(v) => {
            Haptics.selectionAsync();
            if (eventId) setProductActive(eventId, p.id, v);
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel={`${p.name}: ${p.isActive ? 'a la venta' : 'pausado'}`}
        />
      </View>

      <View style={styles.bottom}>
        {!p.isActive ? <Badge label="Pausado" /> : null}
        {!p.imageUri ? <Text style={styles.meta}>Sin foto</Text> : null}
        <View style={{ flex: 1 }} />
        {p.sold > 0 ? <Text style={styles.meta}>{formatInt(p.sold)} vendidos</Text> : null}
      </View>
    </Pressable>
  );
}

function Badge({ label, tone }: { label: string; tone?: 'danger' | 'attention' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bg = tone === 'danger' ? colors.dangerMuted : tone === 'attention' ? colors.brandMuted : colors.raised;
  const fg = tone === 'danger' ? colors.danger : tone === 'attention' ? colors.brandText : colors.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#ffffff' },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
    muted: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 32 },

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
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    filterBtn: {
      width: 46,
      height: 46,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    badgeCount: {
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
    badgeCountText: { color: c.onPrimary, fontSize: 10, fontWeight: '700' },

    empty: {
      padding: 20,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

    group: { gap: 10 },
    groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
    groupTitle: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold },
    groupCount: { color: c.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },

    card: {
      gap: 12,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    cardOff: { backgroundColor: c.canvas },
    cardPressed: { borderColor: '#c9ced6' },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    thumb: { width: 52, height: 52, borderRadius: 14, backgroundColor: c.raised },
    name: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    price: {
      color: c.text,
      fontSize: 20,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.4,
      fontVariant: ['tabular-nums'],
    },
    off: { color: c.textMuted },
    bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    meta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    badge: { paddingHorizontal: 8, height: 22, justifyContent: 'center', borderRadius: 7 },
    badgeText: { fontSize: 11, fontWeight: '700' },
  }),
);
