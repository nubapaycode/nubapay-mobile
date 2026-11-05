import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActivityDetail } from '@/components/dashboard/activity-detail';
import { BarDetail } from '@/components/dashboard/bar-detail';
import { SalesDetail } from '@/components/dashboard/sales-detail';
import { TicketsDetail } from '@/components/dashboard/tickets-detail';
import { Button } from '@/components/ui';
import { DisplayFont, Spacing } from '@/constants/theme';
import { useDashboardSnapshot } from '@/features/dashboard/dashboard-store';
import { periodNote } from '@/features/dashboard/filters';
import { eventOffer } from '@/features/dashboard/offer';
import type { DashboardData } from '@/features/dashboard/types';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';

const TITLES = {
  tickets: 'Entradas',
  bar: 'Barra',
  sales: 'Cobros',
  activity: 'Actividad',
} as const;
type Section = keyof typeof TITLES;

/**
 * Detalle de una sección del home. Usa los datos que ya cargó el home (incluidas las actualizaciones
 * en vivo). Sobre el fondo de pantalla, header incluido.
 */
export default function DetailScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const key = (section in TITLES ? section : 'activity') as Section;
  useFocusStatusBar();
  const { colors } = useTheme();

  return (
    <>
      <Stack.Screen
        options={{
          title: TITLES[key],
          // Título fijo en la barra desde que se entra (el título grande de iOS no aparecía hasta scrollear).
          headerLargeTitle: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: DisplayFont.semibold, color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <DetailBody section={key} />
    </>
  );
}

function DetailBody({ section }: { section: Section }) {
  const styles = useStyles();
  const snapshot = useDashboardSnapshot();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      {snapshot && !offered(section, snapshot.data) ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Este evento no vende {section === 'tickets' ? 'entradas' : 'barra'}.
          </Text>
          <Button title="Volver al inicio" variant="ghost" onPress={() => router.back()} />
        </View>
      ) : snapshot ? (
        <Content section={section} data={snapshot.data} rangeNote={periodNote(snapshot.filters.period)} />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No hay datos cargados.</Text>
          <Button title="Volver al inicio" variant="ghost" onPress={() => router.back()} />
        </View>
      )}
    </ScrollView>
  );
}

/** Entradas y Barra solo existen si el evento las vende (el home tampoco muestra su tarjeta). */
function offered(section: Section, data: DashboardData): boolean {
  const offer = eventOffer(data.insights);
  if (section === 'tickets') return offer.tickets;
  if (section === 'bar') return offer.bar;
  return true;
}

function Content({
  section,
  data,
  rangeNote,
}: {
  section: Section;
  data: DashboardData;
  rangeNote: string;
}) {
  switch (section) {
    case 'tickets':
      return <TicketsDetail insights={data.insights} />;
    case 'bar':
      return <BarDetail data={data} rangeNote={rangeNote} />;
    case 'sales':
      return <SalesDetail data={data} rangeNote={rangeNote} />;
    case 'activity':
      return <ActivityDetail data={data} />;
  }
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, paddingBottom: Spacing.six },
    empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
    emptyText: { color: c.textSecondary, fontSize: 15 },
  }),
);
