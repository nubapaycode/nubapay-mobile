import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Sheet, useSheet } from '@/components/ui/sheet';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  type CatalogFilters,
  DEFAULT_CATALOG_FILTERS,
  setCatalogFilters,
  useCatalogFilters,
  useCategories,
} from '@/features/manage/manage';
import { makeStyles } from '@/theme';

const STATUS: { value: CatalogFilters['status']; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'A la venta' },
  { value: 'paused', label: 'Pausados' },
];

/** Hoja de filtros del catálogo: categorías (varias) y estado. Se aplica con "Aplicar". */
export default function CatalogFiltersSheet() {
  return (
    <Sheet>
      <FiltersContent />
    </Sheet>
  );
}

function FiltersContent() {
  const styles = useStyles();
  const { dismiss } = useSheet();
  const current = useCatalogFilters();
  const categories = (useCategories().data ?? []).map((c) => c.name);
  const [selected, setSelected] = useState<string[]>(current.categories);
  const [status, setStatus] = useState(current.status);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text style={styles.title}>Filtros</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setSelected(DEFAULT_CATALOG_FILTERS.categories);
            setStatus(DEFAULT_CATALOG_FILTERS.status);
          }}
          hitSlop={10}
          accessibilityRole="button">
          <Text style={styles.reset}>Restablecer</Text>
        </Pressable>
      </View>

      {categories.length ? (
        <Group title="Categorías">
          {categories.map((c) => {
            const on = selected.includes(c);
            return (
              <Chip
                key={c}
                label={c}
                on={on}
                multi
                onPress={() => setSelected((l) => (on ? l.filter((x) => x !== c) : [...l, c]))}
              />
            );
          })}
        </Group>
      ) : null}

      <Group title="Estado">
        {STATUS.map((o) => (
          <Chip key={o.value} label={o.label} on={status === o.value} onPress={() => setStatus(o.value)} />
        ))}
      </Group>

      <Pressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          dismiss(() => setCatalogFilters({ categories: selected, status }));
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.apply, pressed && { opacity: 0.85 }]}>
        <Text style={styles.applyText}>Aplicar</Text>
      </Pressable>
    </ScrollView>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function Chip({
  label,
  on,
  multi,
  onPress,
}: {
  label: string;
  on: boolean;
  multi?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: on } : { selected: on }}
      onPress={() => {
        if (on && !multi) return;
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flexGrow: 0 },
    content: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },
    head: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    title: { color: c.text, fontSize: 22, fontFamily: DisplayFont.bold, letterSpacing: -0.5 },
    reset: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    section: { gap: 10 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      height: 38,
      paddingHorizontal: 14,
      borderRadius: Radius.pill,
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    chipOn: { backgroundColor: '#000000' },
    chipText: { color: '#000000', fontSize: 14, fontWeight: '600' },
    chipTextOn: { color: '#ffffff' },
    apply: {
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
    },
    applyText: { color: '#ffffff', fontSize: 16, fontFamily: DisplayFont.semibold },
  }),
);
