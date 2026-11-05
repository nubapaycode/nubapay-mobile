import { Stack } from 'expo-router';

import { DisplayFont } from '@/constants/theme';
import { useTheme } from '@/theme';

export default function AppLayout() {
  const { colors } = useTheme();
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
        name="scan"
        options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen
        name="detail/[section]"
        options={{
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
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
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
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.background },
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
