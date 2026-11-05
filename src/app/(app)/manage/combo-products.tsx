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
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { Icon } from "@/components/dashboard/icon";
import {
  Card,
  CardList,
  EmptyState,
  GroupHeader,
  ProductThumb,
  SearchField,
} from "@/components/manage/catalog-kit";
import { Sheet, useSheet } from "@/components/ui/sheet";
import { DisplayFont, Radius, Spacing } from "@/constants/theme";
import { formatMoney } from "@/features/dashboard/format";
import {
  comboPickerMode,
  comboPickerSelection,
  finishComboPicker,
} from "@/features/manage/combo-picker";
import { type Product, useProducts } from "@/features/manage/manage";
import { makeStyles, useTheme } from "@/theme";

const NO_CATEGORY = "Sin categoría";

/**
 * Elegir los productos de un combo (o de un bloque de la tienda), en una hoja: buscador y los productos simples del catálogo
 * agrupados por categoría (foto, nombre y precio). Se marcan/desmarcan varios; el pie muestra
 * cuántos van y "Listo" devuelve la selección al formulario (las cantidades se ajustan allá).
 */
export default function ComboProductsSheet() {
  return (
    <Sheet>
      <ComboProductsContent />
    </Sheet>
  );
}

function ComboProductsContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { dismiss } = useSheet();
  const { height } = useWindowDimensions();
  const { products } = useProducts();
  const [selected, setSelected] = useState<string[]>(comboPickerSelection);
  const [mode] = useState(comboPickerMode);
  const isBlock = mode === "block";
  const [query, setQuery] = useState("");

  const singles = useMemo(
    () => (products ?? []).filter((p) => isBlock || p.type === "single"),
    [products, isBlock],
  );
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const m = new Map<string, Product[]>();
    singles
      .filter(
        (p) => !q || `${p.name} ${p.category ?? ""}`.toLowerCase().includes(q),
      )
      .forEach((p) => {
        const k = p.category ?? NO_CATEGORY;
        m.set(k, [...(m.get(k) ?? []), p]);
      });
    return [...m.entries()];
  }, [singles, q]);

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  };

  const done = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dismiss(() => finishComboPicker(selected));
  };

  return (
    <View style={[styles.root, { height: height * 0.82 }]}>
      <View style={styles.head}>
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          <Text style={styles.title}>
            {isBlock ? "Productos del bloque" : "Productos del combo"}
          </Text>
          <Text style={styles.subtitle}>
            {isBlock
              ? "Marcá los que se muestran en el bloque, en el orden en que los elegís."
              : "Marcá lo que incluye. Las cantidades las ajustás después."}
          </Text>
        </View>
        <View style={{ flexDirection: "row" }}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar producto"
            returnKeyType="search"
          />
        </View>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {singles.length === 0 ? (
          <EmptyState
            icon="store"
            title="Sin productos"
            text={
              isBlock
                ? "Todavía no hay productos en el catálogo."
                : "Todavía no hay productos en el catálogo para armar el combo."
            }
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="search"
            title="Sin resultados"
            text={`No encontramos productos para “${query.trim()}”.`}
          />
        ) : (
          groups.map(([name, items]) => (
            <Animated.View
              key={name}
              entering={FadeIn.duration(200)}
              style={styles.group}
            >
              <GroupHeader title={name} count={items.length} />
              <CardList>
                {items.map((p) => {
                  const on = selected.includes(p.id);
                  return (
                    <Card key={p.id}>
                      <Pressable
                        onPress={() => toggle(p.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${p.name}, ${formatMoney(p.price)}`}
                        style={({ pressed }) => [
                          styles.row,
                          on && styles.rowOn,
                          pressed && { backgroundColor: colors.canvas },
                        ]}
                      >
                        <ProductThumb
                          uri={p.imageUri}
                          name={p.name}
                          size={44}
                        />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.name} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={styles.price}>
                            {formatMoney(p.price)}
                          </Text>
                        </View>
                        <View style={[styles.check, on && styles.checkOn]}>
                          {on ? (
                            <Animated.View entering={ZoomIn.duration(160)}>
                              <Icon
                                name="checkmark"
                                size={13}
                                color="#ffffff"
                              />
                            </Animated.View>
                          ) : null}
                        </View>
                      </Pressable>
                    </Card>
                  );
                })}
              </CardList>
            </Animated.View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerCount}>
            {selected.length === 0
              ? "Ninguno elegido"
              : selected.length === 1
                ? "1 elegido"
                : `${selected.length} elegidos`}
          </Text>
          {selected.length > 0 ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setSelected([]);
              }}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.footerClear}>Quitar todos</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={done}
          accessibilityRole="button"
          style={({ pressed }) => [styles.submit, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.submitText}>Listo</Text>
        </Pressable>
      </View>
    </View>
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
    },
    subtitle: { color: c.textMuted, fontSize: 13 },

    list: { flex: 1 },
    listContent: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      gap: Spacing.four,
    },
    group: { gap: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
    rowOn: { backgroundColor: c.canvas },
    name: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    price: { color: c.textMuted, fontSize: 13, fontVariant: ["tabular-nums"] },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkOn: { backgroundColor: "#000000", borderColor: "#000000" },

    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingHorizontal: Spacing.three,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    footerCount: {
      color: c.text,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
      fontVariant: ["tabular-nums"],
    },
    footerClear: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: "600",
      marginTop: 2,
    },
    submit: {
      height: 50,
      paddingHorizontal: 32,
      borderRadius: Radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#000000",
    },
    submitText: {
      color: "#ffffff",
      fontSize: 16,
      fontFamily: DisplayFont.semibold,
    },
  }),
);
