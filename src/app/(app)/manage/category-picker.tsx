import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { Icon } from "@/components/dashboard/icon";
import { Card, CardList, SearchField } from "@/components/manage/catalog-kit";
import { Sheet, useSheet } from "@/components/ui/sheet";
import { DisplayFont, Radius, Spacing } from "@/constants/theme";
import {
  categoryPickerCurrent,
  finishCategoryPicker,
} from "@/features/manage/category-picker";
import {
  addCategory,
  useCategories,
  useProducts,
} from "@/features/manage/manage";
import { makeStyles, useTheme } from "@/theme";

/**
 * Elegir la categoría de un producto, en una hoja (patrón "Search or add" de Shopify): buscador,
 * "Sin categoría" y las categorías del evento en una lista agrupada, cada una con su inicial y
 * cuántos productos tiene. Tocar una la elige y cierra. Si lo buscado no existe, ofrece crearla ahí
 * mismo (y queda elegida).
 */
export default function CategoryPickerSheet() {
  return (
    <Sheet>
      <CategoryPickerContent />
    </Sheet>
  );
}

function CategoryPickerContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { dismiss } = useSheet();
  const { height } = useWindowDimensions();
  const { data: categories, eventId } = useCategories();
  const { products } = useProducts();
  const [current] = useState(categoryPickerCurrent);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    (products ?? []).forEach(
      (p) => p.category && m.set(p.category, (m.get(p.category) ?? 0) + 1),
    );
    return m;
  }, [products]);

  const q = query.trim();
  const ql = q.toLowerCase();
  const list = useMemo(
    () =>
      [...(categories ?? [])]
        .sort(
          (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
        )
        .filter((c) => !ql || c.name.toLowerCase().includes(ql)),
    [categories, ql],
  );
  const exact = (categories ?? []).find((c) => c.name.toLowerCase() === ql);

  const pick = (name: string | null) => {
    Haptics.selectionAsync();
    dismiss(() => finishCategoryPicker(name));
  };

  const create = async () => {
    if (!q || !eventId || creating) return;
    setCreating(true);
    const res = await addCategory(eventId, q);
    setCreating(false);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("No se pudo crear la categoría", res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dismiss(() => finishCategoryPicker(q));
  };

  const rows: {
    key: string;
    label: string;
    count?: number;
    muted?: boolean;
    value: string | null;
  }[] = [
    ...(!q
      ? [{ key: "__none", label: "Sin categoría", muted: true, value: null }]
      : []),
    ...list.map((c) => ({
      key: c.id,
      label: c.name,
      count: counts.get(c.name) ?? 0,
      value: c.name,
    })),
  ];

  return (
    <View style={[styles.root, { height: height * 0.7 }]}>
      <View style={styles.head}>
        <Text style={styles.title}>Categoría</Text>
        <View style={{ flexDirection: "row" }}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar o crear categoría"
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={() => (exact ? pick(exact.name) : create())}
          />
        </View>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {!categories ? (
          <ActivityIndicator
            color={colors.textMuted}
            style={{ paddingVertical: 24 }}
          />
        ) : (
          <>
            {q && !exact ? (
              <Animated.View entering={FadeIn.duration(180)}>
                <Pressable
                  onPress={create}
                  disabled={creating}
                  accessibilityRole="button"
                  accessibilityLabel={`Crear categoría ${q}`}
                  style={({ pressed }) => [
                    styles.create,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={styles.createIcon}>
                    {creating ? (
                      <ActivityIndicator size="small" color={colors.onBrand} />
                    ) : (
                      <Icon name="plus" size={15} color={colors.onBrand} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={styles.createTitle} numberOfLines={1}>
                      Crear “{q}”
                    </Text>
                    <Text style={styles.createHint}>
                      Nueva categoría, queda elegida
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>
            ) : null}

            {rows.length > 0 ? (
              <CardList>
                {rows.map((r) => (
                  <Card key={r.key}>
                    <Row
                      label={r.label}
                      count={r.count}
                      muted={r.muted}
                      on={current === r.value}
                      onPress={() => pick(r.value)}
                    />
                  </Card>
                ))}
              </CardList>
            ) : null}

            {categories.length === 0 && !q ? (
              <Text style={styles.hint}>
                Todavía no hay categorías. Escribí un nombre arriba para crear
                la primera.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  count,
  on,
  muted,
  onPress,
}: {
  label: string;
  count?: number;
  on: boolean;
  muted?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={
        count != null ? `${label}, ${count} productos` : label
      }
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.canvas },
      ]}
    >
      <View style={[styles.initial, muted && styles.initialMuted]}>
        {muted ? (
          <Icon name="minus" size={13} color={colors.textMuted} />
        ) : (
          <Text style={styles.initialText}>
            {label.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={[styles.name, muted && { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {count != null ? (
          <Text style={styles.count}>
            {count === 1 ? "1 producto" : `${count} productos`}
          </Text>
        ) : null}
      </View>
      <View style={[styles.radio, on && styles.radioOn]}>
        {on ? (
          <Animated.View
            entering={ZoomIn.duration(160)}
            style={styles.radioDot}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    // Alto fijo (la hoja se achica sola si sube el teclado).
    root: { flexShrink: 1 },
    head: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.two,
      gap: 12,
    },
    title: {
      color: c.text,
      fontSize: 22,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
      paddingHorizontal: 4,
    },

    list: { flex: 1 },
    listContent: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.four,
      gap: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      minHeight: 58,
      paddingVertical: 8,
    },
    initial: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.raised,
    },
    initialMuted: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: c.border,
    },
    initialText: {
      color: c.ink,
      fontSize: 14,
      fontFamily: DisplayFont.semibold,
    },
    name: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    count: { color: c.textMuted, fontSize: 12, fontVariant: ["tabular-nums"] },
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

    create: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      backgroundColor: c.brandMuted,
    },
    createIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#C6FF00",
    },
    createTitle: {
      color: c.text,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
    },
    createHint: { color: c.textSecondary, fontSize: 12 },
    hint: {
      color: c.textMuted,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      paddingVertical: 16,
    },
  }),
);
