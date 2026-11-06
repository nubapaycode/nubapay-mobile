import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import type { AuroraColors } from './aurora.skia';
import { hasSkia } from './skia';

type SkiaAuroraProps = { colors: AuroraColors; lime: number; strength: number };

// Solo se carga si el build trae Skia (ver ./skia).
const SkiaAurora: ComponentType<SkiaAuroraProps> | null = hasSkia
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./aurora.skia').default
  : null;

/** Índigo de las manchas: no está en la paleta, solo vive en este fondo. */
const INDIGO = '#4d2dff';

/**
 * Fondo animado del acceso (manchas de luz de marca). Sin Skia queda el fondo liso.
 * Pensado para la paleta oscura. `strength` atenúa las manchas azules (pantallas con formulario)
 * y `lime` controla el toque de lima (0 = sin lima).
 */
export function Aurora({ lime = 0.55, strength = 1 }: { lime?: number; strength?: number }) {
  const { colors } = useTheme();
  if (!SkiaAurora) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />;
  }
  return (
    <SkiaAurora
      lime={lime}
      strength={strength}
      colors={{
        background: colors.background,
        blue: colors.primary,
        navy: colors.hero.top,
        indigo: INDIGO,
        lime: colors.brand,
      }}
    />
  );
}
