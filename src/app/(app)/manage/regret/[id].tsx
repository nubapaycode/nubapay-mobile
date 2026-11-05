import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { enter } from "@/components/dashboard/detail-kit";
import { Icon, type IconName } from "@/components/dashboard/icon";
import { Card, GroupHeader } from "@/components/manage/catalog-kit";
import {
  RegretAvatar,
  RegretStatus,
  waitingFor,
} from "@/components/manage/regret-kit";
import { DisplayFont, Radius, Spacing } from "@/constants/theme";
import { setRegretStatus, useRegrets } from "@/features/manage/manage";
import { useFocusStatusBar } from "@/hooks/use-focus-status-bar";
import { useNow } from "@/hooks/use-now";
import { loadClipboard } from "@/lib/native-modules";
import { makeStyles, useTheme } from "@/theme";

/** Solo acepta URLs https; cualquier otro esquema (intent:, tel:, javascript:…) se descarta. */
function safeHttpsUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Detalle de un arrepentimiento: quién lo pide y hace cuánto, accesos para escribirle (WhatsApp /
 * email), qué compró, el alias para devolver el pago (se copia), el comprobante y los pasos para
 * resolverlo (patrón de seguimiento de Zip / Shopee). "Marcar como resuelta" queda fijo abajo.
 * (Cancelar el QR del pedido se hace desde Operaciones → detalle del pedido.)
 */
export default function RegretScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { regrets, eventId } = useRegrets();
  const regret = regrets?.find((r) => r.id === id);
  const now = useNow(60_000);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  useFocusStatusBar();
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  if (!regret) {
    return (
      <View style={styles.missing}>
        {regrets ? (
          <Text style={styles.missingText}>No encontramos esta solicitud.</Text>
        ) : (
          <ActivityIndicator color={colors.textMuted} />
        )}
      </View>
    );
  }
  const pending = regret.status === "pending";
  const whatsappNumber = regret.whatsapp.replace(/[^\d]/g, "");
  const screenshotUrl = safeHttpsUrl(regret.screenshotUrl);
  const email = regret.email?.trim();
  const validEmail = email && EMAIL_RE.test(email) ? email : null;

  const copyAlias = async () => {
    const Clipboard = await loadClipboard();
    if (!Clipboard) return;
    await Clipboard.setStringAsync(regret.bankAlias);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
  };

  const update = async (status: "pending" | "resolved") => {
    if (!eventId || saving) return;
    setSaving(true);
    const res = await setRegretStatus(eventId, regret.id, status);
    setSaving(false);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("No se pudo actualizar", res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleStatus = () =>
    Alert.alert(
      pending ? "Marcar como resuelta" : "Volver a pendiente",
      pending
        ? "¿Ya devolviste el pago y anulaste el QR del pedido?"
        : "La solicitud vuelve a la lista de pendientes.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: pending ? "Sí, resuelta" : "Volver a pendiente",
          onPress: () => update(pending ? "resolved" : "pending"),
        },
      ],
    );

  return (
    <>
      <Stack.Screen options={{ title: "Solicitud" }} />
      <View style={styles.screen}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 120 + insets.bottom },
          ]}
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Quién y cuándo */}
          <Animated.View entering={enter(0)} style={styles.header}>
            <RegretAvatar name={regret.fullName} pending={pending} size={56} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name} numberOfLines={2}>
                {regret.fullName}
              </Text>
              <Text style={styles.when}>
                Pidió el {dateFmt.format(new Date(regret.createdAt))} ·{" "}
                {waitingFor(regret.createdAt, now)}
              </Text>
              <Animated.View
                layout={LinearTransition.duration(260)}
                style={{ marginTop: 2 }}
              >
                <RegretStatus regret={regret} now={now} />
              </Animated.View>
            </View>
          </Animated.View>

          {/* Contactar */}
          <Animated.View entering={enter(1)} style={styles.actions}>
            {whatsappNumber ? (
              <QuickAction
                icon="message"
                label="WhatsApp"
                value={regret.whatsapp}
                onPress={() =>
                  Linking.openURL(`https://wa.me/${whatsappNumber}`)
                }
              />
            ) : null}
            {validEmail ? (
              <QuickAction
                icon="mail"
                label="Email"
                value={validEmail}
                onPress={() =>
                  Linking.openURL(`mailto:${encodeURIComponent(validEmail)}`)
                }
              />
            ) : null}
          </Animated.View>

          {/* Qué compró */}
          <Animated.View entering={enter(2)} style={styles.section}>
            <GroupHeader title="Qué compró" />
            <Card>
              <View style={styles.purchase}>
                <View style={styles.quoteBar} />
                <Text style={styles.purchaseText} selectable>
                  {regret.purchaseDetail}
                </Text>
              </View>
            </Card>
          </Animated.View>

          {/* Devolución */}
          <Animated.View entering={enter(3)} style={styles.section}>
            <GroupHeader title="Devolución" />
            <Pressable
              onPress={copyAlias}
              accessibilityRole="button"
              accessibilityLabel={`Alias ${regret.bankAlias}. Copiar`}
              style={({ pressed }) => [
                styles.alias,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.aliasLabel}>
                  Alias o CBU para devolver el pago
                </Text>
                <Text style={styles.aliasValue} selectable numberOfLines={2}>
                  {regret.bankAlias}
                </Text>
              </View>
              <Animated.View
                key={String(copied)}
                entering={FadeIn.duration(200)}
                style={[styles.copyBtn, copied && styles.copyBtnDone]}
              >
                <Icon
                  name={copied ? "checkmark" : "copy"}
                  size={13}
                  color={copied ? colors.onInk : colors.ink}
                />
                <Text style={[styles.copyText, copied && { color: colors.onInk }]}>
                  {copied ? "Copiado" : "Copiar"}
                </Text>
              </Animated.View>
            </Pressable>
          </Animated.View>

          {/* Comprobante */}
          <Animated.View entering={enter(4)} style={styles.section}>
            <GroupHeader title="Comprobante" />
            {screenshotUrl ? (
              <Pressable
                onPress={() => Linking.openURL(screenshotUrl)}
                accessibilityRole="imagebutton"
                accessibilityLabel="Abrir comprobante"
                style={styles.receipt}
              >
                <Image
                  source={{ uri: screenshotUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                />
                <View style={styles.receiptOpen}>
                  <Icon name="external" size={12} color={colors.ink} />
                  <Text style={styles.receiptOpenText}>Abrir</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.noReceipt}>
                <Icon name="receipt" size={18} color={colors.textMuted} />
                <Text style={styles.noReceiptText}>
                  El comprador no adjuntó comprobante.
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Pasos */}
          <Animated.View entering={enter(5)} style={styles.section}>
            <GroupHeader title="Cómo resolverla" />
            <Card>
              <View style={styles.steps}>
                <Step
                  done
                  title="Solicitud recibida"
                  text={dateFmt.format(new Date(regret.createdAt))}
                />
                <Step
                  done={!pending}
                  current={pending}
                  title="Devolver el pago"
                  text="Transferí el monto al alias o CBU del comprador."
                />
                <Step
                  done={!pending}
                  current={pending}
                  title="Anular el QR del pedido"
                  text="Desde Operaciones, abrí el pedido y cancelalo."
                />
                <Step
                  done={!pending}
                  last
                  title="Marcar como resuelta"
                  text={pending ? "Con el botón de abajo." : "Listo."}
                />
              </View>
            </Card>
          </Animated.View>
        </ScrollView>

        {/* Acción fija */}
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, Spacing.three) },
          ]}
        >
          <Pressable
            onPress={toggleStatus}
            disabled={saving}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.action,
              pending ? styles.actionPrimary : styles.actionSecondary,
              pressed && { opacity: 0.85 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color={pending ? colors.onInk : colors.ink} />
            ) : (
              <>
                <Icon
                  name={pending ? "checkmark" : "undo"}
                  size={16}
                  color={pending ? colors.onInk : colors.ink}
                />
                <Text
                  style={[
                    styles.actionText,
                    !pending && styles.actionTextSecondary,
                  ]}
                >
                  {pending ? "Marcar como resuelta" : "Volver a pendiente"}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </>
  );
}

function QuickAction({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        styles.quick,
        pressed && { backgroundColor: colors.canvas },
      ]}
    >
      <View style={styles.quickIcon}>
        <Icon name={icon} size={16} color={colors.ink} />
      </View>
      <View style={{ gap: 1 }}>
        <Text style={styles.quickLabel}>{label}</Text>
        <Text style={styles.quickValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

function Step({
  title,
  text,
  done,
  current,
  last,
}: {
  title: string;
  text: ReactNode;
  done?: boolean;
  current?: boolean;
  last?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.step}>
      <View style={styles.stepRail}>
        <View
          style={[
            styles.stepDot,
            done && styles.stepDotDone,
            current && styles.stepDotCurrent,
          ]}
        >
          {done ? <Icon name="checkmark" size={11} color={colors.onInk} /> : null}
        </View>
        {!last ? (
          <View
            style={[
              styles.stepLine,
              done && { backgroundColor: colors.success },
            ]}
          />
        ) : null}
      </View>
      <View style={[styles.stepBody, !last && { paddingBottom: 18 }]}>
        <Text
          style={[
            styles.stepTitle,
            !done && !current && { color: colors.textMuted },
          ]}
        >
          {title}
        </Text>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, gap: Spacing.four },

    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
      paddingHorizontal: 2,
    },
    name: {
      color: c.text,
      fontSize: 22,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
    },
    when: { color: c.textMuted, fontSize: 13 },

    actions: { flexDirection: "row", gap: 10 },
    quick: {
      flex: 1,
      gap: 10,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    quickIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.raised,
    },
    quickLabel: {
      color: c.text,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
    },
    quickValue: { color: c.textMuted, fontSize: 12 },

    section: { gap: 8 },
    purchase: { flexDirection: "row", gap: 12, padding: 16 },
    quoteBar: { width: 3, borderRadius: 2, backgroundColor: "#C6FF00" },
    purchaseText: {
      flex: 1,
      color: c.text,
      fontSize: 17,
      lineHeight: 24,
      fontFamily: DisplayFont.semibold,
    },

    alias: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      backgroundColor: c.canvas,
    },
    aliasLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    aliasValue: {
      color: c.text,
      fontSize: 20,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.3,
    },
    copyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: Radius.pill,
      backgroundColor: c.elevated,
    },
    copyBtnDone: { backgroundColor: c.success },
    copyText: {
      color: c.ink,
      fontSize: 13,
      fontFamily: DisplayFont.semibold,
    },

    receipt: {
      height: 200,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      overflow: "hidden",
      backgroundColor: c.raised,
    },
    receiptOpen: {
      position: "absolute",
      right: 12,
      bottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 30,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      backgroundColor: c.elevated,
      boxShadow: "0 2px 10px rgba(11, 15, 23, 0.18)",
    },
    receiptOpenText: {
      color: c.ink,
      fontSize: 13,
      fontFamily: DisplayFont.semibold,
    },
    noReceipt: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 16,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: c.border,
    },
    noReceiptText: { color: c.textMuted, fontSize: 14 },

    steps: { padding: 16 },
    step: { flexDirection: "row", gap: 12 },
    stepRail: { alignItems: "center", width: 20 },
    stepDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.background,
    },
    stepDotDone: { backgroundColor: c.success, borderColor: c.success },
    stepDotCurrent: { borderColor: c.ink, borderWidth: 2 },
    stepLine: {
      flex: 1,
      width: 2,
      marginVertical: 2,
      borderRadius: 1,
      backgroundColor: c.border,
    },
    stepBody: { flex: 1, gap: 2 },
    stepTitle: {
      color: c.text,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
      lineHeight: 20,
    },
    stepText: { color: c.textMuted, fontSize: 13, lineHeight: 18 },

    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: Spacing.three,
      paddingTop: 12,
      backgroundColor: c.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    action: {
      flexDirection: "row",
      gap: 8,
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
    },
    actionPrimary: { backgroundColor: c.ink },
    actionSecondary: { backgroundColor: c.raised },
    actionText: {
      color: c.onInk,
      fontSize: 16,
      fontFamily: DisplayFont.semibold,
    },
    actionTextSecondary: { color: c.ink },

    missing: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.background,
    },
    missingText: { color: c.textSecondary, fontSize: 15 },
  }),
);
