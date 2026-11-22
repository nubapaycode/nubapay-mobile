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
 * Geist en iOS y Android, solo en dos pesos: Regular (cuerpo) y Medium (títulos, labels, cifras).
 * Se carga en el layout raíz. Con fuentes custom el peso se elige por familia, nunca con `fontWeight`:
 * Android no combina familia + peso y iOS sintetizaría un bold que no existe.
 */
export const Font = {
  regular: 'Geist-Regular',
  medium: 'Geist-Medium',
} as const;

/** Atajo para estilos: `...font('medium')`. */
export function font(weight: keyof typeof Font = 'regular') {
  return { fontFamily: Font[weight] };
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
