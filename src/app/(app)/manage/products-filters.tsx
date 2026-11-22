import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { Icon, type IconName } from "@/components/dashboard/icon";
import { Card, CardList, GroupHeader } from "@/components/manage/catalog-kit";
import { Sheet, useSheet } from "@/components/ui/sheet";
import { Font, Radius, Spacing } from "@/constants/theme";
import {
  type CatalogFilters,
  DEFAULT_CATALOG_FILTERS,
  matchesCatalogFilters,
  setCatalogFilters,
  useCatalogFilters,
  useCategories,
  useProducts,
} from "@/features/manage/manage";
import { makeStyles, useTheme } from "@/theme";
import { Text } from "@/components/ui/text";

/**
 * Filtros del catálogo: categorías (varias), cada una en su card con cuántos productos tiene; al
 * final, atajos para gestionar categorías y ordenar. El estado (a la venta, pausados, en promo) se
 * elige con las pestañas de la lista y se conserva al aplicar.
 * El botón dice cuántos van a quedar antes de aplicar.
 */
export default function CatalogFiltersSheet() {
  return (
    <Sheet>
      <FiltersContent />
    </Sheet>
  );
}

function FiltersContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { dismiss } = useSheet();
  const { height } = useWindowDimensions();
  const current = useCatalogFilters();
  const categories = useCategories().data ?? [];
  const { products } = useProducts();
  const [selected, setSelected] = useState<string[]>(current.categories);

  const all = useMemo(() => products ?? [], [products]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach(
      (p) => p.category && m.set(p.category, (m.get(p.category) ?? 0) + 1),
    );
    return m;
  }, [all]);

  const next: CatalogFilters = { categories: selected, status: current.status };
  const result = all.filter((p) => matchesCatalogFilters(p, next)).length;
  const dirty = selected.length > 0;

  const toggle = (name: string) => {
    Haptics.selectionAsync();
    setSelected((l) =>
      l.includes(name) ? l.filter((x) => x !== name) : [...l, name],
    );
  };

  return (
    <View style={{ maxHeight: height * 0.8, flexShrink: 1 }}>
      <View style={styles.head}>
        <Text style={styles.title}>Filtros</Text>
        {dirty ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setSelected(DEFAULT_CATALOG_FILTERS.categories);
            }}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={styles.reset}>Restablecer</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={styles.content}
      >
        <View style={styles.section}>
          <GroupHeader title="Categorías" />
          {categories.length === 0 ? (
            <Text style={styles.hint}>
              Todavía no hay categorías en el catálogo.
            </Text>
          ) : (
            <CardList>
              {categories.map((c) => {
                const on = selected.includes(c.name);
                const n = counts.get(c.name) ?? 0;
                return (
                  <Card key={c.id}>
                    <Pressable
                      onPress={() => toggle(c.name)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${c.name}, ${n} productos`}
                      style={styles.row}
                    >
                      <Text style={styles.name} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <Text style={styles.count}>{n}</Text>
                      <View style={[styles.check, on && styles.checkOn]}>
                        {on ? (
                          <Animated.View entering={ZoomIn.duration(160)}>
                            <Icon name="checkmark" size={12} color={colors.onInk} />
                          </Animated.View>
                        ) : null}
                      </View>
                    </Pressable>
                  </Card>
                );
              })}
            </CardList>
          )}
        </View>

        {/* Atajos de gestión: cierran la hoja y abren su pantalla. */}
        <View style={styles.section}>
          <GroupHeader title="Gestionar" />
          <CardList>
            <ManageRow
              icon="tag"
              title="Categorías"
              subtitle="Crear, renombrar y eliminar"
              onPress={() => dismiss(() => router.push("/manage/categories"))}
            />
            {all.length > 1 ? (
              <ManageRow
                icon="blocks"
                title="Ordenar productos"
                subtitle="El orden en que se ven en la tienda"
                onPress={() =>
                  dismiss(() =>
                    router.push({ pathname: "/manage/reorder", params: { kind: "products" } }),
                  )
                }
              />
            ) : null}
          </CardList>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            dismiss(() => setCatalogFilters(next));
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.apply, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.applyText}>
            {products
              ? result === 1
                ? "Ver 1 producto"
                : `Ver ${result} productos`
              : "Aplicar"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ManageRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Card>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPress();
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.manageRow, pressed && { backgroundColor: colors.canvas }]}
      >
        <View style={styles.manageIcon}>
          <Icon name={icon} size={15} color={colors.text} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{title}</Text>
          <Text style={styles.count}>{subtitle}</Text>
        </View>
        <Icon name="chevronRight" size={12} color={colors.textMuted} />
      </Pressable>
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    head: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.three + 4,
      paddingTop: Spacing.two,
      paddingBottom: 12,
    },
    title: {
      color: c.text,
      fontSize: 22,
      fontFamily: Font.medium,
      letterSpacing: -0.5,
    },
    reset: { color: c.textSecondary, fontSize: 14, fontFamily: Font.medium },
    content: {
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.two,
      gap: Spacing.four,
    },
    section: { gap: 8 },
    hint: {
      color: c.textMuted,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 16,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      height: 52,
      paddingHorizontal: 14,
    },
    name: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      fontFamily: Font.medium,
    },
    count: { color: c.textMuted, fontSize: 13, fontVariant: ["tabular-nums"] },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOn: { borderColor: c.ink, borderWidth: 2 },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.ink,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkOn: { backgroundColor: c.ink, borderColor: c.ink },
    manageRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    manageIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.raised,
    },
    footer: { paddingHorizontal: Spacing.three, paddingTop: 12 },
    apply: {
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.ink,
    },
    applyText: {
      color: c.onInk,
      fontSize: 16,
      fontFamily: Font.medium,
    },
  }),
);
