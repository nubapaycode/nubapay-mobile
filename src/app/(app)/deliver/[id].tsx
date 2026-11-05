import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeliverPanel } from '@/components/operations/deliver-panel';
import { NoAccess } from '@/components/ui/no-access';
import { Spacing } from '@/constants/theme';
import { useEventAccess } from '@/features/access/access';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { type Order, previewScan } from '@/lib/api/organizer';
import { invalidate, setQueryData, useQuery } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';

/**
 * Entregar sin escanear (desde el detalle del pedido): valida el pedido igual que el escáner y
 * registra lo entregado.
 */
export default function DeliverScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { eventId, can } = useEventAccess();
  const key = eventId && id ? `scan:${eventId}:${id}` : null;
  const q = useQuery<Order>(key, () => previewScan(eventId!, id));
  useFocusStatusBar();

  if (!can('scanner')) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <NoAccess text="Tu rol en este evento no incluye entregar pedidos." />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      {q.data && eventId ? (
        <DeliverPanel
          eventId={eventId}
          order={q.data}
          canConfirmCash
          onDone={(order) => {
            setQueryData<Order>(`order:${eventId}:${order.id}`, () => order);
            invalidate(`orders:${eventId}`);
            invalidate('dashboard');
            invalidate(`scan:${eventId}`);
            router.back();
          }}
          onCancel={() => router.back()}
        />
      ) : q.error ? (
        <Text style={styles.error}>{q.error}</Text>
      ) : (
        <ActivityIndicator color={colors.textMuted} style={{ marginTop: 40 }} />
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, paddingBottom: Spacing.six },
    error: { color: c.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 40 },
  }),
);
