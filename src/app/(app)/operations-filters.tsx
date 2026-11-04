import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Sheet, useSheet } from '@/components/ui/sheet';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  CHANNEL_FILTER_LABEL,
  type ChannelFilter,
  DEFAULT_OPERATION_FILTERS,
  PAYMENT_FILTER_LABEL,
  type PaymentStatusFilter,
  type RetrievalFilter,
  setOperationFilters,
  STATUS_FILTER_LABEL,
  useOperationFilters,
} from '@/features/operations/operations';
import { makeStyles } from '@/theme';

const keys = <T extends string>(o: Record<T, string>) => Object.keys(o) as T[];

/** Hoja de filtros de Operaciones: retiro, pago y medio de pago. Se aplica con "Aplicar". */
export default function OperationsFiltersSheet() {
  return (
    <Sheet>
      <FiltersContent />
    </Sheet>
  );
}

function FiltersContent() {
  const styles = useStyles();
  const { dismiss } = useSheet();
  const current = useOperationFilters();
  const [status, setStatus] = useState<RetrievalFilter>(current.status);
  const [payment, setPayment] = useState<PaymentStatusFilter>(current.payment);
  const [channel, setChannel] = useState<ChannelFilter>(current.channel);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text style={styles.title}>Filtros</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setStatus(DEFAULT_OPERATION_FILTERS.status);
            setPayment(DEFAULT_OPERATION_FILTERS.payment);
            setChannel(DEFAULT_OPERATION_FILTERS.channel);
          }}
          hitSlop={10}
          accessibilityRole="button">
          <Text style={styles.reset}>Restablecer</Text>
        </Pressable>
      </View>

      <ChipGroup title="Retiro" labels={STATUS_FILTER_LABEL} options={keys(STATUS_FILTER_LABEL)} value={status} onChange={setStatus} />
      <ChipGroup title="Pago" labels={PAYMENT_FILTER_LABEL} options={keys(PAYMENT_FILTER_LABEL)} value={payment} onChange={setPayment} />
      <ChipGroup title="Medio de pago" labels={CHANNEL_FILTER_LABEL} options={keys(CHANNEL_FILTER_LABEL)} value={channel} onChange={setChannel} />

      <Pressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          dismiss(() => setOperationFilters({ status, payment, channel }));
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.apply, pressed && { opacity: 0.85 }]}>
        <Text style={styles.applyText}>Aplicar</Text>
      </Pressable>
    </ScrollView>
  );
}

function ChipGroup<T extends string>({
  title,
  labels,
  options,
  value,
  onChange,
}: {
  title: string;
  labels: Record<T, string>;
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = o === value;
          return (
            <Pressable
              key={o}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (on) return;
                Haptics.selectionAsync();
                onChange(o);
              }}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{labels[o]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flexGrow: 0 },
    content: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 },
    title: { color: c.text, fontSize: 22, fontFamily: DisplayFont.bold, letterSpacing: -0.5 },
    reset: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    section: { gap: 10 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { height: 38, paddingHorizontal: 14, borderRadius: Radius.pill, justifyContent: 'center', backgroundColor: c.raised },
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
