import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { EventSetupCard } from '@/components/dashboard/setup-checklist';
import { TabPage } from '@/components/navigation/tab-page';
import { LogoutButton } from '@/components/ui/logout-button';
import { NavCard } from '@/components/ui/nav-card';
import { useEventAccess } from '@/features/access/access';
import { useRegrets } from '@/features/manage/manage';
import { storeBlocker, useEventSetup, usePublicStore } from '@/features/setup/event-setup';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { makeStyles, useTheme } from '@/theme';

const HELP_URL = 'https://www.nubapay.app/ayuda';

/**
 * Con la tienda cerrada, en lugar de esconder el link se avisa qué falta (portada o catálogo) y se
 * lleva a resolverlo. Solo para quien puede editar el evento (pide el catálogo).
 */
function StoreBlockedCard() {
  const setup = useEventSetup();
  const { eventId } = useEventAccess();
  if (!setup.ready || !eventId) return null;
  const blocker = storeBlocker(setup.steps);
  return (
    <NavCard
      icon="store"
      title="Tu tienda todavía no abre"
      subtitle={blocker ? `${blocker.label} para abrirla` : 'Revisá que el evento esté activo'}
      onPress={() =>
        router.push(blocker?.href ?? { pathname: '/edit-event/[id]', params: { id: eventId } })
      }
    />
  );
}

/** Más: accesos a todo lo que no está en la barra (eventos, cobros, cuenta y ayuda). */
export default function MoreScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { can, isStaff, eventId } = useEventAccess();
  const canOrders = can('orders');
  const regrets = useRegrets(canOrders);
  const pendingRegrets = regrets.regrets?.filter((r) => r.status === 'pending').length ?? 0;
  const canProducts = can('products');
  const showSales = canProducts || canOrders;
  const canMethods = !isStaff || can('storefront');
  const showPayouts = canMethods || can('payments');
  const store = usePublicStore();
  const { catalogUrl, ticketsUrl, refresh: refreshLinks } = store;
  const canSetup = !isStaff || (canProducts && can('storefront'));
  const showBlocked = !store.open && store.loaded && !!store.slug && canSetup;
  const pull = usePullRefresh(() => Promise.all([refreshLinks(), regrets.refresh()]));
  const openPublic = (url: string) =>
    WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: colors.primary,
    });

  return (
    <TabPage title="Más" refreshing={pull.refreshing} onRefresh={pull.onRefresh}>
      {/* Qué le falta al evento para vender: se va al completarlo o saltearlo (ver el punto azul). */}
      {canSetup && eventId ? <EventSetupCard eventId={eventId} /> : null}

      <Animated.View entering={enter(1)} style={styles.group}>
        <Text style={styles.groupTitle}>Eventos</Text>
        <NavCard
          icon="calendar"
          title="Mis eventos"
          subtitle="Ver, crear, editar y eliminar"
          onPress={() => router.push('/events')}
        />
      </Animated.View>

      {catalogUrl || ticketsUrl || showBlocked ? (
        <Animated.View entering={enter(2)} style={styles.group}>
          <Text style={styles.groupTitle}>Tu tienda</Text>
          <View style={styles.list}>
            {showBlocked ? <StoreBlockedCard /> : null}
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
