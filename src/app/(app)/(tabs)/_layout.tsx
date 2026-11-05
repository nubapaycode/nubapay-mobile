import { router, Tabs } from 'expo-router';

import { AppTabBar } from '@/components/navigation/app-tab-bar';
import { useTheme } from '@/theme';

/** Pestañas del organizador. La barra es propia (solo íconos + botón central de escanear). */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} onScan={() => router.push('/scan')} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="operations" options={{ title: 'Operaciones' }} />
      <Tabs.Screen name="team" options={{ title: 'Equipo' }} />
      <Tabs.Screen name="more" options={{ title: 'Más' }} />
    </Tabs>
  );
}
