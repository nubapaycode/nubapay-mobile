import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

import { hasSkia } from './skia';

type SkiaConfettiProps = { colors: string[]; origin?: { x: number; y: number }; seed?: number };

// Solo se carga si el build trae Skia (ver ./skia).
const SkiaConfetti: ComponentType<SkiaConfettiProps> | null = hasSkia
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./confetti.skia').default
  : null;
const DURATION = 2600;

/**
 * Celebración de un momento importante (pago cobrado, retiro pedido). Se monta, tira una ráfaga
 * y se desmonta sola. Sin Skia o con "reducir movimiento" no se muestra.
 */
export function Confetti({ origin, seed }: { origin?: { x: number; y: number }; seed?: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDone(true), DURATION);
    return () => clearTimeout(t);
  }, []);

  if (!SkiaConfetti || reduceMotion || done) return null;
  return (
    <SkiaConfetti
      origin={origin}
      seed={seed}
      colors={[colors.brand, colors.primary, colors.success, colors.warning, '#ffffff']}
    />
  );
}
