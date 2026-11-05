import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/dashboard/icon';
import { Sheet, useSheet } from '@/components/ui/sheet';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { addCategory, useCategories } from '@/features/manage/manage';
import { makeStyles, useTheme } from '@/theme';

const SUGGESTIONS = ['Bebidas', 'Tragos', 'Cervezas', 'Comida', 'Snacks', 'Merch'];

/**
 * Crear una categoría del catálogo, en una hoja que sube desde abajo. Muestra las que ya existen
 * (para no duplicar) y sugerencias tocables cuando el campo está vacío.
 * Se abre desde el "+" del catálogo. (En el formulario de producto se crea desde el selector de
 * categoría: /manage/category-picker.)
 */
export default function NewCategorySheet() {
  return (
    <Sheet>
      <NewCategoryContent />
    </Sheet>
  );
}

function NewCategoryContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { dismiss } = useSheet();
  const eventId = useSelectedEventId();
  const existing = useCategories().data ?? [];

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const duplicate = existing.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  const valid = trimmed.length > 0 && !duplicate;
  const taken = new Set(existing.map((c) => c.name.toLowerCase()));
  const suggestions = SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase()));

  const submit = async () => {
    if (!valid || !eventId || saving) {
      if (!valid) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    const res = await addCategory(eventId, trimmed);
    setSaving(false);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('No se pudo crear la categoría', res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dismiss();
  };

  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Icon name="tag" size={20} color="#000000" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>Nueva categoría</Text>
          <Text style={styles.subtitle}>Agrupa productos en la caja y en el catálogo.</Text>
        </View>
      </View>

      <View style={[styles.card, duplicate && { borderColor: colors.danger }]}>
        <View style={styles.fieldHead}>
          <Text style={styles.fieldLabel}>Nombre</Text>
          {duplicate ? <Text style={styles.fieldError}>Ya existe</Text> : null}
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ej: Tragos"
          placeholderTextColor={colors.textMuted}
          autoFocus
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={submit}
          maxLength={60}
          style={styles.input}
          accessibilityLabel="Nombre de la categoría"
        />
      </View>

      {!trimmed && suggestions.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Sugerencias</Text>
          <View style={styles.chips}>
            {suggestions.map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  Haptics.selectionAsync();
                  setName(s);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Usar ${s}`}
                style={({ pressed }) => [styles.chip, pressed && { backgroundColor: colors.border }]}>
                <Icon name="plus" size={12} color={colors.textSecondary} />
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {existing.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Ya tenés</Text>
          <View style={styles.chips}>
            {existing.map((c) => (
              <View key={c.id} style={[styles.chip, styles.chipStatic, duplicate?.id === c.id && styles.chipDup]}>
                <Text style={[styles.chipText, { color: colors.textSecondary }]}>{c.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid }}
        style={({ pressed }) => [styles.submit, !valid && styles.submitOff, pressed && { opacity: 0.85 }]}>
        {saving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={[styles.submitText, !valid && styles.submitTextOff]}>
            {trimmed && valid ? `Crear “${trimmed}”` : 'Crear categoría'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    content: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
    headerIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#C6FF00',
    },
    title: { color: c.text, fontSize: 22, fontFamily: DisplayFont.bold, letterSpacing: -0.5 },
    subtitle: { color: c.textMuted, fontSize: 13 },
    card: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 2,
    },
    fieldHead: { flexDirection: 'row', justifyContent: 'space-between' },
    fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    fieldError: { color: c.danger, fontSize: 12, fontWeight: '600' },
    input: { color: c.text, fontSize: 18, fontFamily: DisplayFont.semibold, paddingVertical: 6, paddingHorizontal: 0 },

    block: { gap: 10 },
    blockTitle: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      paddingHorizontal: 4,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      height: 34,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    chipStatic: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
    chipDup: { borderColor: c.danger },
    chipText: { color: '#000000', fontSize: 14, fontWeight: '600' },

    submit: {
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
    },
    submitOff: { backgroundColor: c.raised },
    submitText: { color: '#ffffff', fontSize: 16, fontFamily: DisplayFont.semibold },
    submitTextOff: { color: c.textMuted },
  }),
);
