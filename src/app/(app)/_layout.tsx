import * as QuickActions from 'expo-quick-actions';
import { type RouterAction, useQuickActionRouting } from 'expo-quick-actions/router';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { DetailHeader } from '@/components/navigation/detail-header';
import { DisplayFont } from '@/constants/theme';
import {
  peekPendingBiometricOffer,
  setPendingBiometricOffer,
  shouldOfferBiometrics,
} from '@/lib/biometrics';
import { enableBackgroundPulse } from '@/features/live/background';
import { flushStartToken } from '@/features/live/live-pulse';
import { registerPush, usePushRouting } from '@/lib/push';
import { dark, useTheme } from '@/theme';

/** Recién ingresado con contraseña: ofrece activar Face ID / huella (una vez que se ve el inicio). */
function useBiometricOffer() {
  useEffect(() => {
    const offer = peekPendingBiometricOffer();
    if (!offer) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const show = await shouldOfferBiometrics(offer.email);
      if (cancelled) return;
      if (show) router.push('/enable-biometrics');
      else setPendingBiometricOffer(null);
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);
}

/**
 * Mantener apretado el ícono de la app: atajos directos. Escanear va primero (es lo que más se usa
 * en la puerta). Sin el módulo nativo `setItems` no hace nada.
 */
function useHomeShortcuts() {
  useQuickActionRouting();
  useEffect(() => {
    QuickActions.setItems<RouterAction>([
      { id: 'scan', title: 'Escanear QR', icon: 'symbol:qrcode.viewfinder', params: { href: '/scan' } },
      {
        id: 'operations',
        title: 'Operaciones',
        icon: 'symbol:arrow.left.arrow.right',
        params: { href: '/operations' },
      },
      { id: 'team', title: 'Equipo', icon: 'symbol:person.2', params: { href: '/team' } },
    ]).catch(() => {});
  }, []);
}

/** Push: se pide permiso un rato después de entrar (no apenas abre) y los toques navegan. */
function usePush() {
  usePushRouting();
  useEffect(() => {
    const t = setTimeout(async () => {
      await registerPush();
      // Con el permiso y la sesión listos: refresco en segundo plano y push-to-start.
      await enableBackgroundPulse();
      flushStartToken();
    }, 2500);
    return () => clearTimeout(t);
  }, []);
}

export default function AppLayout() {
  const { colors } = useTheme();
  useBiometricOffer();
  useHomeShortcuts();
  usePush();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: DisplayFont.semibold, color: colors.text },
        contentStyle: { backgroundColor: colors.canvas },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Inicio' }} />
      <Stack.Screen
        name="enable-biometrics"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          gestureEnabled: false,
          contentStyle: { backgroundColor: dark.background },
        }}
      />
      <Stack.Screen
        name="scan"
        options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="detail/[section]"
        options={{
          // Se llega expandiendo la tarjeta del inicio: el detalle aparece con fundido debajo.
          animation: 'fade',
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
          headerLargeTitleStyle: { fontFamily: DisplayFont.bold, color: colors.text },
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Stack.Screen
        name="events"
        options={{
          title: 'Eventos',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="edit-event/[id]"
        options={{
          title: 'Editar evento',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="payouts"
        options={{
          title: 'Cobros',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="payment-methods"
        options={{
          title: 'Métodos de pago',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="commission"
        options={{
          title: 'Comisión',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="operation/[key]"
        options={{
          title: 'Operación',
          // Se abre con zoom desde su card: header propio, sin la barra nativa (ver DetailHeader).
          header: (props) => <DetailHeader {...props} />,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="deliver/[id]"
        options={{
          title: 'Entregar',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="new-event"
        options={{
          title: 'Nuevo evento',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="manage/blocks"
        options={{
          title: 'Bloques de la tienda',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="manage/block/[id]"
        options={{
          title: 'Bloque',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="manage/categories"
        options={{
          title: 'Categorías',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="manage/reorder"
        options={{
          title: 'Ordenar',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="member/[id]"
        options={{
          title: 'Equipo',
          // Se abre con zoom desde su card: header propio, sin la barra nativa (ver DetailHeader).
          header: (props) => <DetailHeader {...props} />,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="manage/products"
        options={{
          title: 'Catálogo',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="manage/tickets"
        options={{
          title: 'Entradas',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      {/* Puntos de retiro deshabilitado por ahora.
      <Stack.Screen
        name="manage/pickup-points"
        options={{
          title: 'Puntos de retiro',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      */}
      <Stack.Screen
        name="manage/regrets"
        options={{
          title: 'Arrepentimientos',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="manage/regret/[id]"
        options={{
          title: 'Arrepentimiento',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="manage/ticket/[id]"
        options={{
          title: 'Entrada',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="manage/product/[id]"
        options={{
          title: 'Producto',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="switch-event"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="dashboard-filters"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="operations-filters"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="team-filters"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="change-role/[id]"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="invite-member"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="manage/new/[kind]"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="manage/combo-products"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="manage/category-picker"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="manage/new-category"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="manage/products-filters"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          // Hoja propia (<Sheet>): todo el ancho y pegada abajo; anima ella misma.
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}
