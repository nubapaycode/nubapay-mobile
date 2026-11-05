// Puntos de retiro deshabilitado por ahora: esta hoja solo se abría desde Puntos de retiro (las entradas ahora usan /manage/ticket/[id]), así que queda sin acceso.
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Sheet, useSheet } from '@/components/ui/sheet';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { addPickupPoint, addTicket, type ManageKind } from '@/features/manage/manage';
import { makeStyles, useTheme } from '@/theme';

type SheetKind = Exclude<ManageKind, 'product'>;

const TITLE: Record<SheetKind, string> = {
  ticket: 'Nuevo tipo de entrada',
  pickup: 'Nuevo punto de retiro',
};
const LAYOUT = LinearTransition.duration(240);

/** "12.500" / "12500" → 12500. */
const parseAmount = (s: string) => {
  const n = Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Crear tipo de entrada o punto de retiro (según `kind`), en una hoja.
 * Entrada: nombre, precio y cupo opcional. Punto de retiro: nombre y descripción.
 * (Los productos tienen su propia pantalla, con foto y categoría: /manage/product/new.)
 */
export default function NewItemSheet() {
  return (
    <Sheet>
      <NewItemContent />
    </Sheet>
  );
}

function NewItemContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { dismiss } = useSheet();
  const { kind: raw } = useLocalSearchParams<{ kind: string }>();
  const kind: SheetKind = raw === 'pickup' ? 'pickup' : 'ticket';

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [limited, setLimited] = useState(false);
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const eventId = useSelectedEventId();

  const hasPrice = kind !== 'pickup';
  const amount = parseAmount(price);
  const qty = Number(stock);
  const errors = {
    name: name.trim() ? null : 'Poné un nombre',
    price: !hasPrice || (price.trim() && amount >= 0) ? null : 'Poné un precio (0 si es gratis)',
    stock: !limited || (Number.isInteger(qty) && qty > 0) ? null : 'Poné una cantidad',
  };
  const valid = !errors.name && !errors.price && !errors.stock;

  const submit = async () => {
    setTouched(true);
    if (!valid || !eventId || saving) {
      if (!valid) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    const res =
      kind === 'ticket'
        ? await addTicket(eventId, { name: name.trim(), price: amount, stock: limited ? qty : null })
        : await addPickupPoint(eventId, { name: name.trim(), description: description.trim() || null });
    setSaving(false);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('No se pudo crear', res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dismiss();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive">
      <Text style={styles.title}>{TITLE[kind]}</Text>

      <View style={styles.card}>
        <Field label="Nombre" error={touched ? errors.name : null}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={kind === 'ticket' ? 'Ej: General' : 'Ej: Barra principal'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="sentences"
            style={styles.input}
            accessibilityLabel="Nombre"
          />
        </Field>
        {hasPrice ? (
          <Field label="Precio" error={touched ? errors.price : null} divider>
            <View style={styles.priceRow}>
              <Text style={styles.currency}>$</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={[styles.input, { flex: 1 }]}
                accessibilityLabel="Precio"
              />
            </View>
          </Field>
        ) : (
          <Field label="Descripción (opcional)" error={null} divider>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Ej: Al lado del escenario principal"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              accessibilityLabel="Descripción"
            />
          </Field>
        )}
      </View>

      {kind !== 'pickup' ? (
        <Animated.View layout={LAYOUT} style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.toggleTitle}>Cupo limitado</Text>
              <Text style={styles.toggleText}>
                Se agota al llegar a la cantidad
              </Text>
            </View>
            <Switch
              value={limited}
              onValueChange={(v) => {
                Haptics.selectionAsync();
                setLimited(v);
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          {limited ? (
            <Animated.View entering={FadeIn.duration(240)} exiting={FadeOut.duration(140)}>
              <Field label="Cupo" error={touched ? errors.stock : null} divider>
                <TextInput
                  value={stock}
                  onChangeText={(t) => setStock(t.replace(/[^\d]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  style={styles.input}
                  accessibilityLabel="Cupo"
                />
              </Field>
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}

      <Animated.View layout={LAYOUT}>
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          style={({ pressed }) => [styles.submit, !valid && styles.submitOff, pressed && { opacity: 0.85 }]}>
          {saving ? (
            <ActivityIndicator color={colors.onInk} />
          ) : (
            <Text style={[styles.submitText, !valid && styles.submitTextOff]}>Crear</Text>
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
    content: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },
    title: {
      color: c.text,
      fontSize: 22,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
      paddingHorizontal: 4,
    },
    card: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
    },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },
    field: { paddingTop: 11, paddingBottom: 7, gap: 2 },
    fieldHead: { flexDirection: 'row', justifyContent: 'space-between' },
    fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    fieldError: { color: c.danger, fontSize: 12 },
    input: { color: c.text, fontSize: 16, paddingVertical: 6, paddingHorizontal: 0 },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    currency: { color: c.textMuted, fontSize: 16 },
    section: { gap: 10 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    boxInput: {
      height: 48,
      paddingHorizontal: 14,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      fontSize: 16,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      height: 34,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    chipText: { color: c.ink, fontSize: 14, fontWeight: '600' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    toggleTitle: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    toggleText: { color: c.textMuted, fontSize: 13 },
    submit: {
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.ink,
    },
    submitOff: { backgroundColor: c.raised },
    submitText: { color: c.onInk, fontSize: 16, fontFamily: DisplayFont.semibold },
    submitTextOff: { color: c.textMuted },
  }),
);
