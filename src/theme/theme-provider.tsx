import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react';
import { Appearance, Platform } from 'react-native';

import { light, type Palette } from './palette';

/** Preferencia de apariencia que guardaban versiones anteriores (había modo oscuro). */
const LEGACY_STORAGE_KEY = 'nubapay_appearance';

type ThemeState = {
  colors: Palette;
  /** Se mantiene por compatibilidad con el layout raíz: el tema ya no se carga de forma asíncrona. */
  loaded: boolean;
};

const ThemeContext = createContext<ThemeState | null>(null);

const VALUE: ThemeState = { colors: light, loaded: true };

/**
 * Tema único claro. La app no tiene modo oscuro: también se fuerza en lo nativo
 * (`Appearance` + `userInterfaceStyle: "light"` en app.json) para hojas, teclado y barra.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    Appearance.setColorScheme('light');
    SystemUI.setBackgroundColorAsync(light.canvas).catch(() => {});
    if (Platform.OS !== 'web') SecureStore.deleteItemAsync(LEGACY_STORAGE_KEY).catch(() => {});
  }, []);

  return <ThemeContext.Provider value={VALUE}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}

/**
 * Fuerza una paleta en un subárbol. `useTheme` y `makeStyles` de los hijos leen esta paleta
 * sin cambios en los componentes.
 */
export function PaletteScope({ palette, children }: { palette: Palette; children: ReactNode }) {
  const parent = useTheme();
  const value = useMemo(() => ({ ...parent, colors: palette }), [parent, palette]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Estilos que dependen de la paleta: se crean una vez por paleta y se reutilizan. */
export function makeStyles<T>(factory: (c: Palette) => T): () => T {
  const cache = new Map<Palette, T>();
  return function useStyles() {
    const { colors } = useTheme();
    let styles = cache.get(colors);
    if (!styles) {
      styles = factory(colors);
      cache.set(colors, styles);
    }
    return styles;
  };
}
