import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import {
  type SharedValue,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Degradé vertical de marca (arriba → medio → fondo) con tres manchas de luz que derivan lento.
 * En vivo, la luz "respira". `pull` (overscroll) agranda el resplandor de arriba.
 */
const SOURCE = Skia.RuntimeEffect.Make(`
uniform float2 res;
uniform float time;
uniform float live;
uniform float pull;
uniform float top0;
uniform float heroH;
uniform float amount;
uniform half4 cTop;
uniform half4 cMid;
uniform half4 cBg;
uniform half4 cAccent;

float blob(float2 uv, float2 c, float aspect, float k) {
  float2 d = (uv - c) * float2(aspect, 1.0);
  return exp(-dot(d, d) * k);
}

half4 main(float2 p) {
  float y = (p.y - top0) / heroH;
  half4 col = y < 0.0 ? cTop
    : (y < 0.42 ? mix(cTop, cMid, half(y / 0.42))
    : mix(cMid, cBg, half(clamp((y - 0.42) / 0.58, 0.0, 1.0))));

  float aspect = res.x / heroH;
  float2 uv = float2(p.x / res.x, y);
  float t = time;
  float g = blob(uv, float2(0.22 + 0.16 * sin(t * 0.21), 0.04 + 0.07 * cos(t * 0.17)), aspect, 5.0) * 0.6
          + blob(uv, float2(0.80 + 0.12 * cos(t * 0.19), 0.16 + 0.09 * sin(t * 0.23)), aspect, 6.5) * 0.5
          + blob(uv, float2(0.50 + 0.22 * sin(t * 0.13 + 1.3), 0.30 + 0.06 * cos(t * 0.29)), aspect, 9.0) * 0.35;

  // Resplandor de arriba: se agranda al estirar el scroll.
  float stretch = 1.0 + pull / 220.0;
  g += blob(uv, float2(0.5, -0.05), aspect / stretch, 3.0 / stretch) * 0.4;

  float breathe = live * (0.5 + 0.5 * sin(t * 2.4));
  float zone = 1.0 - smoothstep(0.30, 0.72, y);
  float a = clamp(g * zone * amount * (0.55 + 0.35 * breathe), 0.0, 0.85);
  return mix(col, cAccent, half(a));
}
`)!;

type Props = {
  /** Distancia (px) desde arriba del lienzo hasta el inicio del contenido. */
  top: number;
  /** Alto del hero (donde termina el degradé). */
  heroHeight: number;
  colors: { top: string; mid: string; background: string; accent: string };
  /** Intensidad de las manchas (menos en modo claro). */
  amount: number;
  live: boolean;
  scrollY?: SharedValue<number>;
};

const toVec4 = (c: string) => Array.from(Skia.Color(c));


export default function LiveGradient({ top, heroHeight, colors, amount, live, scrollY }: Props) {
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const time = useSharedValue(0);
  const liveSv = useSharedValue(live ? 1 : 0);
  useEffect(() => {
    liveSv.set(withTiming(live ? 1 : 0, { duration: 600 }));
  }, [live, liveSv]);

  // El reloj solo corre con la pantalla enfocada (no gasta GPU en segundo plano).
  const frame = useFrameCallback((f) => {
    time.value += (f.timeSincePreviousFrame ?? 16) / 1000;
  }, false);
  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) return;
      frame.setActive(true);
      return () => frame.setActive(false);
    }, [frame, reduceMotion]),
  );

  const palette = useMemo(
    () => ({
      cTop: toVec4(colors.top),
      cMid: toVec4(colors.mid),
      cBg: toVec4(colors.background),
      cAccent: toVec4(colors.accent),
    }),
    [colors.top, colors.mid, colors.background, colors.accent],
  );

  const uniforms = useDerivedValue(() => ({
    res: [size.width, size.height],
    time: time.value,
    live: liveSv.value,
    pull: scrollY ? Math.max(0, -scrollY.value) : 0,
    top0: top,
    heroH: heroHeight,
    amount,
    ...palette,
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {size.width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={SOURCE} uniforms={uniforms} />
          </Fill>
        </Canvas>
      ) : null}
    </View>
  );
}
