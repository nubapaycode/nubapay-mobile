import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { TabPage } from '@/components/navigation/tab-page';
import { NavCard } from '@/components/ui/nav-card';
import { useRegrets } from '@/features/manage/manage';
import { makeStyles, useTheme } from '@/theme';

const HELP_URL = 'https://www.nubapay.app/ayuda';

/** Más: accesos a todo lo que no está en la barra (eventos, cobros, cuenta y ayuda). */
export default function MoreScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const pendingRegrets = useRegrets().regrets?.filter((r) => r.status === 'pending').length ?? 0;

  return (
    <TabPage title="Más">
      <Animated.View entering={enter(1)} style={styles.group}>
        <Text style={styles.groupTitle}>Eventos</Text>
        <NavCard
          icon="calendar"
          title="Mis eventos"
          subtitle="Ver, crear, editar y eliminar"
          onPress={() => router.push('/events')}
        />
      </Animated.View>

      <Animated.View entering={enter(2)} style={styles.group}>
        <Text style={styles.groupTitle}>Catálogo y ventas</Text>
        <View style={styles.list}>
          <NavCard
            icon="cart"
            title="Catálogo"
            subtitle="Productos, precios y stock"
            onPress={() => router.push('/manage/products')}
          />
          <NavCard
            icon="ticket"
            title="Entradas"
            subtitle="Tipos de entrada, precios y cupos"
            onPress={() => router.push('/manage/tickets')}
          />
          <NavCard
            icon="store"
            title="Puntos de retiro"
            subtitle="Dónde se entregan los pedidos"
            onPress={() => router.push('/manage/pickup-points')}
          />
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
        </View>
      </Animated.View>

      <Animated.View entering={enter(3)} style={styles.group}>
        <Text style={styles.groupTitle}>Cobros</Text>
        <View style={styles.list}>
          <NavCard
            icon="card"
            title="Métodos de pago"
            subtitle="Efectivo, Mercado Pago y Sipago"
            onPress={() => router.push('/payment-methods')}
          />
          <NavCard
            icon="percent"
            title="Comisión"
            subtitle="Facturado y comisión por evento"
            onPress={() => router.push('/commission')}
          />
        </View>
      </Animated.View>

      <Animated.View entering={enter(4)} style={styles.group}>
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
