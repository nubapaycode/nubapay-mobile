import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BentoGrid } from '@/components/dashboard/bento-grid';
import { CompactBar } from '@/components/dashboard/compact-bar';
import { FADE_EASING, FADE_MS } from '@/components/dashboard/detail-kit';
import { HeroBackdrop } from '@/components/dashboard/hero-backdrop';
import { Lottie } from '@/components/fx/lottie';
import { LastHourCard } from '@/components/dashboard/last-hour-card';
import { PulseHeader } from '@/components/dashboard/pulse-header';
import { PulseHero } from '@/components/dashboard/pulse-hero';
import { hiddenNativeSpinner, PulseRefresh } from '@/components/dashboard/pulse-refresh';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { DashboardSkeleton } from '@/components/dashboard/skeleton';
import { Button } from '@/components/ui';
import { NoAccess } from '@/components/ui/no-access';
import { useEventAccess } from '@/features/access/access';
import { Spacing } from '@/constants/theme';
import {
  activeFilterCount,
  defaultFilters,
  periodLabel,
  type RangePreset,
  SCOPE_LABEL,
  setDashboardFilters,
  useDashboardFilters,
} from '@/features/dashboard/filters';
import { eventPhase } from '@/features/dashboard/format';
import { eventOffer, singleOffer } from '@/features/dashboard/offer';
import { setSelectedEventId, useSelectedEventId } from '@/features/dashboard/selected-event';
import { useEventDashboard, useEvents } from '@/features/dashboard/use-event-dashboard';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { useAuth } from '@/providers/auth-provider';
import { makeStyles, useTheme } from '@/theme';

/** Alto del degradé del hero por debajo del área segura. */
const HERO_HEIGHT = 560;

/**
 * Inicio ("Pulso"): degradé del azul de marca a todo el ancho con la recaudación centrada, la curva
 * de borde a borde y atajos de período; debajo, accesos rápidos, el pulso de la última hora y la
 * grilla bento con un dato por tarjeta. Sigue el tema claro u oscuro del sistema.
 */
export default function HomeScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useFocusStatusBar();

  // El scroll maneja la barra compacta de arriba y el parallax de la cabecera.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  // La cabecera se queda un poco atrás y se desvanece al subir; al estirar hacia abajo, baja con el dedo.
  const headerStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [0, 90], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: y > 0 ? y * 0.35 : 0 },
        { scale: interpolate(y, [0, 90], [1, 0.96], Extrapolation.CLAMP) },
      ],
    };
  });
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

  // Sin permiso de métricas no se piden (el backend respondería 403 en cada actualización).
  const { can } = useEventAccess();
  const canView = can('dashboard');
  const { state, refreshing, refresh } = useEventDashboard(canView ? selectedId : null, filters);
  const data = state.status === 'ready' ? state.data : null;
  // Si se filtró por tipo, ese; si el evento vende una sola cosa, la recaudación se titula con eso.
  const only = data ? singleOffer(eventOffer(data.insights)) : null;
  const scopeLabel =
    filters.scope !== 'all' ? SCOPE_LABEL[filters.scope] : only ? SCOPE_LABEL[only] : null;

  const selectPreset = (preset: RangePreset) =>
    setDashboardFilters({ ...filters, period: { preset } });

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
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
            {...hiddenNativeSpinner}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }>
        <HeroBackdrop
          height={insets.top + HERO_HEIGHT}
          scrollY={scrollY}
          live={(data?.insights.event.phase ?? phase) === 'live'}
        />
        <Animated.View style={headerStyle}>
        <PulseHeader
          event={event}
          phase={data?.insights.event.phase ?? phase}
          userName={user?.name ?? null}
          filterCount={activeFilterCount(filters, base)}
          showFilters={canView}
          onOpenEvents={() => router.push('/switch-event')}
          onOpenProfile={() => router.push('/profile')}
          onOpenFilters={() => router.push('/dashboard-filters')}
        />
        </Animated.View>

        {eventsError ? (
          <ErrorState message={eventsError} />
        ) : !canView ? (
          <NoAccess text="Tu rol en este evento no incluye ver las métricas. Usá el escáner o las otras herramientas que tengas habilitadas." />
        ) : state.status === 'error' ? (
          <ErrorState message={state.error} onRetry={refresh} />
        ) : !data || !event ? (
          <DashboardSkeleton />
        ) : (
          <Animated.View
            key={event.id}
            entering={FadeIn.duration(FADE_MS).easing(FADE_EASING)}
            style={styles.sections}>
            <PulseHero
              summary={data.summary}
              live={data.insights.event.phase === 'live'}
              period={filters.period}
              periodLabel={periodLabel(filters.period)}
              scopeLabel={scopeLabel}
              onSelectPreset={selectPreset}
            />

            <QuickActions />

            {data.insights.event.phase === 'live' ? <LastHourCard live={data.summary.live} activity={data.insights.recent_activity} /> : null}

            <BentoGrid data={data} />

          </Animated.View>
        )}
      </Animated.ScrollView>
      {Platform.OS === 'ios' ? <PulseRefresh scrollY={scrollY} refreshing={refreshing} /> : null}
      {/* Franja fija bajo la barra de estado; cuando el hero se va, muestra evento y recaudación. */}
      <CompactBar
        scrollY={scrollY}
        eventName={event?.name ?? null}
        revenue={data?.summary.total_revenue ?? null}
        live={(data?.insights.event.phase ?? phase) === 'live'}
      />
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.error}>
      <Lottie name="offline" size={112} />
      <Text style={styles.errorTitle}>No pudimos cargar las métricas</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button title="Reintentar" variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: Spacing.three, gap: Spacing.four },
    sections: { gap: Spacing.four },
    error: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
    errorTitle: { color: c.text, fontSize: 16, fontWeight: '600' },
    errorText: { color: c.textSecondary, fontSize: 14, textAlign: 'center' },
  }),
);
