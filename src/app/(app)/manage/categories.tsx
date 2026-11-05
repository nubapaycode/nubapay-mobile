import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { enterRow } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { ManageScreen, ManageSummary } from '@/components/manage/manage-ui';
import { DisplayFont, Radius } from '@/constants/theme';
import { formatInt } from '@/features/dashboard/format';
import { removeCategory, renameCategory, useCategories, useProducts } from '@/features/manage/manage';
import type { Category } from '@/lib/api/organizer';
import { makeStyles, useTheme } from '@/theme';
import { toast } from '@/components/ui/toast';

/**
 * Categorías del catálogo: cada una en su card con cuántos productos tiene. Se renombran en el
 * lugar y se eliminan si están vacías (el backend no deja borrar una con productos).
 */
export default function CategoriesScreen() {
  const { data, error, eventId } = useCategories();
  const { products } = useProducts();
  const count = (id: string) => (products ?? []).filter((p) => p.categoryId === id).length;
  const list = data ?? [];

  return (
    <ManageScreen
      summary={data ? <ManageSummary value={formatInt(list.length)} label={list.length === 1 ? 'categoría' : 'categorías'} /> : undefined}
      addLabel="Nueva categoría"
      onAdd={() => router.push('/manage/new-category')}
      loading={!data && !error}
      empty={error ?? (data && list.length === 0 ? 'Todavía no hay categorías. Creá una para ordenar tu catálogo.' : null)}>
      {list.map((c, i) => (
        <CategoryCard key={c.id} category={c} index={i} products={count(c.id)} eventId={eventId} />
      ))}
    </ManageScreen>
  );
}

function CategoryCard({
  category,
  index,
  products,
  eventId,
}: {
  category: Category;
  index: number;
  products: number;
  eventId: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [busy, setBusy] = useState(false);

  const valid = name.trim().length >= 2;
  const save = async () => {
    if (!eventId || !valid) return;
    if (name.trim() === category.name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const res = await renameCategory(eventId, category.id, name);
    setBusy(false);
    if (!res.ok) {
      toast.error('No se pudo renombrar', res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditing(false);
  };

  const remove = () => {
    if (products > 0) {
      Alert.alert(
        'No se puede eliminar',
        `“${category.name}” tiene ${products} producto${products === 1 ? '' : 's'}. Movelos a otra categoría o eliminalos primero.`,
      );
      return;
    }
    Alert.alert('Eliminar categoría', `“${category.name}” se borra del catálogo.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (!eventId) return;
          const res = await removeCategory(eventId, category.id);
          if (!res.ok) {
            toast.error('No se pudo eliminar', res.error);
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  return (
    <Animated.View
      entering={enterRow(index)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.duration(240)}
      style={styles.card}>
      {editing ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.editRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={save}
            maxLength={60}
            style={styles.input}
            accessibilityLabel="Nombre de la categoría"
          />
          <Pressable
            onPress={() => {
              setName(category.name);
              setEditing(false);
            }}
            hitSlop={8}
            accessibilityRole="button">
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={!valid || busy}
            accessibilityRole="button"
            style={[styles.saveBtn, (!valid || busy) && { opacity: 0.4 }]}>
            {busy ? <ActivityIndicator color={colors.onInk} size="small" /> : <Text style={styles.saveText}>Guardar</Text>}
          </Pressable>
        </Animated.View>
      ) : (
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name} numberOfLines={1}>
              {category.name}
            </Text>
            <Text style={styles.meta}>
              {products === 0 ? 'Sin productos' : `${formatInt(products)} producto${products === 1 ? '' : 's'}`}
            </Text>
          </View>
          <RoundIcon
            icon="pencil"
            label={`Renombrar ${category.name}`}
            onPress={() => {
              Haptics.selectionAsync();
              setEditing(true);
            }}
          />
          <RoundIcon icon="trash" label={`Eliminar ${category.name}`} color={colors.danger} onPress={remove} />
        </View>
      )}
    </Animated.View>
  );
}

function RoundIcon({
  icon,
  label,
  color,
  onPress,
}: {
  icon: 'pencil' | 'trash';
  label: string;
  color?: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tint = color ?? colors.ink;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={14} color={tint} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    name: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    meta: { color: c.textMuted, fontSize: 13 },
    round: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    editRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    input: { flex: 1, color: c.text, fontSize: 16, paddingVertical: 4 },
    cancel: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    saveBtn: {
      height: 34,
      paddingHorizontal: 14,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.ink,
    },
    saveText: { color: c.onInk, fontSize: 14, fontWeight: '600' },
  }),
);
