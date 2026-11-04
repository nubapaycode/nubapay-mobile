import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { FADE_EASING, FADE_MS } from '@/components/dashboard/detail-kit';
import { BentoGrid } from '@/components/dashboard/bento-grid';
import { HeroSection } from '@/components/dashboard/hero-section';
import { DashboardSkeleton } from '@/components/dashboard/skeleton';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  activeFilterCount,
  defaultFilters,
  filtersKey,
  periodLabel,
  SCOPE_LABEL,
  setDashboardFilters,
  useDashboardFilters,
} from '@/features/dashboard/filters';
import { eventPhase } from '@/features/dashboard/format';
import { eventOffer, singleOffer } from '@/features/dashboard/offer';
import { setSelectedEventId, useSelectedEventId } from '@/features/dashboard/selected-event';
import { USE_MOCK, useEventDashboard, useEvents } from '@/features/dashboard/use-event-dashboard';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { useAuth } from '@/providers/auth-provider';
import { light, makeStyles, PaletteScope, useTheme } from '@/theme';

/** Sin selector de período: en curso → ritmo de las últimas horas; si no, la venta de los últimos 30 días. */

/**
 * Home: una tarjeta protagonista que responde "¿cómo va el evento?" (recaudación + tendencia + pulso
 * en vivo) y una grilla bento con un dato por tarjeta. Cada tarjeta abre su detalle.
 */
export default function HomeScreen() {
  // El home es siempre claro: barra de estado oscura mientras está en foco.
  useFocusStatusBar('dark');

  return (
    <PaletteScope palette={light}>
      <HomeContent />
    </PaletteScope>
  );
}

function HomeContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { events, error: eventsError } = useEvents();
  const selectedId = useSelectedEventId();

  // Primer ingreso: el evento en curso o, si no hay, el más reciente.
  useEffect(() => {
    if (selectedId || !events?.length) return;
    const live = events.find((e) => eventPhase(e) === 'live');
    setSelectedEventId((live ?? events[0]).id);
  }, [events, selectedId]);

  const event = events?.find((e) => e.id === selectedId) ?? null;
  const phase = event ? eventPhase(event) : null;

  // Filtros elegidos en la hoja; sin elegir, el default según la fase del evento.
  const chosen = useDashboardFilters();
  const base = useMemo(() => defaultFilters(phase), [phase]);
  const filters = chosen ?? base;

  // Al cambiar de evento los filtros vuelven al default.
  useEffect(() => {
    setDashboardFilters(null);
  }, [selectedId]);

  const { state, refreshing, refresh } = useEventDashboard(selectedId, filters);
  const data = state.status === 'ready' ? state.data : null;
  // Si se filtró por tipo, ese; si el evento vende una sola cosa, la recaudación se titula con eso.
  const only = data ? singleOffer(eventOffer(data.insights)) : null;
  const scopeLabel =
    filters.scope !== 'all' ? SCOPE_LABEL[filters.scope] : only ? SCOPE_LABEL[only] : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          // Abajo está la barra de pestañas (ya reserva el área segura): solo margen propio.
          { paddingTop: insets.top + Spacing.three, paddingBottom: Spacing.five },
        ]}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.textSecondary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }>
        <DashboardHeader
          event={event}
          phase={data?.insights.event.phase ?? phase}
          userName={user?.name ?? null}
          onOpenEvents={() => router.push('/switch-event')}
          onOpenProfile={() => router.push('/profile')}
        />

        {eventsError ? (
          <ErrorState message={eventsError} />
        ) : state.status === 'error' ? (
          <ErrorState message={state.error} onRetry={refresh} />
        ) : !data || !event ? (
          <DashboardSkeleton />
        ) : (
          <Animated.View
            key={event.id}
            entering={FadeIn.duration(FADE_MS).easing(FADE_EASING)}
            style={styles.sections}>
            <HeroSection
              summary={data.summary}
              phase={data.insights.event.phase}
              chartKey={`${event.id}-${filtersKey(filters)}`}
              periodLabel={periodLabel(filters.period)}
              scopeLabel={scopeLabel}
              filterCount={activeFilterCount(filters, base)}
              onOpenFilters={() => router.push('/dashboard-filters')}
            />

            <BentoGrid data={data} />

            {USE_MOCK ? <Text style={styles.mockNote}>Datos de demostración</Text> : null}
          </Animated.View>
        )}
      </ScrollView>
      {/* Franja fija bajo la barra de estado: el contenido no se superpone con la hora/batería al scrollear. */}
      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.error}>
      <Text style={styles.errorTitle}>No pudimos cargar las métricas</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button title="Reintentar" variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#ffffff' },
    statusScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.94)',
    },
    content: { paddingHorizontal: Spacing.three, gap: Spacing.four },
    sections: { gap: Spacing.five - 4 },
    mockNote: { color: c.textMuted, fontSize: 11, textAlign: 'center' },
    error: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
    errorTitle: { color: c.text, fontSize: 16, fontWeight: '600' },
    errorText: { color: c.textSecondary, fontSize: 14, textAlign: 'center' },
  }),
);
