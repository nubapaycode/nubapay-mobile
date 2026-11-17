import { Text as RNText, type TextProps } from 'react-native';

/**
 * Cuánto puede crecer un texto con la letra grande del sistema. Sin tope, el hero, los chips y la
 * barra de pestañas se rompen; con 1.3 (≈ "Extra grande" de iOS) se sigue leyendo bien sin desarmar
 * el diseño. Un texto que necesite otro límite lo pasa con `maxFontSizeMultiplier`.
 */
export const MAX_FONT_SCALE = 1.3;

/** `Text` de la app: igual al de React Native pero con el tope de escala de fuente por defecto. */
export function Text({ maxFontSizeMultiplier = MAX_FONT_SCALE, ...rest }: TextProps) {
  return <RNText maxFontSizeMultiplier={maxFontSizeMultiplier} {...rest} />;
}
