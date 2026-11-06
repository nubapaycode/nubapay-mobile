import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue } from 'react-native-reanimated';

/**
 * Fondo de la bienvenida: manchas de luz desenfocadas (azul, marino, índigo y un toque de lima)
 * que derivan lento sobre el fondo y se funden con él hacia abajo, donde va el texto.
 * Las posiciones y tamaños salen del diseño (frame de 390×844); se miden en unidades del alto
 * para que las manchas sigan redondas en cualquier pantalla.
 */
const SOURCE = Skia.RuntimeEffect.Make(`
uniform float2 res;
uniform float time;
uniform float lime;
uniform float strength;
uniform half4 cBg;
uniform half4 cBlue;
uniform half4 cNavy;
uniform half4 cIndigo;
uniform half4 cLime;

float blob(float2 uv, float2 c, float aspect, float k) {
  float2 d = (uv - c) * float2(aspect, 1.0);
  return exp(-dot(d, d) * k);
}

half4 main(float2 p) {
  float2 uv = p / res;
  float aspect = res.x / res.y;
  float t = time;
  half4 col = cBg;

  float navy = blob(uv, float2(0.85 - 0.18 * sin(t * 0.48), 0.40 - 0.05 * sin(t * 0.48)), aspect, 22.0);
  col = mix(col, cNavy, half(navy * strength));
  float blue = blob(uv, float2(0.23 + 0.15 * sin(t * 0.57), 0.15 + 0.09 * sin(t * 0.57)), aspect, 34.0);
  col = mix(col, cBlue, half(blue * 0.85 * strength));
  float indigo = blob(uv, float2(0.18 - 0.16 * sin(t * 0.48 + 1.1), 0.65 - 0.05 * sin(t * 0.48 + 1.1)), aspect, 42.0);
  col = mix(col, cIndigo, half(indigo * 0.5 * strength));
  float green = blob(uv, float2(0.41 + 0.10 * sin(t * 0.70), 0.47 - 0.10 * sin(t * 0.70)), aspect, 70.0);
  col = mix(col, cLime, half(green * lime));

  // Abajo se apaga al fondo: ahí van el titular y el botón.
  return mix(col, cBg, half(smoothstep(0.50, 0.86, uv.y)));
}
`)!;

export type AuroraColors = { background: string; blue: string; navy: string; indigo: string; lime: string };

const toVec4 = (c: string) => Array.from(Skia.Color(c));

export default function Aurora({
  colors,
  lime,
  strength,
}: {
  colors: AuroraColors;
  lime: number;
  strength: number;
}) {
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const time = useSharedValue(0);

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
      cBg: toVec4(colors.background),
      cBlue: toVec4(colors.blue),
      cNavy: toVec4(colors.navy),
      cIndigo: toVec4(colors.indigo),
      cLime: toVec4(colors.lime),
    }),
    [colors.background, colors.blue, colors.navy, colors.indigo, colors.lime],
  );

  const uniforms = useDerivedValue(() => ({
    res: [size.width, size.height],
    time: time.value,
    lime,
    strength,
    ...palette,
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
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
