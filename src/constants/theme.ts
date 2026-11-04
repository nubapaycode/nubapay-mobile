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

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
