import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Segmented } from '@/components/dashboard/segmented';
import { DateTimeField } from '@/components/events/date-time-field';
import { Sheet, useSheet } from '@/components/ui/sheet';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  type DashboardFilters,
  type DashboardScope,
  defaultFilters,
  isCustom,
  PRESET_LABEL,
  type RangePreset,
  SCOPE_LABEL,
  setDashboardFilters,
  useDashboardFilters,
} from '@/features/dashboard/filters';
import { eventPhase } from '@/features/dashboard/format';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { useEvents } from '@/features/dashboard/use-event-dashboard';
import { makeStyles, useTheme } from '@/theme';

type PeriodChoice = RangePreset | 'custom';

const PERIODS: { value: PeriodChoice; label: string }[] = [
  { value: 'event', label: PRESET_LABEL.event },
  { value: 'today', label: PRESET_LABEL.today },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'custom', label: 'Personalizado' },
];

const SCOPES: { value: DashboardScope; label: string }[] = (
  ['all', 'tickets', 'bar'] as DashboardScope[]
).map((s) => ({ value: s, label: SCOPE_LABEL[s] }));

const HOUR = 3_600_000;

/**
 * Hoja de filtros de la recaudación: período (atajos o rango personalizado con fecha y hora) y
 * qué mirar (todo, solo entradas o solo barra). Los cambios se aplican al tocar "Aplicar".
 */
export default function DashboardFiltersSheet() {
  return (
    <Sheet>
      <FiltersContent />
    </Sheet>
  );
}

function FiltersContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { dismiss } = useSheet();
  const { events } = useEvents();
  const selectedId = useSelectedEventId();
  const event = events?.find((e) => e.id === selectedId) ?? null;
  const base = defaultFilters(event ? eventPhase(event) : null);
  const current = useDashboardFilters() ?? base;

  // Borrador local: no toca el dashboard hasta "Aplicar".
  const [choice, setChoice] = useState<PeriodChoice>(
    isCustom(current.period) ? 'custom' : current.period.preset,
  );
  const [from, setFrom] = useState(() =>
    isCustom(current.period) ? current.period.from : new Date(Date.now() - 24 * HOUR),
  );
  const [to, setTo] = useState(() => (isCustom(current.period) ? current.period.to : new Date()));
  const [scope, setScope] = useState<DashboardScope>(current.scope);

  const rangeError = choice === 'custom' && to <= from ? 'El fin tiene que ser después del inicio' : null;

  const apply = () => {
    if (rangeError) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next: DashboardFilters = {
      period: choice === 'custom' ? { from, to } : { preset: choice },
      scope,
    };
    dismiss(() => setDashboardFilters(next));
  };

  const reset = () => {
    Haptics.selectionAsync();
    setChoice(isCustom(base.period) ? 'custom' : base.period.preset);
    setScope(base.scope);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text style={styles.title}>Filtros</Text>
        <Pressable onPress={reset} hitSlop={10} accessibilityRole="button">
          <Text style={styles.reset}>Restablecer</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Período</Text>
        <View style={styles.chips}>
          {PERIODS.map((p) => {
            const on = p.value === choice;
            return (
              <Pressable
                key={p.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  if (on) return;
                  Haptics.selectionAsync();
                  setChoice(p.value);
                }}
                style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {choice === 'custom' ? (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            layout={LinearTransition.duration(260)}
            style={styles.card}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Desde</Text>
              <DateTimeField value={from} onChange={setFrom} />
            </View>
            <View style={[styles.dateRow, styles.divider]}>
              <Text style={styles.dateLabel}>Hasta</Text>
              <DateTimeField value={to} onChange={setTo} minimumDate={from} />
            </View>
          </Animated.View>
        ) : null}
        {rangeError ? <Text style={styles.error}>{rangeError}</Text> : null}
      </View>

      <Animated.View layout={LinearTransition.duration(260)} style={styles.section}>
        <Text style={styles.sectionTitle}>Mostrar</Text>
        <Segmented options={SCOPES} value={scope} onChange={setScope} />
      </Animated.View>

      <Animated.View layout={LinearTransition.duration(260)}>
        <Pressable
          onPress={apply}
          disabled={!!rangeError}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.apply,
            !!rangeError && { backgroundColor: colors.raised },
            pressed && { opacity: 0.85 },
          ]}>
          <Text style={[styles.applyText, !!rangeError && { color: colors.textMuted }]}>
            Aplicar
          </Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
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
    chipOn: { backgroundColor: c.ink },
    chipText: { color: c.ink, fontSize: 14, fontWeight: '600' },
    chipTextOn: { color: c.onInk },

    card: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
    },
    dateRow: { gap: 8, paddingVertical: 12 },
    dateLabel: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    error: { color: c.danger, fontSize: 13, paddingHorizontal: 4 },

    apply: {
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.ink,
    },
    applyText: { color: c.onInk, fontSize: 16, fontFamily: DisplayFont.semibold },
  }),
);
