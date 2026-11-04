import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';

/** Web de Nubapay: ahí se crean los eventos (la app todavía no tiene ese flujo). */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL;

/** Abre la web de Nubapay en una hoja del navegador para crear un evento. */
export function openAddEvent(tint: string) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  if (!WEB_URL) return;
  WebBrowser.openBrowserAsync(WEB_URL, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: tint,
  });
}
