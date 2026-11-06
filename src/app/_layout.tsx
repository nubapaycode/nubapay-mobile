import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import "@/features/live/background";
import { KeyboardProvider } from "@/components/fx/keyboard";
import { NetworkBanner } from "@/components/fx/network-banner";
import { SplashHandoff } from "@/components/fx/splash-handoff";
import { ThemeReveal } from "@/components/fx/theme-reveal";
import { CardExpandHost } from "@/components/motion/card-expand";
import { ToastHost } from "@/components/ui/toast";
import { DisplayFont } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { dark, PaletteScope, ThemeProvider, useTheme } from "@/theme";

// Ruido de librerías con native driver (no viene de código propio).
LogBox.ignoreLogs([
  "Sending `onAnimatedValueUpdate` with no listeners registered",
]);

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, token } = useAuth();
  const { colors: themeColors, loaded: themeLoaded } = useTheme();
  // Sin sesión (bienvenida, login, recuperar contraseña) siempre en oscuro, sin importar el tema elegido.
  const colors = token ? themeColors : dark;
  // Bricolage Grotesque (títulos, igual que nubapay-frontend). Si falla la carga se sigue con la del sistema.
  const [fontsLoaded, fontError] = useFonts({
    [DisplayFont.semibold]: BricolageGrotesque_600SemiBold,
    [DisplayFont.bold]: BricolageGrotesque_700Bold,
    [DisplayFont.extrabold]: BricolageGrotesque_800ExtraBold,
  });
  const ready = !isLoading && themeLoaded && (fontsLoaded || !!fontError);

  // El splash nativo lo oculta `SplashHandoff` cuando su copia ya está dibujada encima.

  const navTheme = useMemo(() => {
    const base = colors.scheme === "dark" ? DarkTheme : DefaultTheme;
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
    <PaletteScope palette={colors}>
      <NavigationThemeProvider value={navTheme}>
        <StatusBar style={colors.scheme === "dark" ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!!token} redirectTo="/welcome">
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!token} redirectTo="/">
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
        <CardExpandHost />
        {token ? <NetworkBanner /> : null}
        <SplashHandoff />
        <ToastHost />
      </NavigationThemeProvider>
    </PaletteScope>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ThemeProvider>
          <ThemeReveal>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ThemeReveal>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
