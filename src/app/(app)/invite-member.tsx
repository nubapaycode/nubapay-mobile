import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { Icon } from "@/components/dashboard/icon";
import { Sheet, useSheet } from "@/components/ui/sheet";
import { DisplayFont, Radius, Spacing } from "@/constants/theme";
import {
  DEFAULT_PERMISSIONS,
  inviteMember,
  isEmail,
  PERMISSION_LABEL,
  PERMISSIONS,
  type PermissionId,
  type Role,
  samePermissions,
} from "@/features/team/team";
import { useRoles, useTeam } from "@/features/team/use-team";
import { makeStyles, useTheme } from "@/theme";

const LAYOUT = LinearTransition.duration(240);

/**
 * Agregar a alguien al equipo (POST /api/events/<id>/staff): nombre, email, rol (plantillas de la
 * web o los que ya usa el equipo; también se puede escribir uno nuevo) y permisos (se precargan con
 * los del rol y se pueden ajustar). El backend crea la cuenta y le manda el acceso por email.
 */
export default function InviteMemberSheet() {
  return (
    <Sheet>
      <InviteContent />
    </Sheet>
  );
}

const toggle = <T,>(list: T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

function InviteContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { dismiss } = useSheet();
  const roles = useRoles();
  const { eventId } = useTeam();
  const roleByName = (n: string): Role | undefined =>
    n.trim()
      ? roles.find((r) => r.name.toLowerCase() === n.trim().toLowerCase())
      : undefined;
  const [sending, setSending] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const roleRef = useRef<TextInputInstance>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] =
    useState<PermissionId[]>(DEFAULT_PERMISSIONS);
  const [touched, setTouched] = useState(false);

  const matched = roleByName(roleName);
  const isNewRole = roleName.trim().length > 0 && !matched;
  const customized =
    !!matched &&
    matched.permissions.length > 0 &&
    !samePermissions(matched.permissions, permissions);
  // Sugerencias: todos los roles si el campo está vacío; si no, los que contienen lo escrito.
  const q = roleName.trim().toLowerCase();
  const suggestions = roles.filter(
    (r) => !q || (r.name.toLowerCase().includes(q) && r !== matched),
  );

  const errors = {
    name: name.trim().length < 2 ? "Poné el nombre" : null,
    email: !isEmail(email) ? "Revisá el email" : null,
    role: roleName.trim().length === 0 ? "Elegí o escribí un rol" : null,
    permissions: permissions.length === 0 ? "Elegí al menos un permiso" : null,
  };
  const valid =
    !errors.name && !errors.email && !errors.role && !errors.permissions;

  const pickRole = (n: string) => {
    Haptics.selectionAsync();
    setRoleName(n);
    const r = roleByName(n);
    if (r?.permissions.length) setPermissions(r.permissions);
  };

  const submit = async () => {
    setTouched(true);
    if (!valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!eventId || sending) return;
    setSending(true);
    const res = await inviteMember(eventId, {
      name,
      email,
      roleName,
      permissions,
    });
    setSending(false);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("No se pudo agregar", res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dismiss(() => {
      if (!res.emailSent) {
        Alert.alert(
          "Agregado al equipo",
          "No pudimos mandarle el email con el acceso. Probá reenviarlo desde su detalle.",
        );
      }
    });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        <Text style={styles.title}>Agregar al equipo</Text>
        <Text style={styles.subtitle}>
          Le creamos la cuenta y le llega el acceso por email.
        </Text>
      </View>

      {/* Datos: nombre y email, cada uno en su card */}
      <View style={styles.cards}>
        <View style={[styles.card, touched && errors.name && styles.cardError]}>
          <Field label="Nombre" error={touched ? errors.name : null}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nombre y apellido"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              submitBehavior="submit"
              style={styles.input}
              accessibilityLabel="Nombre"
            />
          </Field>
        </View>
        <View
          style={[styles.card, touched && errors.email && styles.cardError]}
        >
          <Field label="Email" error={touched ? errors.email : null}>
            <TextInput
              ref={emailRef}
              value={email}
              onChangeText={setEmail}
              placeholder="nombre@mail.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => roleRef.current?.focus()}
              submitBehavior="submit"
              style={styles.input}
              accessibilityLabel="Email"
            />
          </Field>
        </View>
      </View>

      {/* Rol, con sugerencias de los ya creados */}
      <Animated.View layout={LAYOUT} style={styles.section}>
        <Text style={styles.sectionTitle}>Rol</Text>
        <View
          style={[
            styles.roleInput,
            touched && errors.role && styles.inputError,
          ]}
        >
          <TextInput
            ref={roleRef}
            value={roleName}
            onChangeText={(t) => {
              setRoleName(t);
              const r = roleByName(t);
              if (r?.permissions.length) setPermissions(r.permissions);
            }}
            placeholder="Elegí uno o escribí uno nuevo"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="sentences"
            returnKeyType="done"
            style={[styles.input, { flex: 1 }]}
            accessibilityLabel="Rol"
          />
          {roleName ? (
            <Pressable
              onPress={() => setRoleName("")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Borrar rol"
            >
              <Icon name="clearCircle" size={17} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        {suggestions.length ? (
          <View style={styles.chips}>
            {suggestions.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => pickRole(r.name)}
                accessibilityRole="button"
                accessibilityLabel={`Usar rol ${r.name}`}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && { backgroundColor: colors.border },
                ]}
              >
                <Text style={styles.chipText}>{r.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {isNewRole ? (
          <Animated.Text
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(140)}
            style={styles.hint}
          >
            Rol nuevo: “{roleName.trim()}”, con los permisos que elijas.
          </Animated.Text>
        ) : customized ? (
          <Animated.Text
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(140)}
            style={styles.hint}
          >
            Permisos ajustados solo para esta persona.
          </Animated.Text>
        ) : null}
        {touched && errors.role ? (
          <Text style={styles.error}>{errors.role}</Text>
        ) : null}
      </Animated.View>

      {/* Permisos */}
      <Animated.View layout={LAYOUT} style={styles.section}>
        <View style={styles.permHead}>
          <Text style={styles.sectionTitle}>Permisos</Text>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setPermissions(
                permissions.length === PERMISSIONS.length
                  ? []
                  : [...PERMISSIONS],
              );
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.link}>
              {permissions.length === PERMISSIONS.length
                ? "Quitar todos"
                : "Todos"}
            </Text>
          </Pressable>
        </View>
        <View style={styles.cards}>
          {PERMISSIONS.map((p) => {
            const on = permissions.includes(p);
            return (
              <Pressable
                key={p}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPermissions((l) => toggle(l, p));
                }}
                style={[styles.card, styles.permRow, on && styles.permRowOn]}
              >
                <Text style={styles.permText}>{PERMISSION_LABEL[p]}</Text>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? (
                    <Icon name="checkmark" size={11} color={colors.onInk} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        {touched && errors.permissions ? (
          <Text style={styles.error}>{errors.permissions}</Text>
        ) : null}
      </Animated.View>

      <Animated.View layout={LAYOUT}>
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.submit,
            !valid && styles.submitOff,
            pressed && { opacity: 0.85 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.onInk} />
          ) : (
            <Text style={[styles.submitText, !valid && styles.submitTextOff]}>
              Enviar invitación
            </Text>
          )}
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

function Field({
  label,
  error,
  divider,
  children,
}: {
  label: string;
  error: string | null;
  divider?: boolean;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.field, divider && styles.divider]}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flexGrow: 0 },
    content: {
      padding: Spacing.three,
      paddingTop: Spacing.two,
      gap: Spacing.four,
    },
    title: {
      color: c.text,
      fontSize: 22,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
    },
    subtitle: { color: c.textMuted, fontSize: 13, lineHeight: 18 },

    card: {
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
    },
    cards: { gap: 8 },
    cardError: { borderColor: c.danger },
    permRowOn: { borderColor: c.ink },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderSubtle,
    },
    field: { paddingTop: 11, paddingBottom: 7, gap: 2 },
    fieldHead: { flexDirection: "row", justifyContent: "space-between" },
    fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    fieldError: { color: c.danger, fontSize: 12 },
    input: {
      color: c.text,
      fontSize: 16,
      paddingVertical: 6,
      paddingHorizontal: 0,
    },

    section: { gap: 10 },
    sectionTitle: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      paddingHorizontal: 4,
    },
    roleInput: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      height: 48,
      paddingHorizontal: 14,
      borderRadius: Radius.lg,
      borderCurve: "continuous",
      borderWidth: 1,
      borderColor: c.border,
    },
    inputError: { borderColor: c.danger },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      height: 34,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      justifyContent: "center",
      backgroundColor: c.raised,
    },
    chipText: { color: c.ink, fontSize: 14, fontWeight: "600" },
    hint: { color: c.textSecondary, fontSize: 13, paddingHorizontal: 4 },
    error: { color: c.danger, fontSize: 13, paddingHorizontal: 4 },

    permHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    link: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      paddingHorizontal: 4,
    },
    permRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 13,
    },
    permText: { flex: 1, color: c.text, fontSize: 15 },
    check: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkOn: { backgroundColor: c.ink, borderColor: c.ink },

    submit: {
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.ink,
    },
    submitOff: { backgroundColor: c.raised },
    submitText: {
      color: c.onInk,
      fontSize: 16,
      fontFamily: DisplayFont.semibold,
    },
    submitTextOff: { color: c.textMuted },
  }),
);
