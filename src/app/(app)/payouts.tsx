import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { NavCard } from '@/components/ui/nav-card';
import { Spacing } from '@/constants/theme';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { isReady, METHOD_LABEL, METHODS, useSelectedEventDetail } from '@/features/payouts/payment-methods';
import { makeStyles } from '@/theme';

/** Cobros: acceso a los métodos de pago del catálogo y a la comisión del evento. */
export default function PayoutsScreen() {
  const styles = useStyles();
  const { data: event } = useSelectedEventDetail();
  useFocusStatusBar();

  const ready = event ? METHODS.filter((m) => isReady(m, event)) : [];
  const methodsSubtitle = !event
    ? 'Efectivo, Mercado Pago y Sipago'
    : ready.length
      ? ready.map((m) => METHOD_LABEL[m]).join(', ')
      : 'Ninguno activo todavía';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Animated.Text entering={enter(0)} style={styles.intro}>
        Elegí cómo te pagan tus clientes y revisá la comisión de cada evento.
      </Animated.Text>

      <Animated.View entering={enter(1)} style={styles.list}>
        <NavCard
          icon="card"
          title="Métodos de pago"
          subtitle={methodsSubtitle}
          onPress={() => router.push('/payment-methods')}
        />
        <NavCard
          icon="percent"
          title="Comisión"
          subtitle="Facturado y comisión a pagar por evento"
          onPress={() => router.push('/commission')}
        />
      </Animated.View>

      {event && ready.length === 0 ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Sin métodos de pago activos, tu catálogo no puede recibir pedidos.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
    intro: { color: c.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
    list: { gap: 10 },
    warning: {
      padding: Spacing.three,
      borderRadius: 16,
      backgroundColor: c.dangerMuted,
    },
    warningText: { color: c.danger, fontSize: 13, lineHeight: 18 },
  }),
);
