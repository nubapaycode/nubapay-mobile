import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { type ReactNode, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { enter } from "@/components/dashboard/detail-kit";
import { KeyboardScroll } from "@/components/fx/keyboard";
import { Icon } from "@/components/dashboard/icon";
import {
  Card,
  CardList,
  GroupHeader,
  SaveText,
} from "@/components/manage/catalog-kit";
import { DisplayFont, Radius, Spacing } from "@/constants/theme";
import { formatInt, formatMoney } from "@/features/dashboard/format";
import {
  removeTicket,
  saveTicket,
  type TicketType,
  useTickets,
} from "@/features/manage/manage";
import { useFocusStatusBar } from "@/hooks/use-focus-status-bar";
import { makeStyles, useTheme } from "@/theme";
import { toast } from "@/components/ui/toast";

const LAYOUT = LinearTransition.duration(240);
const STOCK_PRESETS = [100, 250, 500, 1000];

/** "12.500" / "12500" → 12500. */
const parseAmount = (s: string) => {
  const n = Number(
    s
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.]/g, ""),
  );
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Tipo de entrada: alta (`id` = "new") y edición (patrón "New Ticket Type" de Luma, cada campo en
 * su card): nombre, precio (con atajo "Gratis"), cupo limitado o sin tope (con atajos de cantidad;
 * no puede quedar por debajo de lo ya vendido) y, al editar, si está a la venta.
 */
export default function TicketScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tickets, eventId } = useTickets();
  useFocusStatusBar();

  const isNew = id === "new";
  const ticket = isNew ? undefined : tickets?.find((t) => t.id === id);

  if (!isNew && !ticket) {
    return (
      <View style={styles.missing}>
        {tickets ? (
          <Text style={styles.missingText}>No encontramos esta entrada.</Text>
        ) : (
          <ActivityIndicator color={colors.textMuted} />
        )}
      </View>
    );
  }
  return (
    <TicketForm key={ticket?.id ?? "new"} ticket={ticket} eventId={eventId} />
  );
}

function TicketForm({
  ticket,
  eventId,
}: {
  ticket?: TicketType;
  eventId: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isNew = !ticket;
  const sold = ticket?.sold ?? 0;

  const initial = useMemo(
    () => ({
      name: ticket?.name ?? "",
      price: ticket ? String(ticket.price) : "",
      limited: ticket ? ticket.stock != null : true,
      stock: ticket?.stock != null ? String(ticket.stock) : "",
      active: ticket?.isActive ?? true,
    }),
    [ticket],
  );

  const [name, setName] = useState(initial.name);
  const [price, setPrice] = useState(initial.price);
  const [limited, setLimited] = useState(initial.limited);
  const [stock, setStock] = useState(initial.stock);
  const [active, setActive] = useState(initial.active);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const amount = parseAmount(price);
  const qty = Number(stock);
  const errors = {
    name: name.trim() ? null : "Poné un nombre",
    price: price.trim() && amount >= 0 ? null : "Poné un precio",
    stock: !limited
      ? null
      : !(Number.isInteger(qty) && qty > 0)
        ? "Poné una cantidad"
        : qty < sold
          ? `Ya vendiste ${formatInt(sold)}`
          : null,
  };
  const valid = !errors.name && !errors.price && !errors.stock;
  const dirty =
    name !== initial.name ||
    price !== initial.price ||
    limited !== initial.limited ||
    (limited && stock !== initial.stock) ||
    active !== initial.active;
  const canSave = valid && (isNew || dirty) && !saving;

  const save = async () => {
    setTouched(true);
    if (!valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!canSave || !eventId) return;
    setSaving(true);
    const res = await saveTicket(
      eventId,
      { name: name.trim(), price: amount, stock: limited ? qty : null },
      ticket,
      isNew ? undefined : active,
    );
    setSaving(false);
    if (!res.ok) {
      toast.error("No se pudo guardar", res.error);
      return;
    }
    toast.success(isNew ? "Entrada creada" : "Cambios guardados", name.trim(), { celebrate: isNew });
    router.back();
  };

  const remove = () =>
    Alert.alert(
      "Eliminar entrada",
      sold > 0
        ? `“${ticket?.name}” deja de venderse. Las ${formatInt(sold)} ya vendidas siguen valiendo.`
        : `“${ticket?.name}” deja de estar a la venta.`,
      [
        { text: "Volver", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            if (!ticket || !eventId) return;
            const res = await removeTicket(eventId, ticket.id);
            if (!res.ok) {
              toast.error("No se pudo eliminar", res.error);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          },
        },
      ],
    );

  const free = price.trim() !== "" && amount === 0;
  const left =
    limited && Number.isInteger(qty) && qty > 0
      ? Math.max(0, qty - sold)
      : null;
  const projected =
    limited && Number.isFinite(amount) && qty > 0 ? amount * qty : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? "Nueva entrada" : "Editar entrada",
          ...(Platform.OS === "ios"
            ? {
                unstable_headerRightItems: () => [
                  {
                    type: "button",
                    label: isNew ? "Crear" : "Guardar",
                    onPress: save,
                    disabled: !canSave,
                    variant: canSave ? "prominent" : "plain",
                    tintColor: canSave ? colors.primary : colors.text,
                    labelStyle: {
                      fontFamily: DisplayFont.semibold,
                      fontSize: 16,
                    },
                  },
                ],
              }
            : {
                headerRight: () => (
                  <SaveText
                    label={isNew ? "Crear" : "Guardar"}
                    enabled={canSave}
                    onPress={save}
                  />
                ),
              }),
        }}
      />
      <View style={styles.screen}>
        <KeyboardScroll
          style={styles.screen}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Métricas (solo al editar) */}
          {ticket ? (
            <Animated.View entering={enter(0)} style={styles.stats}>
              <Stat label="Vendidas" value={formatInt(ticket.sold)} />
              <View style={styles.statDivider} />
              <Stat label="Recaudado" value={formatMoney(ticket.revenue)} />
              <View style={styles.statDivider} />
              <Stat
                label="Quedan"
                value={
                  ticket.stock != null
                    ? formatInt(Math.max(0, ticket.stock - ticket.sold))
                    : "∞"
                }
              />
            </Animated.View>
          ) : null}

          {/* Nombre */}
          <Animated.View
            entering={enter(1)}
            layout={LAYOUT}
            style={styles.section}
          >
            <GroupHeader title="Entrada" />
            <Card danger={touched && !!errors.name}>
              <Field label="Nombre" error={touched ? errors.name : null}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej: General, VIP, Anticipada"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="sentences"
                  autoFocus={isNew}
                  style={styles.input}
                  accessibilityLabel="Nombre"
                />
              </Field>
            </Card>
          </Animated.View>

          {/* Precio */}
          <Animated.View
            entering={enter(2)}
            layout={LAYOUT}
            style={styles.section}
          >
            <GroupHeader title="Precio" />
            <Card danger={touched && !!errors.price}>
              <Field
                label={free ? "Entrada gratuita" : "Precio por entrada"}
                error={touched ? errors.price : null}
              >
                <View style={styles.bigRow}>
                  <Text
                    style={[styles.currency, price && { color: colors.text }]}
                  >
                    $
                  </Text>
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.bigInput]}
                    accessibilityLabel="Precio"
                  />
                </View>
              </Field>
            </Card>
            <View style={styles.chips}>
              <Chip
                label="Gratis"
                on={free}
                onPress={() => setPrice(free ? "" : "0")}
              />
            </View>
          </Animated.View>

          {/* Cupo */}
          <Animated.View
            entering={enter(3)}
            layout={LAYOUT}
            style={styles.section}
          >
            <GroupHeader title="Cupo" />
            <CardList>
              <Card>
                <ToggleRow
                  title="Cupo limitado"
                  description={
                    limited
                      ? "Se agota al llegar a la cantidad"
                      : "Sin tope: se vende sin límite"
                  }
                  value={limited}
                  onValueChange={setLimited}
                />
              </Card>
              {limited ? (
                <Animated.View
                  entering={FadeIn.duration(220)}
                  exiting={FadeOut.duration(140)}
                  layout={LAYOUT}
                >
                  <Card danger={touched && !!errors.stock}>
                    <Field
                      label="Cantidad de entradas"
                      error={touched ? errors.stock : null}
                    >
                      <View style={styles.bigRow}>
                        <TextInput
                          value={stock}
                          onChangeText={(t) =>
                            setStock(t.replace(/[^\d]/g, ""))
                          }
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="number-pad"
                          style={[styles.input, styles.bigInput]}
                          accessibilityLabel="Cantidad de entradas"
                        />
                        <Text style={styles.unit}>entradas</Text>
                      </View>
                    </Field>
                  </Card>
                </Animated.View>
              ) : null}
            </CardList>
            {limited ? (
              <Animated.View
                entering={FadeIn.duration(220)}
                layout={LAYOUT}
                style={{ gap: 10 }}
              >
                <View style={styles.chips}>
                  {STOCK_PRESETS.map((n) => (
                    <Chip
                      key={n}
                      label={formatInt(n)}
                      on={stock === String(n)}
                      disabled={n < sold}
                      onPress={() => setStock(String(n))}
                    />
                  ))}
                </View>
                {left != null || projected ? (
                  <Text style={styles.hint}>
                    {sold > 0 && left != null
                      ? `${formatInt(sold)} vendidas · quedan ${formatInt(left)}`
                      : ""}
                    {sold > 0 && left != null && projected ? "  ·  " : ""}
                    {projected ? `Si se agota: ${formatMoney(projected)}` : ""}
                  </Text>
                ) : null}
              </Animated.View>
            ) : null}
          </Animated.View>

          {/* Venta (solo al editar) */}
          {!isNew ? (
            <Animated.View
              entering={enter(4)}
              layout={LAYOUT}
              style={styles.section}
            >
              <GroupHeader title="Venta" />
              <Card>
                <ToggleRow
                  title="A la venta"
                  description={
                    active
                      ? "Se puede comprar"
                      : "Pausada: no se vende hasta que la actives"
                  }
                  value={active}
                  onValueChange={setActive}
                />
              </Card>
            </Animated.View>
          ) : null}

          {!isNew && ticket ? (
            <Animated.View entering={enter(5)}>
              <Pressable
                onPress={remove}
                accessibilityRole="button"
                style={({ pressed }) => [styles.delete, pressed && { opacity: 0.6 }]}
              >
                <Icon name="trash" size={15} color={colors.danger} />
                <Text style={styles.deleteText}>Eliminar entrada</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </KeyboardScroll>
      </View>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toggle = (v: boolean) => {
    Haptics.selectionAsync();
    onValueChange(v);
  };
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => toggle(!value)}
      style={styles.toggleRow}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleText}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={toggle}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </Pressable>
  );
}

function Chip({
  label,
  on,
  disabled,
  onPress,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      style={({ pressed }) => [
        styles.chip,
        on && styles.chipOn,
        disabled && { opacity: 0.35 },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: {
      padding: Spacing.three,
      paddingBottom: Spacing.six,
      gap: Spacing.four,
    },

    stats: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      backgroundColor: c.canvas,
    },
    stat: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 6 },
    statLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    statValue: {
      color: c.text,
      fontSize: 17,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: "stretch",
      backgroundColor: c.border,
    },

    section: { gap: 8 },
    field: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 2 },
    fieldHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    },
    fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    fieldError: { color: c.danger, fontSize: 12, fontWeight: "600" },
    input: {
      color: c.text,
      fontSize: 16,
      paddingVertical: 6,
      paddingHorizontal: 0,
    },
    bigRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    currency: {
      color: c.textMuted,
      fontSize: 26,
      fontFamily: DisplayFont.bold,
    },
    bigInput: {
      flex: 1,
      fontSize: 28,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.6,
    },
    unit: { color: c.textMuted, fontSize: 15, fontWeight: "600" },

    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      height: 34,
      paddingHorizontal: 14,
      borderRadius: Radius.pill,
      justifyContent: "center",
      backgroundColor: c.raised,
    },
    chipOn: { backgroundColor: c.ink },
    chipText: {
      color: c.ink,
      fontSize: 14,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    chipTextOn: { color: c.onInk },
    hint: {
      color: c.textMuted,
      fontSize: 13,
      paddingHorizontal: 4,
      fontVariant: ["tabular-nums"],
    },

    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    toggleTitle: {
      color: c.text,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
    },
    toggleText: { color: c.textMuted, fontSize: 13 },

    missing: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.background,
    },
    missingText: { color: c.textSecondary, fontSize: 15 },
    delete: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 48,
    },
    deleteText: { color: c.danger, fontSize: 15, fontFamily: DisplayFont.semibold },
  }),
);
