import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { EventContext } from "@/components/events/event-context";
import { enter } from "@/components/dashboard/detail-kit";
import { Icon } from "@/components/dashboard/icon";
import { Segmented } from "@/components/dashboard/segmented";
import { CatalogSkeleton, EmptyState } from "@/components/manage/catalog-kit";
import {
  isStale,
  RegretAvatar,
  RegretStatus,
  waitingFor,
} from "@/components/manage/regret-kit";
import { DisplayFont, Radius, Spacing } from "@/constants/theme";
import { relativeTime } from "@/features/dashboard/format";
import { type Regret, useRegrets } from "@/features/manage/manage";
import { useFocusStatusBar } from "@/hooks/use-focus-status-bar";
import { useNow } from "@/hooks/use-now";
import { makeStyles, useTheme } from "@/theme";

type Filter = "pending" | "resolved";
const LAYOUT = LinearTransition.duration(260);
const time = (r: Regret) => new Date(r.createdAt).getTime();

/**
 * Arrepentimientos de compra (bandeja tipo inbox): arriba cuántas solicitudes esperan y hace cuánto
 * la más vieja; abajo pendientes / resueltas. Cada solicitud en su card con las iniciales del
 * comprador, qué compró y hace cuánto la pidió. Las pendientes van de la más vieja a la más nueva
 * (primero lo que más espera); las resueltas, de la más nueva a la más vieja.
 */
export default function RegretsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { regrets: list, error } = useRegrets();
  const now = useNow(30_000);
  const [filter, setFilter] = useState<Filter>("pending");
  useFocusStatusBar();

  const { pending, resolved } = useMemo(() => {
    const all = list ?? [];
    return {
      pending: all
        .filter((r) => r.status === "pending")
        .sort((a, b) => time(a) - time(b)),
      resolved: all
        .filter((r) => r.status === "resolved")
        .sort((a, b) => time(b) - time(a)),
    };
  }, [list]);
  const shown = filter === "pending" ? pending : resolved;
  const oldest = pending[0];
  const stale = pending.filter((r) => isStale(r, now)).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Animated.View entering={enter(0)}>
        <EventContext caption="Arrepentimientos de" />
      </Animated.View>
      {!list ? (
        error ? (
          <EmptyState
            icon="help"
            title="No pudimos cargar las solicitudes"
            text={error}
          />
        ) : (
          <CatalogSkeleton />
        )
      ) : (
        <>
          {/* Resumen */}
          <Animated.View
            entering={enter(0)}
            style={[styles.hero, pending.length === 0 && styles.heroDone]}
          >
            {pending.length > 0 ? (
              <>
                <View style={styles.heroTop}>
                  <Text style={styles.heroValue}>{pending.length}</Text>
                  <Text style={styles.heroLabel}>
                    {pending.length === 1
                      ? "solicitud\npor resolver"
                      : "solicitudes\npor resolver"}
                  </Text>
                </View>
                <View style={styles.heroMetaRow}>
                  <Icon
                    name="clock"
                    size={13}
                    color={stale ? colors.warning : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.heroMeta,
                      stale > 0 && { color: colors.warning },
                    ]}
                  >
                    {oldest
                      ? `La más antigua espera desde ${waitingFor(oldest.createdAt, now)}`
                      : ""}
                    {stale > 0
                      ? ` · ${stale} demorada${stale === 1 ? "" : "s"}`
                      : ""}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.doneRow}>
                <View style={styles.doneIcon}>
                  <Icon name="checkmark" size={18} color={colors.onPrimary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.doneTitle}>Todo al día</Text>
                  <Text style={styles.doneText}>
                    {resolved.length > 0
                      ? `No hay solicitudes pendientes. ${resolved.length} resuelta${resolved.length === 1 ? "" : "s"}.`
                      : "Cuando un comprador se arrepienta de su compra, la solicitud aparece acá."}
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>

          {list.length > 0 ? (
            <Animated.View entering={enter(1)}>
              <Segmented
                options={[
                  { value: "pending", label: `Pendientes · ${pending.length}` },
                  {
                    value: "resolved",
                    label: `Resueltas · ${resolved.length}`,
                  },
                ]}
                value={filter}
                onChange={setFilter}
              />
            </Animated.View>
          ) : null}

          {list.length > 0 && shown.length === 0 ? (
            <Animated.View entering={FadeIn.duration(300)}>
              <EmptyState
                icon={filter === "pending" ? "checkmark" : "receipt"}
                title={
                  filter === "pending"
                    ? "Sin pendientes"
                    : "Nada resuelto todavía"
                }
                text={
                  filter === "pending"
                    ? "Resolviste todas las solicitudes."
                    : "Las solicitudes que marques como resueltas quedan acá."
                }
              />
            </Animated.View>
          ) : (
            <View style={styles.list}>
              {shown.map((r) => (
                <Animated.View
                  key={r.id}
                  entering={FadeIn.duration(300)}
                  exiting={FadeOut.duration(160)}
                  layout={LAYOUT}
                >
                  <RegretCard regret={r} now={now} />
                </Animated.View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function RegretCard({ regret: r, now }: { regret: Regret; now: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pending = r.status === "pending";
  const stale = isStale(r, now);

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: "/manage/regret/[id]", params: { id: r.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${r.fullName}, ${pending ? "pendiente" : "resuelta"}, ${relativeTime(r.createdAt, now)}. Ver detalle`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View>
        <RegretAvatar name={r.fullName} pending={pending} />
        {pending ? (
          <View
            style={[
              styles.unread,
              stale && { backgroundColor: colors.warning },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text
            style={[styles.name, !pending && styles.nameDone]}
            numberOfLines={1}
          >
            {r.fullName}
          </Text>
          <Text
            style={[
              styles.time,
              stale && { color: colors.warning, fontWeight: "700" },
            ]}
          >
            {relativeTime(r.createdAt, now)}
          </Text>
        </View>
        <Text style={styles.detail} numberOfLines={2}>
          {r.purchaseDetail}
        </Text>
        <View style={styles.bottom}>
          <RegretStatus regret={r} now={now} />
          {r.screenshotUrl ? (
            <View style={styles.attach}>
              <Icon name="photo" size={12} color={colors.textMuted} />
              <Text style={styles.attachText}>Comprobante</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
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

    hero: {
      gap: 10,
      padding: 18,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      backgroundColor: c.canvas,
    },
    heroDone: { backgroundColor: c.successMuted },
    heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    heroValue: {
      color: c.text,
      fontSize: 48,
      lineHeight: 52,
      fontFamily: DisplayFont.bold,
      letterSpacing: -1.6,
      fontVariant: ["tabular-nums"],
    },
    heroLabel: {
      color: c.textSecondary,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: "600",
    },
    heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    heroMeta: { flex: 1, color: c.textSecondary, fontSize: 13 },
    doneRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    doneIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.success,
    },
    doneTitle: {
      color: c.text,
      fontSize: 17,
      fontFamily: DisplayFont.semibold,
    },
    doneText: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },

    list: { gap: 10 },
    card: {
      flexDirection: "row",
      gap: 12,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    cardPressed: { backgroundColor: c.canvas },
    unread: {
      position: "absolute",
      top: -1,
      right: -1,
      width: 13,
      height: 13,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: c.background,
      backgroundColor: c.primary,
    },
    body: { flex: 1, gap: 4 },
    top: { flexDirection: "row", alignItems: "baseline", gap: 10 },
    name: {
      flex: 1,
      color: c.text,
      fontSize: 16,
      fontFamily: DisplayFont.semibold,
    },
    nameDone: { color: c.textSecondary },
    time: { color: c.textMuted, fontSize: 12, fontVariant: ["tabular-nums"] },
    detail: { color: c.textSecondary, fontSize: 14, lineHeight: 19 },
    bottom: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 4,
    },
    attach: { flexDirection: "row", alignItems: "center", gap: 4 },
    attachText: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
  }),
);
