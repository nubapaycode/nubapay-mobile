import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Breakdown, DetailHero, enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { ProgressBar } from '@/components/dashboard/progress-bar';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  eventPhase,
  formatEventDate,
  formatInt,
  formatMoney,
  formatPercent,
  PAYMENT_LABEL,
  PHASE_LABEL,
} from '@/features/dashboard/format';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import type { PaymentKey } from '@/features/dashboard/types';
import { useEvents } from '@/features/dashboard/use-event-dashboard';
import { settlementDue, useSelectedEventDetail } from '@/features/payouts/payment-methods';
import { listApprovedPayments, type Payment } from '@/lib/api/organizer';
import { useQuery } from '@/lib/query';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';

/**
 * Comisión: total facturado del evento actual (pagos aprobados, sin el costo de servicio) con su
 * reparto por medio de pago, y lo que corresponde pagarle a Nubapay. Misma regla que el panel web:
 * 1 % sobre lo facturado, o el costo de servicio si el evento lo cobra al comprador.
 * El evento se cambia con la misma hoja del home.
 */
export default function CommissionScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { events } = useEvents();
  const selectedId = useSelectedEventId();
  const event = events?.find((e) => e.id === selectedId) ?? null;
  const payments = useQuery<Payment[]>(selectedId ? `payments:${selectedId}` : null, () =>
    listApprovedPayments(selectedId!),
  );
  const { data: detail } = useSelectedEventDetail();
  useFocusStatusBar();

  const list = payments.data;
  const feeMode = !!detail?.service_fee_enabled;
  const ready = !!list && !!detail;
  // Facturado = lo que le corresponde al organizador (sin el costo de servicio del comprador).
  const billed = (list ?? []).reduce((a, p) => a + Math.max(0, p.amount - (p.service_fee ?? 0)), 0);
  const due = (list ?? []).reduce((a, p) => a + settlementDue(p.amount, p.service_fee ?? 0, feeMode), 0);
  const net = feeMode ? billed : billed - due;
  const byChannel = new Map<string, number>();
  (list ?? []).forEach((p) => {
    const k = p.channel ?? 'mp';
    byChannel.set(k, (byChannel.get(k) ?? 0) + Math.max(0, p.amount - (p.service_fee ?? 0)));
  });
  const methods = [...byChannel.entries()].map(([key, revenue]) => ({ key, revenue })).sort((a, b) => b.revenue - a.revenue);
  const channelLabel = (k: string) => PAYMENT_LABEL[k as PaymentKey] ?? k;
  const ramp = colors.chart.ramp;
  const dueLabel = feeMode ? 'Costo de servicio a pagar' : 'Comisión a pagar';
  const dueHint = feeMode ? '5 % en entradas y 2 % en productos' : '1 % sobre lo facturado';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      {/* Selector de evento: abre la misma hoja que el home */}
      <Animated.View entering={enter(0)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Evento: ${event?.name ?? 'sin seleccionar'}. Cambiar evento`}
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/switch-event');
          }}
          style={({ pressed }) => [styles.eventCard, pressed && { backgroundColor: colors.canvas }]}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.eventLabel}>Evento</Text>
            <Text style={styles.eventName} numberOfLines={1}>
              {event?.name ?? 'Elegí un evento'}
            </Text>
            {event ? (
              <Text style={styles.eventMeta}>
                {PHASE_LABEL[eventPhase(event)]} · {formatEventDate(event.starts_at)}
              </Text>
            ) : null}
          </View>
          <View style={styles.switchBtn}>
            <Text style={styles.switchText}>Cambiar</Text>
            <Icon name="chevronDown" size={11} color={colors.ink} />
          </View>
        </Pressable>
      </Animated.View>

      {!ready ? (
        <View style={styles.loading}>
          {payments.error ? (
            <Text style={styles.note}>{payments.error}</Text>
          ) : (
            <ActivityIndicator color={colors.textMuted} />
          )}
        </View>
      ) : (
        <View key={selectedId ?? 'none'} style={{ gap: 32 }}>
          <DetailHero
            caption="Total facturado"
            value={billed}
            format={formatMoney}
            meta={`${formatInt(list.length)} pagos aprobados · todo el evento`}>
            {billed > 0 ? (
              <>
                <ProgressBar
                  height={10}
                  total={billed}
                  delay={160}
                  segments={methods.map((m, i) => ({ value: m.revenue, color: ramp[i % 3] }))}
                />
                <Breakdown
                  items={methods.map((m, i) => ({
                    color: ramp[i % 3],
                    label: `${channelLabel(m.key)} · ${formatPercent(m.revenue / billed)}`,
                    value: m.revenue,
                    format: formatMoney,
                  }))}
                />
              </>
            ) : null}
          </DetailHero>

          {/* Liquidación: facturado − comisión = neto; lo destacado es la comisión a pagar */}
          <Animated.View entering={enter(2)} style={styles.settle}>
            <Row label="Facturado" value={formatMoney(billed)} />
            {feeMode ? (
              <Row label="Costo de servicio cobrado" value={formatMoney(due)} divider />
            ) : (
              <Row label="Comisión Nubapay (1 %)" value={`− ${formatMoney(due)}`} divider />
            )}
            <Row label="Neto para vos" value={formatMoney(net)} divider />
            <View style={styles.due}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.dueLabel}>{dueLabel}</Text>
                <Text style={styles.dueHint}>{dueHint}</Text>
              </View>
              <Text style={styles.dueValue}>{formatMoney(due)}</Text>
            </View>
          </Animated.View>

          <Text style={styles.note}>
            {feeMode
              ? 'Este evento cobra costo de servicio al comprador: eso es lo que corresponde a Nubapay.'
              : 'La comisión se calcula sobre los pagos aprobados del evento, con cualquier medio de pago.'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: 28 },

    eventCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
    },
    eventLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    eventName: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold, letterSpacing: -0.3 },
    eventMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    switchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      height: 32,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    switchText: { color: c.ink, fontSize: 13, fontFamily: DisplayFont.semibold },

    loading: { paddingVertical: Spacing.six, alignItems: 'center' },

    settle: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 13,
    },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },
    rowLabel: { color: c.textSecondary, fontSize: 14 },
    rowValue: { color: c.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
    due: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: -16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: c.canvas,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    dueLabel: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    dueHint: { color: c.textMuted, fontSize: 12 },
    dueValue: {
      color: c.text,
      fontSize: 22,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    note: { color: c.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8 },
  }),
);
