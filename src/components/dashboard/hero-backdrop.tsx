import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

/** Alto extra por encima del contenido: lo que se ve al estirar el scroll hacia abajo. */
const OVERSCROLL = 400;

/**
 * Degradé del hero del inicio, a todo el ancho y detrás del contenido: el azul de marca arriba
 * que se funde con el fondo de pantalla. Se desplaza con el scroll.
 */
export function HeroBackdrop({ height }: { height: number }) {
  const { colors } = useTheme();
  const total = OVERSCROLL + height;
  const at = (y: number) => Math.min(1, Math.max(0, (OVERSCROLL + y) / total));

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: -OVERSCROLL, height: total }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="heroBase" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.hero.top} />
            <Stop offset={at(0)} stopColor={colors.hero.top} />
            <Stop offset={at(height * 0.42)} stopColor={colors.hero.mid} />
            <Stop offset="1" stopColor={colors.background} />
          </LinearGradient>
          <RadialGradient id="heroGlow" cx="50%" cy={at(0)} rx="75%" ry={height / total / 1.6} fx="50%" fy={at(0)}>
            <Stop offset="0" stopColor={colors.hero.top} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.hero.top} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroBase)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGlow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0 },
});
