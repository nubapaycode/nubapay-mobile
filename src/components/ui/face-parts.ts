/**
 * Personajes planos para los avatares (sin dependencias: lo usa FaceAvatar y se puede previsualizar
 * con node). Cada persona sale de un hash del `seed`: fondo, ropa, tono de piel, peinado, ojos,
 * boca y extras (rubor, anteojos). Todo en un viewBox de 100×100, recortado en círculo.
 */

export type FaceLayer =
  | { kind: 'path'; d: string; fill?: string; stroke?: string; width?: number; opacity?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; width?: number; opacity?: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: string; opacity?: number };

export type Face = { bg: string; layers: FaceLayer[] };

/** Fondo y la ropa que combina con él (un tono más profundo). */
const PALETTE = [
  { bg: '#C6FF00', shirt: '#0B0F17' }, // lima de marca
  { bg: '#8FB8FF', shirt: '#2F5BD3' }, // azul
  { bg: '#B9A2FF', shirt: '#5B3FC4' }, // violeta
  { bg: '#FF9F8F', shirt: '#C8473A' }, // coral
  { bg: '#FFD66B', shirt: '#D08A00' }, // amarillo
  { bg: '#7FE0BE', shirt: '#13865F' }, // menta
  { bg: '#FFB3D9', shirt: '#C8457F' }, // rosa
  { bg: '#9FE3FF', shirt: '#1E7FAE' }, // cielo
];

/** Tonos de piel con su peso: los más oscuros aparecen menos seguido. */
const SKIN: [color: string, weight: number][] = [
  ['#FFE3CF', 6],
  ['#F6CBA8', 6],
  ['#E3AA80', 4],
  ['#C1865C', 2],
  ['#9A6443', 1],
  ['#7A4A2E', 1],
];
const HAIR = ['#1F1B2D', '#4A2E1F', '#8A5A33', '#E0B34E', '#E2603F', '#6B4BD6', '#F2F2F2'];
const INK = '#1F1B2D';

/** Cabeza: centro y radios (algunas más redondas, otras ovaladas). */
const HEADS = [
  { cx: 50, cy: 50, rx: 21, ry: 23 },
  { cx: 50, cy: 51, rx: 23, ry: 22 },
  { cx: 50, cy: 49, rx: 20, ry: 25 },
];

type Hair = { back?: string; front?: string; extra?: (c: string) => FaceLayer[]; hat?: boolean };

/** Peinados: `back` va detrás de la cabeza (pelo largo), `front` encima (flequillo, gorro). */
const HAIRS: Hair[] = [
  // Pelado.
  {},
  // Corte casquete.
  { front: 'M28 48 C26 20 74 20 72 48 C66 36 56 33 50 33 C44 33 34 36 28 48 Z' },
  // Jopo de costado.
  { front: 'M28 46 C27 22 60 16 74 34 C76 40 73 46 72 48 C66 34 46 28 28 46 Z' },
  // Puntas.
  { front: 'M28 44 L31 26 L39 34 L44 20 L51 32 L58 19 L62 33 L71 25 L72 44 C62 34 38 34 28 44 Z' },
  // Pelo largo.
  {
    back: 'M24 52 C22 18 78 18 76 52 L80 84 L20 84 Z',
    front: 'M28 47 C28 24 72 24 72 47 C64 36 58 38 50 30 C44 38 36 38 28 47 Z',
  },
  // Rodete arriba.
  {
    front: 'M28 46 C27 24 73 24 72 46 C64 36 36 36 28 46 Z',
    extra: (c) => [{ kind: 'circle', cx: 50, cy: 21, r: 9, fill: c }],
  },
  // Rulos.
  {
    front:
      'M27 48 C21 44 23 34 30 34 C28 26 36 21 42 25 C44 18 56 18 58 25 C64 21 72 26 70 34 C77 34 79 44 73 48 C66 40 34 40 27 48 Z',
  },
  // Gorro con pompón (del color de la ropa).
  {
    hat: true,
    front: 'M27 44 C27 18 73 18 73 44 Z',
    extra: (c) => [
      { kind: 'path', d: 'M25 46 C25 40 75 40 75 46 L75 48 C75 52 25 52 25 48 Z', fill: c, opacity: 0.85 },
      { kind: 'circle', cx: 50, cy: 18, r: 6, fill: '#FFFFFF' },
    ],
  },
];

const EYES: FaceLayer[][] = [
  // Puntos.
  [
    { kind: 'circle', cx: 42, cy: 52, r: 2.8, fill: INK },
    { kind: 'circle', cx: 58, cy: 52, r: 2.8, fill: INK },
  ],
  // Óvalos con brillo.
  [
    { kind: 'ellipse', cx: 42, cy: 52, rx: 3, ry: 4.2, fill: INK },
    { kind: 'ellipse', cx: 58, cy: 52, rx: 3, ry: 4.2, fill: INK },
    { kind: 'circle', cx: 43, cy: 50.5, r: 1, fill: '#FFFFFF' },
    { kind: 'circle', cx: 59, cy: 50.5, r: 1, fill: '#FFFFFF' },
  ],
  // Felices (cerrados).
  [{ kind: 'path', d: 'M38 53 Q42 48.5 46 53 M54 53 Q58 48.5 62 53', stroke: INK, width: 2.6 }],
  // Guiño.
  [
    { kind: 'circle', cx: 42, cy: 52, r: 2.8, fill: INK },
    { kind: 'path', d: 'M54 53 Q58 49 62 53', stroke: INK, width: 2.6 },
  ],
];

const MOUTHS: FaceLayer[][] = [
  [{ kind: 'path', d: 'M44 61 Q50 66 56 61', stroke: INK, width: 2.6 }],
  [{ kind: 'path', d: 'M43 60 Q50 70 57 60 Z', fill: INK }],
  [{ kind: 'circle', cx: 50, cy: 63, r: 2.6, fill: INK }],
  [{ kind: 'path', d: 'M46 62 L54 62', stroke: INK, width: 2.6 }],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Mezcla final para que nombres parecidos ("Ana", "Ane") den caras bien distintas.
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

export function buildFace(seed: string): Face {
  let state = hash(seed.trim().toLowerCase() || '?');
  // Generador chico a partir del hash: cada rasgo usa su propio número.
  const next = (n: number) => {
    state = Math.imul(state ^ (state >>> 16), 0x45d9f3b) >>> 0;
    return state % n;
  };
  const weighted = <T>(list: [T, number][]) => {
    let r = next(list.reduce((a, [, w]) => a + w, 0));
    for (const [v, w] of list) {
      if (r < w) return v;
      r -= w;
    }
    return list[0][0];
  };

  const color = PALETTE[next(PALETTE.length)];
  const skin = weighted(SKIN);
  const hair = HAIRS[next(HAIRS.length)];
  const hairColor = hair.hat ? color.shirt : HAIR[next(HAIR.length)];
  const head = HEADS[next(HEADS.length)];
  const eyes = EYES[next(EYES.length)];
  const mouth = MOUTHS[next(MOUTHS.length)];
  const blush = next(3) === 0;
  const glasses = next(4) === 0;

  const layers: FaceLayer[] = [];
  if (hair.back) layers.push({ kind: 'path', d: hair.back, fill: hairColor });
  // Hombros y cuello.
  layers.push({ kind: 'path', d: 'M12 104 C14 80 34 72 50 72 C66 72 86 80 88 104 Z', fill: color.shirt });
  layers.push({ kind: 'path', d: 'M43 66 L57 66 L56 76 C52 79 48 79 44 76 Z', fill: skin });
  layers.push({ kind: 'ellipse', cx: head.cx, cy: head.cy, rx: head.rx, ry: head.ry, fill: skin });
  // Orejas.
  layers.push({ kind: 'circle', cx: head.cx - head.rx, cy: 54, r: 4, fill: skin });
  layers.push({ kind: 'circle', cx: head.cx + head.rx, cy: 54, r: 4, fill: skin });
  if (hair.front) layers.push({ kind: 'path', d: hair.front, fill: hairColor });
  if (hair.extra) layers.push(...hair.extra(hairColor));
  if (blush) {
    layers.push({ kind: 'circle', cx: 37, cy: 59, r: 3.6, fill: '#FF6B8A', opacity: 0.35 });
    layers.push({ kind: 'circle', cx: 63, cy: 59, r: 3.6, fill: '#FF6B8A', opacity: 0.35 });
  }
  layers.push(...eyes);
  if (glasses) {
    layers.push({ kind: 'circle', cx: 42, cy: 52, r: 6.5, stroke: INK, width: 2.2 });
    layers.push({ kind: 'circle', cx: 58, cy: 52, r: 6.5, stroke: INK, width: 2.2 });
    layers.push({ kind: 'path', d: 'M48.5 52 L51.5 52', stroke: INK, width: 2.2 });
  }
  layers.push(...mouth);
  return { bg: color.bg, layers };
}
