import { Canvas, createPicture, Picture, Skia, useClock } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

/** Duración de la ráfaga (ms). Después el lienzo queda vacío y el contenedor lo desmonta. */
export const CONFETTI_MS = 2600;
const COUNT = 90;
const GRAVITY = 1300; // px/s²
const DRAG = 0.9; // pérdida de velocidad horizontal por segundo (aire)

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  spin: number;
  /** Frecuencia del "aleteo" (el papel gira sobre su eje y se ve más angosto). */
  flip: number;
  color: number;
  delay: number;
};

/** Generador pseudoaleatorio con semilla (mulberry32): misma semilla, misma ráfaga. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ráfaga de confetti dibujada en una sola imagen por cuadro (createPicture): los papelitos salen
 * desde `origin` hacia arriba y caen con gravedad, giro y aleteo. Todo corre en el hilo de UI.
 */
export default function SkiaConfetti({
  colors,
  origin,
  seed = 1,
}: {
  colors: string[];
  origin?: { x: number; y: number };
  seed?: number;
}) {
  const { width, height } = useWindowDimensions();
  const clock = useClock();
  const ox = origin?.x ?? width / 2;
  const oy = origin?.y ?? height * 0.42;

  const particles = useMemo<Particle[]>(() => {
    const random = seeded(seed * 7919 + 17);
    const rand = (a: number, b: number) => a + random() * (b - a);
    return Array.from({ length: COUNT }, () => {
      const angle = rand(-Math.PI * 0.92, -Math.PI * 0.08); // abanico hacia arriba
      const speed = rand(520, 1150);
      return {
        x: ox + rand(-16, 16),
        y: oy + rand(-8, 8),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: rand(6, 11),
        h: rand(9, 16),
        rot: rand(0, Math.PI * 2),
        spin: rand(-9, 9),
        flip: rand(6, 14),
        color: Math.floor(random() * colors.length),
        delay: rand(0, 0.12),
      };
    });
  }, [ox, oy, colors.length, seed]);

  const parsed = useMemo(() => colors.map((c) => Skia.Color(c)), [colors]);

  const picture = useDerivedValue(() => {
    const t = clock.value / 1000;
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const lt = t - p.delay;
        if (lt <= 0) continue;
        const damp = Math.pow(DRAG, lt);
        const x = p.x + p.vx * lt * damp;
        const y = p.y + p.vy * lt + 0.5 * GRAVITY * lt * lt;
        if (y > height + 40) continue;
        // Se desvanece en el último tercio.
        const life = Math.min(1, Math.max(0, 1 - (lt - 1.6) / 0.8));
        if (life <= 0) continue;
        paint.setColor(parsed[p.color]);
        paint.setAlphaf(life);
        const sx = Math.abs(Math.cos(lt * p.flip)) * 0.85 + 0.15;
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(((p.rot + p.spin * lt) * 180) / Math.PI, 0, 0);
        canvas.scale(sx, 1);
        canvas.drawRRect(
          Skia.RRectXY(Skia.XYWHRect(-p.w / 2, -p.h / 2, p.w, p.h), 1.5, 1.5),
          paint,
        );
        canvas.restore();
      }
    });
  });

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
