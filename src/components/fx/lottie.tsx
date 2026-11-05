import type { ComponentType, ReactNode } from 'react';
import { useMemo } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { hasSkia } from './skia';

/** Colores que las animaciones de `assets/lottie` exponen por nombre. */
export type LottieColors = { card: string; soft: string; ink: string; accent: string };

const SOURCES = {
  empty: require('../../../assets/lottie/empty.json') as object,
  search: require('../../../assets/lottie/search.json') as object,
  offline: require('../../../assets/lottie/offline.json') as object,
  success: require('../../../assets/lottie/success.json') as object,
};
export type LottieName = keyof typeof SOURCES;

type SkiaLottieProps = {
  source: object;
  size: number;
  colors: LottieColors;
  still: boolean;
  loop: boolean;
};

// Skottie viene con Skia: solo se carga si el build lo trae (ver ./skia).
const SkiaLottie: ComponentType<SkiaLottieProps> | null = hasSkia
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./lottie.skia').default
  : null;

/**
 * Ilustración animada (Lottie) para estados vacíos y de error, en los colores del tema. Sin Skia
 * muestra `fallback` (el ícono de siempre); con "reducir movimiento", un cuadro fijo.
 */
export function Lottie({
  name,
  size = 120,
  fallback = null,
  loop = true,
  accent,
}: {
  name: LottieName;
  size?: number;
  fallback?: ReactNode;
  loop?: boolean;
  /** Color de acento (por defecto el azul de marca). */
  accent?: string;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const palette = useMemo<LottieColors>(
    () => ({
      // En "success" la tarjeta es el check sobre el círculo: siempre blanco.
      card: name === 'success' ? '#ffffff' : colors.surface,
      soft: colors.borderStrong,
      ink: colors.textMuted,
      accent: accent ?? colors.primary,
    }),
    [name, colors.surface, colors.borderStrong, colors.textMuted, colors.primary, accent],
  );

  if (!SkiaLottie) return <>{fallback}</>;
  return (
    <SkiaLottie
      source={SOURCES[name]}
      size={size}
      colors={palette}
      still={reduceMotion}
      loop={loop}
    />
  );
}
