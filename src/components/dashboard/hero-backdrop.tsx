import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { hasSkia } from '@/components/fx/skia';
import { useTheme } from '@/theme';

/** Alto extra por encima del contenido: lo que se ve al estirar el scroll hacia abajo. */
const OVERSCROLL = 400;

type LiveGradientProps = {
  top: number;
  heroHeight: number;
  colors: { top: string; mid: string; background: string; accent: string };
  amount: number;
  live: boolean;
  scrollY?: SharedValue<number>;
};

// Versión animada con Skia, solo si el build la trae (ver fx/skia).
const LiveGradient: ComponentType<LiveGradientProps> | null = hasSkia
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/components/fx/live-gradient.skia').default
  : null;

type Props = {
  height: number;
  /** Scroll del inicio: al estirar hacia abajo el resplandor se agranda. */
  scrollY?: SharedValue<number>;
  /** Evento en vivo: la luz del hero respira. */
  live?: boolean;
};

/**
 * Degradé del hero del inicio, a todo el ancho y detrás del contenido: el azul de marca arriba
 * que se funde con el fondo de pantalla. Se desplaza con el scroll. Con Skia, manchas de luz que
 * derivan lento (y laten si el evento está en vivo); sin Skia, el degradé fijo.
 */
export function HeroBackdrop({ height, scrollY, live = false }: Props) {
  const { colors } = useTheme();
  const total = OVERSCROLL + height;
  const at = (y: number) => Math.min(1, Math.max(0, (OVERSCROLL + y) / total));

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: -OVERSCROLL, height: total }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {LiveGradient ? (
        <LiveGradient
          top={OVERSCROLL}
          heroHeight={height}
          colors={{
            top: colors.hero.top,
            mid: colors.hero.mid,
            background: colors.background,
            accent: colors.primary,
          }}
          amount={colors.scheme === 'dark' ? 0.45 : 0.15}
          live={live}
          scrollY={scrollY}
        />
      ) : (
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="heroBase" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.hero.top} />
              <Stop offset={at(0)} stopColor={colors.hero.top} />
              <Stop offset={at(height * 0.42)} stopColor={colors.hero.mid} />
              <Stop offset="1" stopColor={colors.background} />
            </LinearGradient>
            <RadialGradient
              id="heroGlow"
              cx="50%"
              cy={at(0)}
              rx="75%"
              ry={height / total / 1.6}
              fx="50%"
              fy={at(0)}>
              <Stop offset="0" stopColor={colors.hero.top} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.hero.top} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroBase)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGlow)" />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0 },
});
