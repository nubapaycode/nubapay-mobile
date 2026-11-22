import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { buildFace, type FaceLayer } from './face-parts';

/**
 * Avatar con un personaje plano (en lugar de las iniciales): fondo de color, hombros, cara con
 * peinado, ojos y boca. La combinación sale de un hash de `seed` (el nombre), así cada persona tiene
 * siempre el mismo. Las piezas están en `face-parts.ts`.
 */
export function FaceAvatar({ seed, size = 44 }: { seed: string; size?: number }) {
  const face = useMemo(() => buildFace(seed), [seed]);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: face.bg }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {face.layers.map((l, i) => (
          <Layer key={i} layer={l} />
        ))}
      </Svg>
    </View>
  );
}

function Layer({ layer: l }: { layer: FaceLayer }) {
  const paint = {
    fill: l.kind !== 'ellipse' && !l.fill ? 'none' : l.fill,
    opacity: l.opacity,
    ...(l.kind !== 'ellipse' && l.stroke
      ? { stroke: l.stroke, strokeWidth: l.width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
      : null),
  };
  if (l.kind === 'path') return <Path d={l.d} {...paint} />;
  if (l.kind === 'circle') return <Circle cx={l.cx} cy={l.cy} r={l.r} {...paint} />;
  return <Ellipse cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry} {...paint} />;
}
