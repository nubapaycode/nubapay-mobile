import { createContext, use } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

import { Font } from '@/constants/theme';

/**
 * Cuánto puede crecer un texto con la letra grande del sistema. Sin tope, el hero, los chips y la
 * barra de pestañas se rompen; con 1.3 (≈ "Extra grande" de iOS) se sigue leyendo bien sin desarmar
 * el diseño. Un texto que necesite otro límite lo pasa con `maxFontSizeMultiplier`.
 */
export const MAX_FONT_SCALE = 1.3;

/** Un `Text` anidado hereda la familia del padre: solo el de afuera pone Geist Regular por defecto. */
const InsideText = createContext(false);

const base = { fontFamily: Font.regular };

/**
 * `Text` de la app: igual al de React Native pero con Geist Regular y el tope de escala de fuente
 * por defecto. Para Medium, el estilo pasa `fontFamily: Font.medium`.
 */
export function Text({ maxFontSizeMultiplier = MAX_FONT_SCALE, style, ...rest }: TextProps) {
  const nested = use(InsideText);
  const text = (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={nested ? style : [base, style]}
      {...rest}
    />
  );
  return nested ? text : <InsideText value>{text}</InsideText>;
}
