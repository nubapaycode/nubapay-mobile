import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { Icon } from "@/components/dashboard/icon";
import { Card, CardList, GroupHeader } from "@/components/manage/catalog-kit";
import { Sheet, useSheet } from "@/components/ui/sheet";
import { DisplayFont, Radius, Spacing } from "@/constants/theme";
import {
  type CatalogFilters,
  DEFAULT_CATALOG_FILTERS,
  matchesCatalogFilters,
  setCatalogFilters,
  useCatalogFilters,
  useCategories,
  useProducts,
} from "@/features/manage/manage";
import { makeStyles } from "@/theme";

const STATUS: { value: CatalogFilters["status"]; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "A la venta" },
  { value: "paused", label: "Pausados" },
];

/**
 * Filtros del catálogo: estado (todos / a la venta / pausados) y categorías (varias), cada opción
 * en su card con cuántos productos tiene. El botón dice cuántos van a quedar antes de aplicar.
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
  const { dismiss } = useSheet();
  const { height } = useWindowDimensions();
  const current = useCatalogFilters();
  const categories = useCategories().data ?? [];
  const { products } = useProducts();
  const [selected, setSelected] = useState<string[]>(current.categories);
  const [status, setStatus] = useState(current.status);

  const all = useMemo(() => products ?? [], [products]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach(
      (p) => p.category && m.set(p.category, (m.get(p.category) ?? 0) + 1),
    );
    return m;
  }, [all]);
  const statusCount = {
    all: all.length,
    active: all.filter((p) => p.isActive).length,
    paused: all.filter((p) => !p.isActive).length,
  };

  const next: CatalogFilters = { categories: selected, status };
  const result = all.filter((p) => matchesCatalogFilters(p, next)).length;
  const dirty = selected.length > 0 || status !== "all";

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
              setStatus(DEFAULT_CATALOG_FILTERS.status);
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
          <GroupHeader title="Estado" />
          <CardList>
            {STATUS.map((o) => {
              const on = status === o.value;
              return (
                <Card key={o.value}>
                  <Pressable
                    onPress={() => {
                      if (on) return;
                      Haptics.selectionAsync();
                      setStatus(o.value);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${o.label}, ${statusCount[o.value]} productos`}
                    style={styles.row}
                  >
                    <Text style={styles.name}>{o.label}</Text>
                    <Text style={styles.count}>{statusCount[o.value]}</Text>
                    <View style={[styles.radio, on && styles.radioOn]}>
                      {on ? (
                        <Animated.View
                          entering={ZoomIn.duration(160)}
                          style={styles.radioDot}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                </Card>
              );
            })}
          </CardList>
        </View>

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
                            <Icon name="checkmark" size={12} color="#ffffff" />
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
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
    },
    reset: { color: c.textSecondary, fontSize: 14, fontWeight: "600" },
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
      fontFamily: DisplayFont.semibold,
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
    radioOn: { borderColor: "#000000", borderWidth: 2 },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#000000",
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
    checkOn: { backgroundColor: "#000000", borderColor: "#000000" },
    footer: { paddingHorizontal: Spacing.three, paddingTop: 12 },
    apply: {
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#000000",
    },
    applyText: {
      color: "#ffffff",
      fontSize: 16,
      fontFamily: DisplayFont.semibold,
    },
  }),
);
