import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { TabPage } from '@/components/navigation/tab-page';
import { LogoutButton } from '@/components/ui/logout-button';
import { NavCard } from '@/components/ui/nav-card';
import { useEventAccess } from '@/features/access/access';
import { useEvents } from '@/features/dashboard/use-event-dashboard';
import { useRegrets } from '@/features/manage/manage';
import { apiFetch } from '@/lib/api';
import { apiUrl, publicCatalogUrl, publicTicketsUrl } from '@/lib/api/url';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { useQuery } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';

const HELP_URL = 'https://www.nubapay.app/ayuda';

type PublicStorefront = { products: unknown[]; combos: unknown[]; tickets: unknown[] };

/**
 * Links a la tienda pública del evento seleccionado: el catálogo solo si tiene productos o combos
 * activos y la venta de entradas solo si tiene entradas activas (si no, la página estaría vacía).
 * Se consulta la tienda pública (lo mismo que ve un comprador, sin sesión), así lo ve todo el
 * equipo aunque no tenga permiso de catálogo. Se refresca al volver a la pestaña.
 */
function usePublicStoreLinks() {
  const { eventId } = useEventAccess();
  const { events } = useEvents();
  const slug = events?.find((e) => e.id === eventId)?.slug?.trim() || null;
  const { data, refresh } = useQuery<PublicStorefront>(slug ? `storefront:${slug}` : null, () =>
    apiFetch<PublicStorefront>(apiUrl(`/catalog/storefront/${encodeURIComponent(slug!)}`), {
      token: null,
    }),
  );
  useFocusEffect(
    useCallback(() => {
      if (slug) refresh();
    }, [slug, refresh]),
  );
  if (!slug || !data) return { catalogUrl: null, ticketsUrl: null, refresh };
  const hasProducts = (data.products?.length ?? 0) + (data.combos?.length ?? 0) > 0;
  return {
    catalogUrl: hasProducts ? publicCatalogUrl(slug) : null,
    ticketsUrl: data.tickets?.length ? publicTicketsUrl(slug) : null,
    refresh,
  };
}

/** Más: accesos a todo lo que no está en la barra (eventos, cobros, cuenta y ayuda). */
export default function MoreScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { can, isStaff } = useEventAccess();
  const canOrders = can('orders');
  const regrets = useRegrets(canOrders);
  const pendingRegrets = regrets.regrets?.filter((r) => r.status === 'pending').length ?? 0;
  const canProducts = can('products');
  const showSales = canProducts || canOrders;
  const canMethods = !isStaff || can('storefront');
  const showPayouts = canMethods || can('payments');
  const { catalogUrl, ticketsUrl, refresh: refreshLinks } = usePublicStoreLinks();
  const pull = usePullRefresh(() => Promise.all([refreshLinks(), regrets.refresh()]));
  const openPublic = (url: string) =>
    WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: colors.primary,
    });

  return (
    <TabPage title="Más" refreshing={pull.refreshing} onRefresh={pull.onRefresh}>
      <Animated.View entering={enter(1)} style={styles.group}>
        <Text style={styles.groupTitle}>Eventos</Text>
        <NavCard
          icon="calendar"
          title="Mis eventos"
          subtitle="Ver, crear, editar y eliminar"
          onPress={() => router.push('/events')}
        />
      </Animated.View>

      {catalogUrl || ticketsUrl ? (
        <Animated.View entering={enter(2)} style={styles.group}>
          <Text style={styles.groupTitle}>Tu tienda</Text>
          <View style={styles.list}>
            {catalogUrl ? (
              <NavCard
                icon="store"
                title="Ver catálogo"
                subtitle="La tienda de productos que ven tus compradores"
                external
                onPress={() => openPublic(catalogUrl)}
              />
            ) : null}
            {ticketsUrl ? (
              <NavCard
                icon="ticket"
                title="Ver entradas"
                subtitle="La página de venta de entradas"
                external
                onPress={() => openPublic(ticketsUrl)}
              />
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {showSales ? (
      <Animated.View entering={enter(3)} style={styles.group}>
        <Text style={styles.groupTitle}>Catálogo y ventas</Text>
        <View style={styles.list}>
          {canProducts ? (
            <>
              <NavCard
                icon="cart"
                title="Catálogo"
                subtitle="Productos, combos y precios"
                onPress={() => router.push('/manage/products')}
              />
              <NavCard
                icon="ticket"
                title="Entradas"
                subtitle="Tipos de entrada, precios y cupos"
                onPress={() => router.push('/manage/tickets')}
              />
              <NavCard
                icon="blocks"
                title="Bloques de la tienda"
                subtitle="Secciones destacadas arriba del catálogo"
                onPress={() => router.push('/manage/blocks')}
              />
            </>
          ) : null}
          {/* Puntos de retiro deshabilitado por ahora.
          <NavCard
            icon="store"
            title="Puntos de retiro"
            subtitle="Dónde se entregan los pedidos"
            onPress={() => router.push('/manage/pickup-points')}
          />
          */}
          {canOrders ? (
          <NavCard
            icon="receipt"
            title="Arrepentimientos"
            subtitle="Solicitudes de devolución de compra"
            right={
              pendingRegrets > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingRegrets}</Text>
                </View>
              ) : undefined
            }
            onPress={() => router.push('/manage/regrets')}
          />
          ) : null}
        </View>
      </Animated.View>
      ) : null}

      {showPayouts ? (
      <Animated.View entering={enter(4)} style={styles.group}>
        <Text style={styles.groupTitle}>Cobros</Text>
        <View style={styles.list}>
          {canMethods ? (
            <NavCard
              icon="card"
              title="Métodos de pago"
              subtitle="Efectivo, Mercado Pago y Sipago"
              onPress={() => router.push('/payment-methods')}
            />
          ) : null}
          {!isStaff || can('payments') ? (
          <NavCard
            icon="percent"
            title="Comisión"
            subtitle="Facturado y comisión por evento"
            onPress={() => router.push('/commission')}
          />
          ) : null}
        </View>
      </Animated.View>
      ) : null}

      <Animated.View entering={enter(5)} style={styles.group}>
        <Text style={styles.groupTitle}>Cuenta</Text>
        <View style={styles.list}>
          <NavCard
            icon="people"
            title="Perfil"
            subtitle="Tu cuenta y cerrar sesión"
            onPress={() => router.push('/profile')}
          />
          <NavCard
            icon="help"
            title="Ayuda"
            subtitle="Preguntas frecuentes y soporte"
            external
            onPress={() =>
              WebBrowser.openBrowserAsync(HELP_URL, {
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                controlsColor: colors.primary,
              })
            }
          />
        </View>
      </Animated.View>

      <Animated.View entering={enter(6)}>
        <LogoutButton />
      </Animated.View>
    </TabPage>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    group: { gap: 10 },
    groupTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    list: { gap: 10 },
    badge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brandMuted,
    },
    badgeText: { color: c.brandText, fontSize: 12, fontWeight: '700' },
  }),
);
