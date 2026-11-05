import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { enter, enterRow } from "@/components/dashboard/detail-kit";
import { Icon } from "@/components/dashboard/icon";
import { ProgressBar } from "@/components/dashboard/progress-bar";
import {
  CatalogSkeleton,
  EmptyState,
  GroupHeader,
} from "@/components/manage/catalog-kit";
import { DisplayFont, Radius, Spacing } from "@/constants/theme";
import {
  formatInt,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
} from "@/features/dashboard/format";
import {
  setTicketActive,
  type TicketType,
  useTickets,
} from "@/features/manage/manage";
import { useFocusStatusBar } from "@/hooks/use-focus-status-bar";
import { makeStyles, useTheme } from "@/theme";

/** Verde lima del botón "+" del header (igual que el catálogo). */
const LIME = "#C6FF00";
/** Desde este % del cupo se avisa que quedan pocas. */
const ALMOST = 0.9;
/** Tamaño de los semicírculos del troquel. */
const NOTCH = 18;

const newTicket = () =>
  router.push({ pathname: "/manage/ticket/[id]", params: { id: "new" } });

type Status = {
  label: string;
  tone: "success" | "warning" | "strong" | "muted";
};

/** Estado de venta de un tipo de entrada (lo que se ve con el punto de color). */
function ticketStatus(t: TicketType): Status {
  if (!t.isActive) return { label: "Pausada", tone: "muted" };
  if (t.stock != null && t.sold >= t.stock)
    return { label: "Agotada", tone: "strong" };
  if (t.stock != null && t.sold / t.stock >= ALMOST)
    return { label: `Últimas ${formatInt(t.stock - t.sold)}`, tone: "warning" };
  return { label: "A la venta", tone: "success" };
}

/**
 * Entradas (patrón Luma "Tickets" + resumen tipo Posh): arriba lo recaudado y el aforo vendido;
 * abajo cada tipo de entrada en una card con forma de ticket (troquel): nombre, precio y estado
 * arriba; vendidas, barra de cupo y switch de venta abajo. Tocarla abre la edición; el "+" del
 * header crea una nueva.
 */
export default function TicketsAdminScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tickets: list, error, eventId } = useTickets();
  useFocusStatusBar("dark");

  const tickets = list ?? [];
  const sold = tickets.reduce((a, t) => a + t.sold, 0);
  const revenue = tickets.reduce((a, t) => a + t.revenue, 0);
  const onSale = tickets.filter((t) =>
    ["success", "warning"].includes(ticketStatus(t).tone),
  ).length;
  // Aforo total solo si todos los tipos tienen cupo.
  const capacity =
    tickets.length && tickets.every((t) => t.stock != null)
      ? tickets.reduce((a, t) => a + (t.stock ?? 0), 0)
      : null;

  return (
    <>
      <Stack.Screen
        options={
          Platform.OS === "ios"
            ? {
                unstable_headerRightItems: () => [
                  {
                    type: "button",
                    label: "Nueva entrada",
                    icon: { type: "sfSymbol", name: "plus" },
                    variant: "prominent",
                    tintColor: LIME,
                    onPress: newTicket,
                  },
                ],
              }
            : {
                headerRight: () => (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      newTicket();
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Nueva entrada"
                    style={({ pressed }) => [
                      styles.headerBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Icon name="plus" size={20} color="#000000" />
                  </Pressable>
                ),
              }
        }
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        {!list ? (
          error ? (
            <EmptyState
              icon="help"
              title="No pudimos cargar las entradas"
              text={error}
            />
          ) : (
            <CatalogSkeleton />
          )
        ) : tickets.length === 0 ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <EmptyState
              icon="ticket"
              title="Todavía no vendés entradas"
              text="Creá los tipos de entrada del evento: general, VIP, anticipadas. Cada uno con su precio y cupo."
              action="Crear entrada"
              onAction={() => {
                Haptics.selectionAsync();
                newTicket();
              }}
            />
          </Animated.View>
        ) : (
          <>
            {/* Resumen */}
            <Animated.View entering={enter(0)} style={styles.hero}>
              <Text style={styles.heroCaption}>Recaudado en entradas</Text>
              <Text
                style={styles.heroValue}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(revenue)}
              </Text>
              <View style={styles.heroStats}>
                <HeroStat value={formatInt(sold)} label="vendidas" />
                <View style={styles.heroDot} />
                <HeroStat value={formatInt(onSale)} label="a la venta" />
                {capacity ? (
                  <>
                    <View style={styles.heroDot} />
                    <HeroStat
                      value={formatInt(Math.max(0, capacity - sold))}
                      label="disponibles"
                    />
                  </>
                ) : null}
              </View>
              {capacity ? (
                <View style={{ gap: 8, marginTop: 6 }}>
                  <ProgressBar
                    height={10}
                    total={capacity}
                    delay={160}
                    track="#ffffff"
                    segments={[{ value: sold, color: colors.chart.ramp[0] }]}
                  />
                  <View style={styles.capacityRow}>
                    <Text style={styles.capacityText}>Aforo vendido</Text>
                    <Text style={styles.capacityPct}>
                      {formatPercent(sold / capacity)}
                      <Text
                        style={styles.capacityOf}
                      >{`  ${formatInt(sold)} / ${formatInt(capacity)}`}</Text>
                    </Text>
                  </View>
                </View>
              ) : null}
            </Animated.View>

            <Animated.View entering={enter(1)} style={styles.section}>
              <GroupHeader title="Tipos de entrada" count={tickets.length} />
              <View style={styles.list}>
                {tickets.map((t, i) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    index={i}
                    eventId={eventId}
                  />
                ))}
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
  return (
    <Text style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text> {label}
    </Text>
  );
}

/** Guiones del troquel (dibujados a mano: el borde punteado de un solo lado no se ve en iOS). */
const DASHES = Array.from({ length: 48 });

function TicketCard({
  ticket: t,
  index,
  eventId,
}: {
  ticket: TicketType;
  index: number;
  eventId: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const status = ticketStatus(t);
  const off = !t.isActive;
  const free = t.price === 0;
  const left = t.stock != null ? Math.max(0, t.stock - t.sold) : null;
  const ratio = t.stock ? Math.min(1, t.sold / t.stock) : null;

  const tone = {
    success: { fg: colors.success, bg: colors.successMuted },
    warning: { fg: colors.warning, bg: colors.warningMuted },
    strong: { fg: colors.surface, bg: colors.text },
    muted: { fg: colors.textSecondary, bg: colors.raised },
  }[status.tone];
  const bar = off
    ? colors.textMuted
    : status.tone === "strong"
      ? colors.text
      : status.tone === "warning"
        ? colors.warning
        : colors.chart.ramp[0];
  const paper = off ? colors.canvas : colors.surface;

  return (
    <Animated.View
      entering={enterRow(index)}
      layout={LinearTransition.duration(260)}
    >
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          router.push({
            pathname: "/manage/ticket/[id]",
            params: { id: t.id },
          });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t.name}, ${free ? "gratis" : formatMoney(t.price)}, ${status.label}. Editar`}
        style={({ pressed }) => [
          styles.ticket,
          { backgroundColor: paper },
          pressed && styles.ticketPressed,
        ]}
      >
        {/* Talón superior: nombre + switch, precio + estado */}
        <View style={styles.stubTop}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, off && styles.off]} numberOfLines={1}>
              {t.name}
            </Text>
            <Switch
              value={t.isActive}
              onValueChange={(v) => {
                Haptics.selectionAsync();
                if (eventId) setTicketActive(eventId, t.id, v);
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={`${t.name}: ${t.isActive ? "a la venta" : "pausada"}`}
            />
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.price, off && styles.off]}>
              {free ? "Gratis" : formatMoney(t.price)}
            </Text>
            <View style={[styles.pill, { backgroundColor: tone.bg }]}>
              {status.tone !== "strong" ? (
                <View style={[styles.pillDot, { backgroundColor: tone.fg }]} />
              ) : null}
              <Text style={[styles.pillText, { color: tone.fg }]}>
                {status.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Troquel */}
        <View style={styles.perforation}>
          <View style={[styles.notch, { left: -NOTCH / 2 }]} />
          <View style={styles.dashes}>
            {DASHES.map((_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </View>
          <View style={[styles.notch, { right: -NOTCH / 2 }]} />
        </View>

        {/* Talón inferior: cifras + barra de cupo */}
        <View style={styles.stubBottom}>
          <View style={styles.figures}>
            <Figure
              label="Vendidas"
              value={formatInt(t.sold)}
              suffix={t.stock != null ? `/${formatInt(t.stock)}` : undefined}
              off={off}
            />
            <Figure
              label="Quedan"
              value={left != null ? formatInt(left) : "Sin tope"}
              off={off}
            />
            <Figure
              label="Recaudado"
              value={free ? "—" : formatMoneyCompact(t.revenue)}
              off={off}
              align="right"
            />
          </View>
          {ratio != null ? (
            <View style={styles.barRow}>
              <View style={{ flex: 1 }}>
                <ProgressBar
                  height={6}
                  total={t.stock ?? 1}
                  delay={220 + index * 70}
                  track={off ? colors.border : colors.raised}
                  segments={[{ value: t.sold, color: bar }]}
                />
              </View>
              <Text style={styles.barPct}>{formatPercent(ratio)}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Figure({
  label,
  value,
  suffix,
  off,
  align,
}: {
  label: string;
  value: string;
  suffix?: string;
  off?: boolean;
  align?: "right";
}) {
  const styles = useStyles();
  return (
    <View
      style={[styles.figure, align === "right" && { alignItems: "flex-end" }]}
    >
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, off && styles.off]} numberOfLines={1}>
        {value}
        {suffix ? <Text style={styles.figureSuffix}>{suffix}</Text> : null}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#ffffff" },
    content: {
      padding: Spacing.three,
      paddingBottom: Spacing.six,
      gap: Spacing.four,
    },
    headerBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: LIME,
    },

    // Resumen
    hero: {
      gap: 4,
      padding: 18,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      backgroundColor: c.canvas,
    },
    heroCaption: { color: c.textSecondary, fontSize: 13, fontWeight: "600" },
    heroValue: {
      color: c.text,
      fontSize: 36,
      fontFamily: DisplayFont.bold,
      letterSpacing: -1.2,
      fontVariant: ["tabular-nums"],
    },
    heroStats: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },
    heroStat: { color: c.textSecondary, fontSize: 13 },
    heroStatValue: {
      color: c.text,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    heroDot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: c.textMuted,
    },
    capacityRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    capacityText: { color: c.textSecondary, fontSize: 13 },
    capacityPct: {
      color: c.text,
      fontSize: 15,
      fontFamily: DisplayFont.bold,
      fontVariant: ["tabular-nums"],
    },
    capacityOf: {
      color: c.textMuted,
      fontSize: 12,
      fontFamily: undefined,
      fontWeight: "500",
    },

    section: { gap: 10 },
    list: { gap: 12 },

    // Ticket
    ticket: {
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
    },
    ticketPressed: { borderColor: "#c9ced6", transform: [{ scale: 0.99 }] },
    stubTop: {
      gap: 6,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 12,
    },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    name: {
      flex: 1,
      color: c.text,
      fontSize: 17,
      fontFamily: DisplayFont.semibold,
    },
    off: { color: c.textMuted },
    priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    price: {
      color: c.text,
      fontSize: 24,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.6,
      fontVariant: ["tabular-nums"],
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 24,
      paddingHorizontal: 9,
      borderRadius: Radius.pill,
    },
    pillDot: { width: 6, height: 6, borderRadius: 3 },
    pillText: {
      fontSize: 12,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },

    perforation: { height: NOTCH, justifyContent: "center" },
    dashes: {
      flexDirection: "row",
      gap: 5,
      marginHorizontal: NOTCH,
      overflow: "hidden",
    },
    dash: { width: 7, height: 1.5, borderRadius: 1, backgroundColor: c.border },
    notch: {
      position: "absolute",
      top: 0,
      width: NOTCH,
      height: NOTCH,
      borderRadius: NOTCH / 2,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: "#ffffff",
    },

    stubBottom: {
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 16,
    },
    figures: { flexDirection: "row", gap: 12 },
    figure: { flex: 1, gap: 2 },
    figureLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    figureValue: {
      color: c.text,
      fontSize: 17,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
    },
    figureSuffix: {
      color: c.textMuted,
      fontSize: 13,
      fontFamily: DisplayFont.semibold,
      letterSpacing: 0,
    },
    barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    barPct: {
      minWidth: 36,
      textAlign: "right",
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
  }),
);
