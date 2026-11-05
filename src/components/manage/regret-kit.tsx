import { StyleSheet, Text, View } from "react-native";

import { DisplayFont, Radius } from "@/constants/theme";
import { initials } from "@/features/dashboard/format";
import type { Regret } from "@/features/manage/manage";
import { makeStyles, useTheme } from "@/theme";

/** Lima de marca (fondos). */
export const LIME = "#C6FF00";
/** Una solicitud pendiente desde hace más de esto se marca como demorada. */
export const STALE_MS = 72 * 60 * 60 * 1000;

const DAY = 24 * 60 * 60 * 1000;

/** "hoy", "hace 1 día", "hace 5 días". */
export function waitingFor(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY);
  if (days <= 0) return "hoy";
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

export const isStale = (r: Regret, now: number) =>
  r.status === "pending" && now - new Date(r.createdAt).getTime() > STALE_MS;

/** Iniciales del comprador: lima si está pendiente, gris si ya se resolvió. */
export function RegretAvatar({
  name,
  pending,
  size = 44,
}: {
  name: string;
  pending: boolean;
  size?: number;
}) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        pending ? styles.avatarPending : styles.avatarDone,
      ]}
    >
      <Text
        style={[
          styles.avatarText,
          { fontSize: size * 0.36 },
          !pending && styles.avatarTextDone,
        ]}
      >
        {initials(name) || "?"}
      </Text>
    </View>
  );
}

/** Pastilla de estado: Pendiente (lima) / Demorada (naranja) / Resuelta (verde). */
export function RegretStatus({ regret, now }: { regret: Regret; now: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const stale = isStale(regret, now);
  const pending = regret.status === "pending";
  const tone = !pending
    ? { fg: colors.success, bg: colors.successMuted, label: "Resuelta" }
    : stale
      ? { fg: colors.warning, bg: colors.warningMuted, label: "Demorada" }
      : { fg: colors.brandText, bg: colors.brandMuted, label: "Pendiente" };
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: tone.fg }]} />
      <Text style={[styles.pillText, { color: tone.fg }]}>{tone.label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    avatar: { alignItems: "center", justifyContent: "center" },
    avatarPending: { backgroundColor: LIME },
    avatarDone: { backgroundColor: c.raised },
    avatarText: { color: "#000000", fontFamily: DisplayFont.bold },
    avatarTextDone: { color: c.textSecondary },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      height: 24,
      paddingHorizontal: 9,
      borderRadius: Radius.pill,
    },
    pillDot: { width: 6, height: 6, borderRadius: 3 },
    pillText: { fontSize: 12, fontWeight: "700" },
  }),
);
