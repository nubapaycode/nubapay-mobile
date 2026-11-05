import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
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
import { Icon } from "@/components/dashboard/icon";
import { Card, CardList, GroupHeader } from "@/components/manage/catalog-kit";
import { TimeField } from "@/components/manage/time-field";
import { DisplayFont, Radius } from "@/constants/theme";
import { formatMoney } from "@/features/dashboard/format";
import {
  formatWindowLong,
  type Promo,
  promoEnded,
  type PromoInput,
  type PromoKind,
  promoLabel,
  promoLive,
  promoPriceFor,
  resolveWindow,
} from "@/features/manage/promo";
import { makeStyles, useTheme } from "@/theme";

const LAYOUT = LinearTransition.duration(240);
const PERCENT_PRESETS = [10, 15, 20, 30, 50];
const LIME = "#C6FF00";
const HOUR = 60 * 60 * 1000;

const hhmm = (d: Date) => `${d.getHours()}:${d.getMinutes()}`;
const startOfHour = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x;
};

/**
 * Día al que se anclan las horas de la promo: el inicio del evento si es reciente o futuro; si no
 * (evento de varios días o sin fecha), la hora actual.
 */
export function promoAnchor(eventStartIso: string | null): Date {
  const now = Date.now();
  const start = eventStartIso ? new Date(eventStartIso) : null;
  return start && start.getTime() > now - 24 * HOUR
    ? start
    : startOfHour(new Date(now));
}

/**
 * Borrador de la promo del formulario: activada o no, tipo y monto del descuento y franja horaria.
 * Devuelve el error a mostrar, si cambió respecto de lo guardado y lo que hay que mandar al guardar.
 */
export function usePromoDraft(
  initial: Promo | null,
  price: number,
  anchor: Date,
) {
  const defaults = useMemo(() => {
    const start = initial?.startsAt ?? startOfHour(anchor);
    const end = initial?.endsAt ?? new Date(start.getTime() + 2 * HOUR);
    return {
      enabled: !!initial,
      kind: (initial?.kind ?? "percent") as PromoKind,
      amount: initial ? String(initial.amount) : "",
      start,
      end,
    };
  }, [initial, anchor]);

  const [enabled, setEnabled] = useState(defaults.enabled);
  const [kind, setKind] = useState<PromoKind>(defaults.kind);
  const [amount, setAmount] = useState(defaults.amount);
  const [startTime, setStartTime] = useState(defaults.start);
  const [endTime, setEndTime] = useState(defaults.end);

  const value = Number(amount.replace(",", "."));
  const window = resolveWindow(startTime, endTime, anchor);
  const validPrice = Number.isFinite(price) && price > 0;
  const error = !enabled
    ? null
    : !validPrice
      ? "Primero poné el precio"
      : !(value > 0)
        ? "Poné el descuento"
        : kind === "percent" && value >= 100
          ? "Tiene que ser menor a 100%"
          : kind === "fixed" && value >= price
            ? "Tiene que ser menor al precio"
            : hhmm(startTime) === hhmm(endTime)
              ? "Elegí horarios distintos"
              : null;

  const dirty =
    enabled !== defaults.enabled ||
    (enabled &&
      (kind !== defaults.kind ||
        amount !== defaults.amount ||
        hhmm(startTime) !== hhmm(defaults.start) ||
        hhmm(endTime) !== hhmm(defaults.end)));

  const input: PromoInput | null = enabled
    ? { kind, amount: value, startsAt: window.startsAt, endsAt: window.endsAt }
    : null;

  return {
    initial,
    price,
    enabled,
    setEnabled,
    kind,
    setKind,
    amount,
    setAmount,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    value,
    window,
    error,
    dirty,
    input,
    finalPrice:
      validPrice && value > 0 ? promoPriceFor(price, kind, value) : null,
  };
}

export type PromoDraft = ReturnType<typeof usePromoDraft>;

/**
 * Sección "Promoción" del formulario de producto/combo: switch para activarla, descuento en
 * porcentaje o monto fijo (con atajos), vista previa del precio y la etiqueta, y franja horaria
 * (desde / hasta) con el día resuelto abajo.
 */
export function PromoSection({
  draft: d,
  index,
  touched,
}: {
  draft: PromoDraft;
  index: number;
  touched: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const showError = touched && !!d.error;
  const hours =
    Math.round(
      ((d.window.endsAt.getTime() - d.window.startsAt.getTime()) / HOUR) * 10,
    ) / 10;

  const status =
    d.initial && !d.dirty
      ? promoLive(d.initial)
        ? { label: "Activa ahora", fg: colors.success, bg: colors.successMuted }
        : promoEnded(d.initial)
          ? { label: "Terminó", fg: colors.textSecondary, bg: colors.raised }
          : {
              label: "Programada",
              fg: colors.primary,
              bg: "rgba(0, 105, 255, 0.1)",
            }
      : null;

  return (
    <Animated.View
      entering={enter(index)}
      layout={LAYOUT}
      style={styles.section}
    >
      <GroupHeader
        title="Promoción"
        action={
          showError ? (
            <Text style={styles.error}>{d.error}</Text>
          ) : status && d.enabled ? (
            <View style={[styles.status, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.fg }]}>
                {status.label}
              </Text>
            </View>
          ) : null
        }
      />
      <CardList>
        <Card>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: d.enabled }}
            onPress={() => {
              Haptics.selectionAsync();
              d.setEnabled(!d.enabled);
            }}
            style={styles.toggleRow}
          >
            <View style={styles.toggleIcon}>
              <Icon name="percent" size={15} color={colors.onBrand} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.toggleTitle}>Descuento por horario</Text>
              <Text style={styles.toggleText}>Ej: happy hour de 22 a 00 h</Text>
            </View>
            <Switch
              value={d.enabled}
              onValueChange={(v) => {
                Haptics.selectionAsync();
                d.setEnabled(v);
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </Pressable>
        </Card>

        {d.enabled ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(140)}
            layout={LAYOUT}
            style={{ gap: 8 }}
          >
            {/* Descuento */}
            <Card danger={showError && d.error !== "Elegí horarios distintos"}>
              <View style={styles.discount}>
                <View style={styles.kinds}>
                  {(
                    [
                      { value: "percent", label: "Porcentaje" },
                      { value: "fixed", label: "Monto fijo" },
                    ] as const
                  ).map((o) => {
                    const on = d.kind === o.value;
                    return (
                      <Pressable
                        key={o.value}
                        onPress={() => {
                          if (on) return;
                          Haptics.selectionAsync();
                          d.setKind(o.value);
                          d.setAmount("");
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        style={[styles.kind, on && styles.kindOn]}
                      >
                        <Text
                          style={[styles.kindText, on && styles.kindTextOn]}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.amountRow}>
                  {d.kind === "fixed" ? (
                    <Text
                      style={[styles.affix, d.amount && { color: colors.text }]}
                    >
                      $
                    </Text>
                  ) : null}
                  <TextInput
                    value={d.amount}
                    onChangeText={(t) => d.setAmount(t.replace(/[^\d.,]/g, ""))}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={styles.amountInput}
                    accessibilityLabel={
                      d.kind === "percent"
                        ? "Porcentaje de descuento"
                        : "Monto de descuento"
                    }
                  />
                  {d.kind === "percent" ? (
                    <Text
                      style={[styles.affix, d.amount && { color: colors.text }]}
                    >
                      %
                    </Text>
                  ) : null}
                  <Text style={styles.off}>de descuento</Text>
                </View>
              </View>
            </Card>

            {d.kind === "percent" ? (
              <View style={styles.chips}>
                {PERCENT_PRESETS.map((n) => {
                  const on = d.value === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => {
                        Haptics.selectionAsync();
                        d.setAmount(String(n));
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {n}%
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {/* Vista previa */}
            {d.finalPrice != null && !d.error ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={styles.preview}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.previewLabel}>Precio con promo</Text>
                  <View style={styles.previewPrices}>
                    <Text style={styles.previewNew}>
                      {formatMoney(d.finalPrice)}
                    </Text>
                    <Text style={styles.previewOld}>
                      {formatMoney(d.price)}
                    </Text>
                  </View>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {promoLabel(d.kind, d.value)}
                  </Text>
                </View>
              </Animated.View>
            ) : null}

            {/* Horario */}
            <Card danger={showError && d.error === "Elegí horarios distintos"}>
              <View style={styles.window}>
                <View style={styles.times}>
                  <TimeField
                    label="Desde"
                    value={d.startTime}
                    onChange={d.setStartTime}
                  />
                  <View style={styles.arrow}>
                    <Icon
                      name="chevronRight"
                      size={13}
                      color={colors.textMuted}
                    />
                  </View>
                  <TimeField
                    label="Hasta"
                    value={d.endTime}
                    onChange={d.setEndTime}
                  />
                </View>
                <View style={styles.windowFoot}>
                  <Icon name="calendar" size={13} color={colors.textMuted} />
                  <Text style={styles.windowText}>
                    {formatWindowLong(d.window.startsAt, d.window.endsAt)}
                    {hours > 0
                      ? `  ·  ${String(hours).replace(".", ",")} h`
                      : ""}
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        ) : null}
      </CardList>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    section: { gap: 8 },
    error: { color: c.danger, fontSize: 12, fontWeight: "600" },
    status: {
      paddingHorizontal: 8,
      height: 22,
      justifyContent: "center",
      borderRadius: Radius.pill,
    },
    statusText: { fontSize: 12, fontWeight: "700" },

    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    toggleIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: LIME,
    },
    toggleTitle: {
      color: c.text,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
    },
    toggleText: { color: c.textMuted, fontSize: 13 },

    discount: { padding: 14, gap: 12 },
    kinds: {
      flexDirection: "row",
      padding: 3,
      gap: 3,
      borderRadius: Radius.md,
      backgroundColor: c.raised,
    },
    kind: {
      flex: 1,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: Radius.sm,
    },
    kindOn: {
      backgroundColor: c.elevated,
      boxShadow: "0 1px 3px rgba(11, 15, 23, 0.12)",
    },
    kindText: { color: c.textSecondary, fontSize: 14, fontWeight: "600" },
    kindTextOn: { color: c.ink },
    amountRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    affix: { color: c.textMuted, fontSize: 26, fontFamily: DisplayFont.bold },
    amountInput: {
      minWidth: 40,
      color: c.text,
      fontSize: 28,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.6,
      paddingVertical: 2,
      paddingHorizontal: 0,
    },
    off: { marginLeft: 6, color: c.textMuted, fontSize: 15, fontWeight: "600" },

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

    preview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      backgroundColor: c.canvas,
    },
    previewLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    previewPrices: { flexDirection: "row", alignItems: "baseline", gap: 8 },
    previewNew: {
      color: c.text,
      fontSize: 22,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
      fontVariant: ["tabular-nums"],
    },
    previewOld: {
      color: c.textMuted,
      fontSize: 14,
      textDecorationLine: "line-through",
      fontVariant: ["tabular-nums"],
    },
    badge: {
      paddingHorizontal: 10,
      height: 28,
      justifyContent: "center",
      borderRadius: Radius.pill,
      backgroundColor: LIME,
    },
    badgeText: { color: c.onBrand, fontSize: 13, fontWeight: "800" },

    window: { padding: 14, gap: 12 },
    times: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
    arrow: { height: 44, justifyContent: "center" },
    windowFoot: { flexDirection: "row", alignItems: "center", gap: 6 },
    windowText: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 13,
      fontVariant: ["tabular-nums"],
    },
  }),
);
