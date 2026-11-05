import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import { dark, light, type Palette } from './palette';

/** Apariencia elegida en Perfil: seguir al teléfono o fijar claro u oscuro. */
export type AppearancePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'nubapay_appearance';
const canStore = Platform.OS !== 'web';

const isPreference = (v: unknown): v is AppearancePreference =>
  v === 'system' || v === 'light' || v === 'dark';

type ThemeState = {
  colors: Palette;
  preference: AppearancePreference;
  setPreference: (p: AppearancePreference) => void;
  /** Falso hasta leer la preferencia guardada: el layout raíz espera para no parpadear. */
  loaded: boolean;
};

const ThemeContext = createContext<ThemeState | null>(null);

/**
 * Tema claro u oscuro. Por defecto sigue al sistema (`userInterfaceStyle: "automatic"`); desde
 * Perfil se puede fijar uno. La elección también se aplica a lo nativo (`Appearance`), así hojas,
 * teclado y alertas usan el mismo modo, y queda guardada en el teléfono.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<AppearancePreference>('system');
  const [loaded, setLoaded] = useState(!canStore);
  const system = useColorScheme();

  useEffect(() => {
    if (!canStore) return;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((v) => {
        if (isPreference(v)) setPref(v);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const setPreference = useCallback((p: AppearancePreference) => {
    setPref(p);
    if (canStore) SecureStore.setItemAsync(STORAGE_KEY, p).catch(() => {});
  }, []);

  const scheme = preference === 'system' ? system : preference;
  const colors = scheme === 'dark' ? dark : light;

  useEffect(() => {
    // Fondo de la ventana nativa: es lo que se ve detrás de hojas y transiciones.
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors]);

  const value = useMemo(
    () => ({ colors, preference, setPreference, loaded }),
    [colors, preference, setPreference, loaded],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
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
