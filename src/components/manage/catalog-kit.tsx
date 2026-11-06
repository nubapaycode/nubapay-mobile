import { Image } from "expo-image";
import { type ReactNode, useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Icon, type IconName } from "@/components/dashboard/icon";
import { DisplayFont, Radius } from "@/constants/theme";
import { formatMoney } from "@/features/dashboard/format";
import { makeStyles, useTheme } from "@/theme";
import { MoodMascot } from "@/components/illustrations/mood-mascot";
import { TicketMascot } from "@/components/illustrations/ticket-mascot";

/**
 * Piezas compartidas del catálogo (lista, formulario y sus hojas): miniatura, buscador, lista
 * agrupada en una card con separadores, ahorro del combo, estado vacío y esqueleto de carga.
 */

/** Foto del producto o, si no tiene, su inicial: todas las filas quedan alineadas. */
export function ProductThumb({
  uri,
  name,
  size = 52,
  combo,
  dim,
}: {
  uri: string | null;
  name: string;
  size?: number;
  combo?: boolean;
  dim?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const box = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.27),
  };
  return (
    <View style={[styles.thumb, box, dim && { opacity: 0.45 }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : combo ? (
        <Icon name="combo" size={size * 0.38} color={colors.textSecondary} />
      ) : (
        <Text style={[styles.thumbInitial, { fontSize: size * 0.38 }]}>
          {name.trim().charAt(0).toUpperCase() || "·"}
        </Text>
      )}
    </View>
  );
}

/** Buscador con lupa y botón de borrar. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  ...rest
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
} & Omit<TextInputProps, "value" | "onChangeText" | "placeholder" | "style">) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.search}>
      <Icon name="search" size={16} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        style={styles.searchInput}
        accessibilityLabel={placeholder}
        {...rest}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={10}
          accessibilityLabel="Borrar búsqueda"
        >
          <Icon name="clearCircle" size={17} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** "BEBIDAS" / "bebidas" → "Bebidas": solo la primera letra en mayúscula. */
export const sentenceCase = (s: string) => {
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

/** Título de sección (primera letra en mayúscula) con contador o acción a la derecha. */
export function GroupHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.groupHead}>
      <Text style={styles.groupTitle} numberOfLines={1}>
        {sentenceCase(title)}
        {count != null ? (
          <Text style={styles.groupCount}>{`  ${count}`}</Text>
        ) : null}
      </Text>
      {action}
    </View>
  );
}

/** Acción chica de texto para la derecha de un `GroupHeader` (p. ej. "Ordenar"). */
export function HeaderAction({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.5 }}>
      <Text style={styles.headerAction}>{label}</Text>
    </Pressable>
  );
}

/** Cada ítem en su propia card (nada de tablas con separadores). */
export function Card({
  children,
  danger,
}: {
  children: ReactNode;
  danger?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  // La sombra va en un contenedor aparte: la card recorta (overflow hidden) el fondo al presionar.
  return (
    <View style={styles.cardShadow}>
      <View style={[styles.card, danger && { borderColor: colors.danger }]}>
        {children}
      </View>
    </View>
  );
}

/** Columna de cards con aire entre una y otra. */
export function CardList({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.cardList}>{children}</View>;
}

/**
 * Ahorro del combo frente a comprar los productos por separado. Verde si ahorra; aviso si el combo
 * sale más caro que por separado (casi siempre un error de precio).
 */
export function ComboSavings({
  separate,
  price,
}: {
  separate: number;
  price: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (separate <= 0) return null;
  const diff = separate - price;
  const pct = Math.round((diff / separate) * 100);
  const good = diff > 0;
  const bad = diff < 0 && price > 0;
  return (
    <View style={styles.savingsRow}>
      <Text style={styles.savingsText}>
        Por separado <Text style={styles.strike}>{formatMoney(separate)}</Text>
      </Text>
      {good ? (
        <View style={[styles.pill, { backgroundColor: colors.successMuted }]}>
          <Text style={[styles.pillText, { color: colors.success }]}>
            Ahorra {formatMoney(diff)} · {pct}%
          </Text>
        </View>
      ) : bad ? (
        <View style={[styles.pill, { backgroundColor: colors.warningMuted }]}>
          <Text style={[styles.pillText, { color: colors.warning }]}>
            Más caro que por separado
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Estado vacío: ícono, título, texto y una acción opcional. */
export function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: string;
  onAction?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      {/* Sin búsqueda es que todavía no hay nada: ahí saluda la mascota. */}
      {icon === "search" ? (
        <MoodMascot mood="search" size={120} onLight={colors.scheme === "light"} />
      ) : (
        <TicketMascot size={120} onLight={colors.scheme === "light"} />
      )}
      <View style={{ gap: 4, alignItems: "center" }}>
        <Text style={styles.emptyTitle}>{title}</Text>
        {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.emptyBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.emptyBtnText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Esqueleto con la forma de la lista (título de grupo + filas con miniatura). */
export function CatalogSkeleton() {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!reduceMotion)
      o.set(withRepeat(withTiming(0.45, { duration: 800 }), -1, true));
  }, [o, reduceMotion]);
  const pulse = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[{ gap: 24 }, pulse]}
      accessibilityLabel="Cargando catálogo"
    >
      {[3, 2].map((rows, g) => (
        <View key={g} style={{ gap: 10 }}>
          <View
            style={[styles.bone, { width: 90, height: 12, marginLeft: 4 }]}
          />
          <View style={styles.cardList}>
            {Array.from({ length: rows }).map((_, i) => (
              <View key={i} style={[styles.card, styles.skRow]}>
                <View
                  style={[
                    styles.bone,
                    { width: 52, height: 52, borderRadius: 14 },
                  ]}
                />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.bone, { width: "60%", height: 14 }]} />
                  <View style={[styles.bone, { width: "35%", height: 12 }]} />
                </View>
                <View
                  style={[
                    styles.bone,
                    { width: 50, height: 30, borderRadius: 15 },
                  ]}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const FADE = { duration: 300, easing: Easing.inOut(Easing.quad) };

/** "Guardar" del header en Android: texto que pasa de gris a negro cuando se puede guardar. */
export function SaveText({
  label,
  enabled,
  onPress,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const on = useSharedValue(enabled ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(enabled ? 1 : 0, FADE));
  }, [enabled, on]);
  const fg = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [colors.textMuted, colors.text]),
  }));
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      hitSlop={10}
      accessibilityRole="button"
      style={styles.saveText}
    >
      <Animated.Text style={[styles.saveLabel, fg]}>{label}</Animated.Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    thumb: {
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderCurve: "continuous",
      backgroundColor: c.raised,
    },
    thumbInitial: { color: c.textSecondary, fontFamily: DisplayFont.semibold },

    search: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 46,
      paddingHorizontal: 14,
      borderRadius: Radius.lg,
      borderCurve: "continuous",
      backgroundColor: c.raised,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 0 },

    groupHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingHorizontal: 4,
    },
    groupTitle: {
      flexShrink: 1,
      color: c.text,
      fontSize: 17,
      fontFamily: DisplayFont.semibold,
    },
    headerAction: { color: c.textSecondary, fontSize: 14, fontWeight: "600" },
    groupCount: {
      color: c.textMuted,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    cardShadow: {
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      boxShadow: c.cardShadowSubtle,
    },
    card: {
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
      overflow: "hidden",
    },
    cardList: { gap: 8 },
    saveText: { paddingHorizontal: 8, height: 32, justifyContent: "center" },
    saveLabel: { fontSize: 16, fontFamily: DisplayFont.semibold },

    savingsRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },
    savingsText: {
      color: c.textMuted,
      fontSize: 13,
      fontVariant: ["tabular-nums"],
    },
    strike: { textDecorationLine: "line-through" },
    pill: {
      paddingHorizontal: 8,
      height: 22,
      justifyContent: "center",
      borderRadius: Radius.pill,
    },
    pillText: {
      fontSize: 12,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },

    empty: {
      alignItems: "center",
      gap: 14,
      paddingVertical: 48,
      paddingHorizontal: 24,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.raised,
    },
    emptyTitle: {
      color: c.text,
      fontSize: 17,
      fontFamily: DisplayFont.semibold,
      textAlign: "center",
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    emptyBtn: {
      marginTop: 4,
      height: 44,
      paddingHorizontal: 20,
      borderRadius: Radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.ink,
    },
    emptyBtnText: {
      color: c.onInk,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
    },

    bone: { borderRadius: 6, backgroundColor: c.raised },
    skRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  }),
);
