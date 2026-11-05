import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DisplayFont } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ThemeProvider, useTheme } from '@/theme';

// Ruido de librerías con native driver (no viene de código propio).
LogBox.ignoreLogs(['Sending `onAnimatedValueUpdate` with no listeners registered']);

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, token } = useAuth();
  const { colors, loaded: themeLoaded } = useTheme();
  // Bricolage Grotesque (títulos, igual que nubapay-frontend). Si falla la carga se sigue con la del sistema.
  const [fontsLoaded, fontError] = useFonts({
    [DisplayFont.semibold]: BricolageGrotesque_600SemiBold,
    [DisplayFont.bold]: BricolageGrotesque_700Bold,
    [DisplayFont.extrabold]: BricolageGrotesque_800ExtraBold,
  });
  const ready = !isLoading && themeLoaded && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  const navTheme = useMemo(() => {
    const base = colors.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [colors]);

  if (!ready) return null;

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={colors.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!token} redirectTo="/login">
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!token} redirectTo="/">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
