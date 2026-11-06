import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import type { SFSymbol } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScalePressable } from "@/components/motion/scale-pressable";
import { CountBadge } from "@/components/motion/count-badge";
import { EventContext } from "@/components/events/event-context";
import { enter, enterItem } from "@/components/dashboard/detail-kit";
import { Icon, type IconName } from "@/components/dashboard/icon";
import {
  CatalogSkeleton,
  EmptyState,
  Card,
  CardList,
  GroupHeader,
  ProductThumb,
  SearchField,
} from "@/components/manage/catalog-kit";
import { DisplayFont, Radius, Spacing } from "@/constants/theme";
import { formatInt, formatMoney } from "@/features/dashboard/format";
import {
  activeCatalogFilters,
  DEFAULT_CATALOG_FILTERS,
  matchesCatalogFilters,
  type Product,
  setCatalogFilters,
  setProductActive,
  useCatalogFilters,
  useProducts,
} from "@/features/manage/manage";
import {
  formatWindowShort,
  promoEnded,
  promoLive,
} from "@/features/manage/promo";
import { useFocusStatusBar } from "@/hooks/use-focus-status-bar";
import { makeStyles, useTheme } from "@/theme";

const NO_CATEGORY = "Sin categoría";
/** Verde lima del botón "+" del header. */
const LIME = "#C6FF00";
const LAYOUT = LinearTransition.duration(260);

type CreateOption = {
  key: "product" | "category" | "combo";
  label: string;
  sfSymbol: SFSymbol;
  icon: IconName;
  onPress: () => void;
};

const newProduct = () =>
  router.push({ pathname: "/manage/product/[id]", params: { id: "new" } });

const CREATE_OPTIONS: CreateOption[] = [
  {
    key: "product",
    label: "Producto",
    sfSymbol: "shippingbox",
    icon: "store",
    onPress: newProduct,
  },
  {
    key: "combo",
    label: "Combo",
    sfSymbol: "square.stack.3d.up",
    icon: "combo",
    onPress: () =>
      router.push({
        pathname: "/manage/product/[id]",
        params: { id: "new", type: "combo" },
      }),
  },
  {
    key: "category",
    label: "Categoría",
    sfSymbol: "tag",
    icon: "tag",
    onPress: () => router.push("/manage/new-category"),
  },
];

const matchesQuery = (p: Product, q: string) =>
  !q || `${p.name} ${p.category ?? ""}`.toLowerCase().includes(q);

/**
 * Catálogo (patrón de Shopify Products + gestores de menú, con el lenguaje del resto de la app):
 * buscador con botón de filtros (que también lleva a categorías y a ordenar), un resumen (a la
 * venta, vendidos, en promo) y los productos agrupados por categoría, cada uno en su card con miniatura, precio,
 * tags (vendidos / pausado / promo) y switch de venta. El "+" del header crea producto, combo o
 * categoría.
 */
export default function ProductsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { products: list, error, eventId } = useProducts();
  const [query, setQuery] = useState("");
  const filters = useCatalogFilters();
  const activeFilters = activeCatalogFilters(filters);
  const [menuOpen, setMenuOpen] = useState(false);
  useFocusStatusBar();

  const products = useMemo(() => list ?? [], [list]);
  const q = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      products.filter(
        (p) => matchesCatalogFilters(p, filters) && matchesQuery(p, q),
      ),
    [products, filters, q],
  );

  // Grupos en el orden en que aparece cada categoría en el catálogo.
  const groups = useMemo(() => {
    const m = new Map<string, Product[]>();
    products.forEach((p) => m.set(p.category ?? NO_CATEGORY, []));
    filtered.forEach((p) => m.get(p.category ?? NO_CATEGORY)!.push(p));
    return [...m.entries()].filter(([, items]) => items.length > 0);
  }, [products, filtered]);

  const narrowed = !!q || activeFilters > 0;
  const onSale = products.filter((p) => p.isActive).length;
  const soldTotal = products.reduce((a, p) => a + p.sold, 0);
  const promos = products.filter(
    (p) => p.promo && p.promo.isActive && !promoEnded(p.promo),
  ).length;
  const clearAll = () => {
    Haptics.selectionAsync();
    setQuery("");
    setCatalogFilters(DEFAULT_CATALOG_FILTERS);
  };

  return (
    <>
      <Stack.Screen
        options={
          Platform.OS === "ios"
            ? {
                // Menú nativo (popover) de iOS al tocar el "+".
                unstable_headerRightItems: () => [
                  {
                    type: "menu",
                    label: "Crear",
                    icon: { type: "sfSymbol", name: "plus" },
                    // Cápsula rellena en verde lima (iOS 26: `prominent` pinta el fondo con el tint).
                    variant: "prominent",
                    tintColor: LIME,
                    menu: {
                      items: CREATE_OPTIONS.map((o) => ({
                        type: "action",
                        label: o.label,
                        icon: { type: "sfSymbol", name: o.sfSymbol },
                        onPress: o.onPress,
                      })),
                    },
                  },
                ],
              }
            : {
                headerRight: () => (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setMenuOpen(true);
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Crear"
                    style={({ pressed }) => [
                      styles.headerBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Icon name="plus" size={20} color={colors.onBrand} />
                  </Pressable>
                ),
              }
        }
      />
      {Platform.OS !== "ios" ? (
        <CreatePopover open={menuOpen} onClose={() => setMenuOpen(false)} />
      ) : null}
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={enter(0)}>
          <EventContext caption="Catálogo de" />
        </Animated.View>
        {/* Buscador + filtros (estado y categorías) */}
        <Animated.View entering={enter(0)} style={styles.searchRow}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar producto"
            returnKeyType="search"
          />
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/manage/products-filters");
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Filtros${activeFilters ? `, ${activeFilters} activos` : ""}`}
            style={({ pressed }) => [
              styles.filterBtn,
              activeFilters > 0 && styles.filterBtnOn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Icon
              name="filter"
              size={17}
              color={activeFilters > 0 ? colors.onInk : colors.ink}
            />
            {activeFilters > 0 ? (
              <CountBadge count={activeFilters} style={styles.badgeCount} textStyle={styles.badgeCountText} />
            ) : null}
          </Pressable>
        </Animated.View>

        {!list ? (
          error ? (
            <EmptyState
              icon="help"
              title="No pudimos cargar el catálogo"
              text={error}
            />
          ) : (
            <CatalogSkeleton />
          )
        ) : products.length === 0 ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <EmptyState
              icon="store"
              title="Tu catálogo está vacío"
              text="Cargá lo que vendés en el evento: bebidas, comida, merch. Después podés armar combos."
              action="Crear producto"
              onAction={() => {
                Haptics.selectionAsync();
                newProduct();
              }}
            />
          </Animated.View>
        ) : groups.length === 0 ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <EmptyState
              icon="search"
              title="Sin resultados"
              text={
                q
                  ? `No encontramos productos para “${query.trim()}”.`
                  : "Ningún producto coincide con estos filtros."
              }
              action={narrowed ? "Limpiar filtros" : undefined}
              onAction={clearAll}
            />
          </Animated.View>
        ) : (
          <>
          {!narrowed ? (
            <Animated.View entering={FadeIn.duration(300)}>
              {/* Resumen del catálogo, cada dato en su card. */}
              <View style={styles.stats}>
                <Stat label="A la venta" value={`${formatInt(onSale)}`} suffix={`/ ${formatInt(products.length)}`} />
                <Stat label="Vendidos" value={formatInt(soldTotal)} />
                <Stat label="En promo" value={formatInt(promos)} accent={promos > 0} />
              </View>
            </Animated.View>
          ) : null}
          {groups.map(([name, items]) => (
            <Animated.View
              key={name}
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(160)}
              layout={LAYOUT}
              style={styles.group}
            >
              <GroupHeader title={name} count={items.length} />
              <CardList>
                {items.map((p, i) => (
                  <Animated.View
                    key={p.id}
                    entering={enterItem(i)}
                    exiting={FadeOut.duration(160)}
                    layout={LAYOUT}
                  >
                    <Card>
                      <ProductRow product={p} eventId={eventId} />
                    </Card>
                  </Animated.View>
                ))}
              </CardList>
            </Animated.View>
          ))}
          </>
        )}
      </ScrollView>
    </>
  );
}

/** Android: popover anclado arriba a la derecha, debajo del "+" del header. */
function CreatePopover({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // El Modal no anima (animationType="none"): entrada y salida corren con Reanimated.
  // `mounted` lo mantiene visible hasta que termina la animación de salida.
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);
  // Ajuste de estado durante el render (no en el efecto): abrir monta al instante.
  if (open && !mounted) setMounted(true);
  if (!open && mounted && reduceMotion) setMounted(false);

  useEffect(() => {
    if (open) {
      progress.set(
        reduceMotion
          ? 1
          : withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
      );
    } else if (reduceMotion) {
      progress.set(0);
    } else {
      progress.set(
        withTiming(
          0,
          { duration: 130, easing: Easing.in(Easing.cubic) },
          (done) => {
            if (done) scheduleOnRN(setMounted, false);
          },
        ),
      );
    }
  }, [open, progress, reduceMotion]);

  const popoverStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Cerrar menú"
      />
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[styles.popover, { top: insets.top + 52 }, popoverStyle]}
      >
        {CREATE_OPTIONS.map((o, i) => (
          <Pressable
            key={o.key}
            onPress={() => {
              Haptics.selectionAsync();
              onClose();
              o.onPress();
            }}
            accessibilityRole="menuitem"
            style={({ pressed }) => [
              styles.popoverItem,
              i > 0 && styles.popoverDivider,
              pressed && { backgroundColor: colors.raised },
            ]}
          >
            <Text style={styles.popoverText}>{o.label}</Text>
            <Icon name={o.icon} size={17} color={colors.textSecondary} />
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.stat, accent && styles.statAccent]}>
      <Text style={[styles.statLabel, accent && styles.statLabelAccent]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {suffix ? <Text style={styles.statSuffix}> {suffix}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * Producto en su card: miniatura, nombre (y "Combo"), contenido del combo, precio (con el de lista
 * tachado si hay promo vigente), vendidos o "Pausado", la promo y el switch de venta.
 */
function ProductRow({
  product: p,
  eventId,
}: {
  product: Product;
  eventId: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const combo = p.type === "combo";
  // Promo: vigente (se ve el precio con descuento) o programada; si ya terminó no se muestra.
  const promo =
    p.promo && p.promo.isActive && !promoEnded(p.promo) ? p.promo : null;
  const live = !!promo && promoLive(promo);
  const contents =
    combo && p.lines.length > 0
      ? p.lines.map((l) => `${l.quantity}× ${l.name}`).join(" · ")
      : null;

  return (
    <ScalePressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: "/manage/product/[id]", params: { id: p.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${formatMoney(live ? promo!.promoPrice : p.price)}${
        p.isActive ? "" : ", pausado"
      }. Editar`}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.canvas },
      ]}
    >
      <ProductThumb
        uri={p.imageUri}
        name={p.name}
        combo={combo}
        size={58}
        dim={!p.isActive}
      />
      <View style={styles.rowBody}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, !p.isActive && styles.off]}
            numberOfLines={1}
          >
            {p.name}
          </Text>
          {combo ? (
            <View style={styles.comboTag}>
              <Icon name="combo" size={9} color={colors.brandText} />
              <Text style={styles.comboTagText}>Combo</Text>
            </View>
          ) : null}
        </View>
        {contents ? (
          <Text style={styles.meta} numberOfLines={1}>
            {contents}
          </Text>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={[styles.price, !p.isActive && styles.off]}>
            {formatMoney(live ? promo!.promoPrice : p.price)}
          </Text>
          {live ? (
            <Text style={styles.priceOld}>{formatMoney(p.price)}</Text>
          ) : null}
        </View>
        <View style={styles.tags}>
          {!p.isActive ? (
            <View style={styles.tag}>
              <Icon name="minus" size={10} color={colors.textSecondary} />
              <Text style={styles.tagText}>Pausado</Text>
            </View>
          ) : p.sold > 0 ? (
            <View style={styles.tag}>
              <Icon name="cart" size={10} color={colors.textSecondary} />
              <Text style={styles.tagText}>{formatInt(p.sold)} vendidos</Text>
            </View>
          ) : null}
          {promo ? (
            <View style={[styles.tag, live && styles.promoLive]}>
              <Icon
                name={live ? "bolt" : "clock"}
                size={10}
                color={live ? colors.onBrand : colors.textSecondary}
              />
              <Text
                style={[styles.tagText, live && { color: colors.onBrand }]}
                numberOfLines={1}
              >
                {promo.label} · {live ? "ahora" : formatWindowShort(promo)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Switch
        value={p.isActive}
        onValueChange={(v) => {
          Haptics.selectionAsync();
          if (eventId) setProductActive(eventId, p.id, v);
        }}
        trackColor={{ true: colors.primary, false: colors.border }}
        accessibilityLabel={`${p.name}: ${p.isActive ? "a la venta" : "pausado"}`}
      />
    </ScalePressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: {
      padding: Spacing.three,
      paddingBottom: Spacing.six,
      gap: Spacing.three,
    },
    headerBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: LIME,
    },
    popover: {
      transformOrigin: "top right",
      position: "absolute",
      right: 12,
      minWidth: 200,
      borderRadius: Radius.lg,
      borderCurve: "continuous",
      backgroundColor: c.surface,
      overflow: "hidden",
      elevation: 8,
      boxShadow: "0 8px 24px rgba(11, 15, 23, 0.18)",
    },
    popoverItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      height: 48,
      paddingHorizontal: 16,
    },
    popoverDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderSubtle,
    },
    popoverText: {
      color: c.text,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
    },

    searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    filterBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    filterBtnOn: { backgroundColor: c.ink, borderColor: c.ink },
    badgeCount: {
      position: "absolute",
      top: -3,
      right: -3,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: LIME,
      borderWidth: 2,
      borderColor: c.background,
    },
    badgeCountText: { color: c.onBrand, fontSize: 10, fontWeight: "800" },

    stats: { flexDirection: "row", gap: 8 },
    stat: {
      flex: 1,
      gap: 4,
      padding: 12,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    statAccent: { backgroundColor: c.brandMuted, borderColor: "transparent", boxShadow: "none" },
    statLabel: { color: c.textSecondary, fontSize: 11 },
    statLabelAccent: { color: c.brandText },
    statValue: {
      color: c.text,
      fontSize: 20,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.4,
      fontVariant: ["tabular-nums"],
    },
    statSuffix: { color: c.textMuted, fontSize: 13, fontFamily: DisplayFont.semibold, letterSpacing: 0 },

    group: { gap: 8, marginTop: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
    rowBody: { flex: 1, gap: 4 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    name: {
      flexShrink: 1,
      color: c.text,
      fontSize: 16,
      fontFamily: DisplayFont.semibold,
    },
    comboTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      height: 18,
      borderRadius: Radius.pill,
      backgroundColor: c.brandMuted,
    },
    comboTagText: {
      color: c.brandText,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
    priceOld: {
      color: c.textMuted,
      fontSize: 13,
      textDecorationLine: "line-through",
      fontVariant: ["tabular-nums"],
    },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
    tag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
      maxWidth: "100%",
    },
    tagText: {
      flexShrink: 1,
      color: c.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    promoLive: { backgroundColor: LIME },
    price: {
      color: c.text,
      fontSize: 16,
      fontFamily: DisplayFont.bold,
      fontVariant: ["tabular-nums"],
    },
    off: { color: c.textMuted },
    meta: { color: c.textMuted, fontSize: 13, fontVariant: ["tabular-nums"] },
  }),
);
