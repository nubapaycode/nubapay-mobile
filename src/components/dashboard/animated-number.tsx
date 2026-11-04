import { useEffect, useRef, useState } from 'react';
import { Text, type TextProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** Cuenta hasta `target` con ease-in-out (1200 ms); en cambios posteriores anima desde el valor anterior. */
export function useCountUp(target: number, duration = 1200): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (reduceMotion) return;
    const from = current.current;
    if (from === target) return;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      // ease-in-out cúbica: arranca y frena gradualmente, sin saltos.
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const v = from + (target - from) * eased;
      current.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduceMotion]);

  return reduceMotion ? target : value;
}

type Props = TextProps & { value: number; format: (n: number) => string; duration?: number };

export function AnimatedNumber({ value, format, duration, style, ...rest }: Props) {
  const v = useCountUp(value, duration);
  return (
    <Text {...rest} style={[{ fontVariant: ['tabular-nums'] }, style]}>
      {format(v)}
    </Text>
  );
}
