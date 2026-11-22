import '@/global.css';

import { Platform } from 'react-native';

/**
 * Tokens que no dependen del modo claro/oscuro.
 * Los colores viven en `@/theme` (`useTheme().colors` / `makeStyles`).
 */

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace', rounded: 'ui-rounded' },
  web: { sans: 'var(--font-display)', mono: 'var(--font-mono)', rounded: 'var(--font-rounded)' },
  default: { sans: 'normal', mono: 'monospace', rounded: 'normal' },
});

/**
 * Bricolage Grotesque para títulos (como `--font-bricolage` en nubapay-frontend); se carga en el layout raíz.
 * Con fuentes custom se elige el peso por familia, no con `fontWeight` (en Android no lo combina).
 * Las cifras grandes siguen en la fuente del sistema: necesitan dígitos tabulares para el conteo animado.
 */
export const DisplayFont = {
  semibold: 'BricolageGrotesque-SemiBold',
  bold: 'BricolageGrotesque-Bold',
  extrabold: 'BricolageGrotesque-ExtraBold',
} as const;

/**
 * Texto de cards y detalle: SF Pro (sistema) en iOS con su peso; en Android, Bricolage Grotesque.
 * Bricolage no tiene medium cargado: en Android 500 cae en la semibold, la más cercana.
 */
export function uiFont(weight: '500' | '600' | '700') {
  return Platform.OS === 'android'
    ? { fontFamily: weight === '700' ? DisplayFont.bold : DisplayFont.semibold }
    : { fontWeight: weight };
}

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
