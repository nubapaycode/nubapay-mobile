import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { MascotMood } from '@/widgets/types';

/**
 * Mascota "entrada" según cómo viene la venta, con las mismas poses que la Live Activity
 * (`assets/illustrations/mascot-moods/*.svg`, exportadas a `assets/widgets/NubapayMascot*.imageset`):
 * - `waiting`: mira el celular con un globo de "…" que titila y se balancea, esperando;
 * - `selling`: saluda con una mano, rebota suave y parpadea;
 * - `hot`: salta con los brazos arriba entre confeti;
 * - `slow`: duerme respirando lento, con "z" que suben;
 * - `soldout`: corona que se mece y destellos.
 *
 * Cada parte animada va en su propia capa con el mismo viewBox (pivotes en coordenadas del dibujo).
 * Solo timing, sin resortes; con "reducir movimiento" queda quieta. Al cambiar de pose, funde.
 */
const VB_X = 24;
const VB_Y = 40;
const VB_W = 192;
const VB_H = 204;

const LIME = '#c6ff00';
const INK = '#0b0f17';
const WHITE = '#f5f7fa';
const BLUE = '#0069ff';
const SKY = '#6cb0ff';
const SURFACE = '#161b25';
const PINK = '#ff5c9a';
const GOLD = '#ffb020';

const EASE = Easing.inOut(Easing.quad);

export function MoodMascot({
  mood,
  size = 72,
  onLight = false,
}: {
  mood: MascotMood;
  /** Ancho en px (el alto sale de la proporción del dibujo). */
  size?: number;
  /** Sobre fondos claros, brazos, piernas y "z" van oscuros para que se vean. */
  onLight?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const height = (VB_H / VB_W) * size;
  const limb = onLight ? '#2a3140' : WHITE;
  const Pose = POSES[mood];
  return (
    <View
      style={{ width: size, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View
        key={mood}
        entering={reduceMotion ? undefined : FadeIn.duration(280)}
        exiting={reduceMotion ? undefined : FadeOut.duration(160)}
        style={[styles.layer, { width: size, height }]}>
        <Pose size={size} height={height} limb={limb} quiet={reduceMotion} />
      </Animated.View>
    </View>
  );
}

type PoseProps = { size: number; height: number; limb: string; quiet: boolean };

/* ---------- Animación ---------- */

/** 0 → 1 → 0 en loop (ida y vuelta), con demora inicial opcional. */
function useYoyo(ms: number, quiet: boolean, delay = 0) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (quiet) return;
    const half = { duration: ms, easing: EASE };
    v.set(withDelay(delay, withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1, false)));
  }, [ms, quiet, delay, v]);
  return v;
}

/** 0 → 1 en loop, y vuelve a 0 de golpe (para lo que sube y desaparece). */
function useCycle(ms: number, quiet: boolean, delay = 0) {
  const v = useSharedValue(quiet ? 0.5 : 0);
  useEffect(() => {
    if (quiet) return;
    v.set(
      withDelay(
        delay,
        withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: ms, easing: Easing.linear })), -1, false),
      ),
    );
  }, [ms, quiet, delay, v]);
  return v;
}

/** Parpadeo: cada ~3 s los ojos se achican sobre su centro. */
function useBlink(quiet: boolean) {
  const v = useSharedValue(1);
  useEffect(() => {
    if (quiet) return;
    v.set(
      withRepeat(
        withSequence(
          withDelay(2600, withTiming(0.1, { duration: 70, easing: Easing.in(Easing.quad) })),
          withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [quiet, v]);
  return v;
}

/* ---------- Dibujo ---------- */

/** Pivote de una capa en coordenadas del viewBox. */
const pivot = (x: number, y: number) => ({
  transformOrigin: `${((x - VB_X) / VB_W) * 100}% ${((y - VB_Y) / VB_H) * 100}%`,
});

function Layer({
  size,
  height,
  style,
  children,
}: {
  size: number;
  height: number;
  style?: object | object[];
  children: React.ReactNode;
}) {
  return (
    <Animated.View style={[styles.layer, { width: size, height }, style]}>
      <Svg width={size} height={height} viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`} fill="none">
        {children}
      </Svg>
    </Animated.View>
  );
}

const Arm = ({ d, color }: { d: string; color: string }) => (
  <Path d={d} stroke={color} strokeWidth={7} strokeLinecap="round" fill="none" />
);

function Legs({ limb }: { limb: string }) {
  return (
    <G>
      <Arm d="M100 200 L96 232" color={limb} />
      <Arm d="M140 200 L144 232" color={limb} />
      <Rect x="80" y="228" width="24" height="12" rx="6" fill={BLUE} />
      <Rect x="136" y="228" width="24" height="12" rx="6" fill={BLUE} />
    </G>
  );
}

function Body() {
  return (
    <G>
      <Path
        d="M70 70 H170 A10 10 0 0 1 180 80 V112 A14 14 0 0 0 180 140 V190 A10 10 0 0 1 170 200 H70 A10 10 0 0 1 60 190 V140 A14 14 0 0 0 60 112 V80 A10 10 0 0 1 70 70 Z"
        fill={LIME}
        stroke={INK}
        strokeWidth={3}
      />
      <Path d="M76 152 H164" stroke={INK} strokeWidth={3} strokeDasharray="6 6" strokeLinecap="round" opacity={0.35} />
    </G>
  );
}

function PhoneArm({ limb }: { limb: string }) {
  return (
    <G>
      <Arm d="M178 130 C196 138 200 154 196 166" color={limb} />
      <Rect x="184" y="160" width="22" height="34" rx="5" fill={SURFACE} stroke={limb} strokeWidth={3} />
      <Rect x="189" y="166" width="12" height="12" rx="2" fill={LIME} />
    </G>
  );
}

function OpenEyes({ px = 3, py = 3 }: { px?: number; py?: number }) {
  return (
    <G>
      <Ellipse cx="100" cy="98" rx="10" ry="12" fill="#ffffff" stroke={INK} strokeWidth={3} />
      <Ellipse cx="140" cy="98" rx="10" ry="12" fill="#ffffff" stroke={INK} strokeWidth={3} />
      <Circle cx={100 + px} cy={98 + py} r="5" fill={INK} />
      <Circle cx={140 + px} cy={98 + py} r="5" fill={INK} />
    </G>
  );
}

const HappyEyes = () => (
  <Path d="M91 101 Q100 89 109 101 M131 101 Q140 89 149 101" stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
);

const Sparkle = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <Path
    d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`}
    fill={GOLD}
  />
);

/** Un elemento que titila (opacidad y escala) desfasado según `delay`. */
function Twinkle({
  size,
  height,
  quiet,
  delay,
  at,
  children,
}: {
  size: number;
  height: number;
  quiet: boolean;
  delay: number;
  at: [number, number];
  children: React.ReactNode;
}) {
  const t = useYoyo(450, quiet, delay);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * t.value,
    transform: [{ scale: 0.75 + 0.25 * t.value }],
  }));
  return (
    <Layer size={size} height={height} style={[pivot(at[0], at[1]), style]}>
      {children}
    </Layer>
  );
}

/* ---------- Poses ---------- */

function Waiting({ size, height, limb, quiet }: PoseProps) {
  const sway = useYoyo(1400, quiet);
  const blink = useBlink(quiet);
  const body = useAnimatedStyle(() => ({ transform: [{ rotate: `${-3 + 6 * sway.value}deg` }] }));
  const eyes = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  return (
    <Animated.View style={[styles.layer, { width: size, height }, pivot(120, 240), body]}>
      <Layer size={size} height={height}>
        <Legs limb={limb} />
        <PhoneArm limb={limb} />
        <Arm d="M62 130 C48 140 46 158 50 172" color={limb} />
        <Circle cx="50" cy="176" r="9" fill={limb} />
        <Body />
        <Path d="M110 115 H130" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <Rect x="30" y="46" width="50" height="26" rx="13" fill={WHITE} />
        <Path d="M58 70 L66 80 L68 70 Z" fill={WHITE} />
      </Layer>
      <Layer size={size} height={height} style={[pivot(120, 98), eyes]}>
        <OpenEyes px={5} py={5} />
      </Layer>
      {[44, 55, 66].map((cx, i) => (
        <Twinkle key={cx} size={size} height={height} quiet={quiet} delay={i * 180} at={[cx, 59]}>
          <Circle cx={cx} cy="59" r="3.5" fill={INK} />
        </Twinkle>
      ))}
    </Animated.View>
  );
}

function Selling({ size, height, limb, quiet }: PoseProps) {
  const bob = useYoyo(800, quiet);
  const wave = useYoyo(400, quiet);
  const blink = useBlink(quiet);
  const k = size / VB_W;
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * k * bob.value }] }));
  const arm = useAnimatedStyle(() => ({ transform: [{ rotate: `${-22 * wave.value}deg` }] }));
  const eyes = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  return (
    <Animated.View style={[styles.layer, { width: size, height }, body]}>
      <Layer size={size} height={height}>
        <Legs limb={limb} />
        <PhoneArm limb={limb} />
      </Layer>
      <Layer size={size} height={height} style={[pivot(62, 118), arm]}>
        <Arm d="M62 118 C44 108 36 90 40 72" color={limb} />
        <Circle cx="40" cy="68" r="9" fill={limb} />
      </Layer>
      <Layer size={size} height={height}>
        <Body />
        <Path d="M108 114 Q120 124 132 114" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
      </Layer>
      <Layer size={size} height={height} style={[pivot(120, 98), eyes]}>
        <OpenEyes />
      </Layer>
    </Animated.View>
  );
}

const CONFETTI: { at: [number, number]; node: React.ReactNode }[] = [
  { at: [39, 137], node: <Rect x="34" y="132" width="10" height="10" rx="2" fill={BLUE} transform="rotate(20 39 137)" /> },
  { at: [202, 133], node: <Rect x="196" y="130" width="12" height="6" rx="3" fill={LIME} transform="rotate(-30 202 133)" /> },
  { at: [64, 52], node: <Circle cx="64" cy="52" r="5" fill={PINK} /> },
  { at: [178, 50], node: <Circle cx="178" cy="50" r="4" fill={LIME} /> },
  { at: [205, 181], node: <Rect x="200" y="176" width="10" height="10" rx="2" fill={SKY} transform="rotate(35 205 181)" /> },
  { at: [36, 188], node: <Rect x="30" y="186" width="12" height="5" rx="2.5" fill={GOLD} transform="rotate(15 36 188)" /> },
  { at: [120, 50], node: <Circle cx="120" cy="50" r="3.5" fill={SKY} /> },
];

function Hot({ size, height, limb, quiet }: PoseProps) {
  const jump = useYoyo(260, quiet);
  const k = size / VB_W;
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: -14 * k * jump.value }] }));
  const left = useAnimatedStyle(() => ({ transform: [{ rotate: `${-12 * jump.value}deg` }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ rotate: `${12 * jump.value}deg` }] }));
  return (
    <View style={[styles.layer, { width: size, height }]}>
      {CONFETTI.map((c, i) => (
        <Twinkle key={i} size={size} height={height} quiet={quiet} delay={i * 110} at={c.at}>
          {c.node}
        </Twinkle>
      ))}
      <Animated.View style={[styles.layer, { width: size, height }, body]}>
        <Layer size={size} height={height}>
          <Legs limb={limb} />
        </Layer>
        <Layer size={size} height={height} style={[pivot(62, 116), left]}>
          <Arm d="M62 116 C46 100 40 84 42 66" color={limb} />
          <Circle cx="42" cy="62" r="9" fill={limb} />
        </Layer>
        <Layer size={size} height={height} style={[pivot(178, 116), right]}>
          <Arm d="M178 116 C194 100 200 84 198 66" color={limb} />
          <Circle cx="198" cy="62" r="9" fill={limb} />
        </Layer>
        <Layer size={size} height={height}>
          <Body />
          <HappyEyes />
          <Path d="M104 111 Q120 132 136 111 Z" fill={INK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M112 120 Q120 127 128 120" fill={PINK} />
        </Layer>
      </Animated.View>
    </View>
  );
}

/** "z" que sube y se desvanece. */
function FloatingZ({
  size,
  height,
  quiet,
  delay,
  x,
  y,
  s,
  color,
}: {
  size: number;
  height: number;
  quiet: boolean;
  delay: number;
  x: number;
  y: number;
  s: number;
  color: string;
}) {
  const p = useCycle(2200, quiet, delay);
  const k = size / VB_W;
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.2 ? p.value / 0.2 : 1 - (p.value - 0.2) / 0.8,
    transform: [{ translateY: -14 * k * p.value }, { translateX: 6 * k * p.value }],
  }));
  return (
    <Layer size={size} height={height} style={style}>
      <Path
        d={`M${x} ${y} h${s} l-${s} ${s} h${s}`}
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Layer>
  );
}

function Slow({ size, height, limb, quiet }: PoseProps) {
  const breathe = useYoyo(1600, quiet);
  const body = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - 0.03 * breathe.value }] }));
  return (
    <View style={[styles.layer, { width: size, height }]}>
      <Animated.View style={[styles.layer, { width: size, height }, pivot(120, 240), body]}>
        <Layer size={size} height={height}>
          <Legs limb={limb} />
          <Arm d="M62 130 C48 140 46 158 50 172" color={limb} />
          <Circle cx="50" cy="176" r="9" fill={limb} />
          <Arm d="M178 130 C192 140 194 158 190 172" color={limb} />
          <Circle cx="190" cy="176" r="9" fill={limb} />
          <Body />
          <Path d="M91 99 Q100 106 109 99 M131 99 Q140 106 149 99" stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
          <Ellipse cx="120" cy="117" rx="4.5" ry="5.5" fill={INK} />
        </Layer>
      </Animated.View>
      <FloatingZ size={size} height={height} quiet={quiet} delay={0} x={176} y={60} s={14} color={limb} />
      <FloatingZ size={size} height={height} quiet={quiet} delay={1100} x={198} y={44} s={9} color={limb} />
    </View>
  );
}

function SoldOut({ size, height, limb, quiet }: PoseProps) {
  const sway = useYoyo(700, quiet);
  const crown = useAnimatedStyle(() => ({ transform: [{ rotate: `${-6 + 12 * sway.value}deg` }] }));
  return (
    <View style={[styles.layer, { width: size, height }]}>
      <Layer size={size} height={height}>
        <Legs limb={limb} />
        <Arm d="M62 128 C44 126 42 148 60 154" color={limb} />
        <Arm d="M178 128 C196 126 198 148 180 154" color={limb} />
        <Circle cx="60" cy="154" r="9" fill={limb} />
        <Circle cx="180" cy="154" r="9" fill={limb} />
        <Body />
        <HappyEyes />
        <Path d="M106 112 Q120 126 134 112" stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      </Layer>
      <Layer size={size} height={height} style={[pivot(120, 72), crown]}>
        <Path
          d="M92 72 L95 48 L108 61 L120 44 L132 61 L145 48 L148 72 Z"
          fill={GOLD}
          stroke={INK}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <Circle cx="120" cy="60" r="3" fill={PINK} />
      </Layer>
      <Twinkle size={size} height={height} quiet={quiet} delay={0} at={[52, 76]}>
        <Sparkle x={52} y={76} s={9} />
      </Twinkle>
      <Twinkle size={size} height={height} quiet={quiet} delay={300} at={[190, 84]}>
        <Sparkle x={190} y={84} s={7} />
      </Twinkle>
      <Twinkle size={size} height={height} quiet={quiet} delay={600} at={[200, 196]}>
        <Sparkle x={200} y={196} s={6} />
      </Twinkle>
    </View>
  );
}

const POSES: Record<MascotMood, (p: PoseProps) => React.ReactElement> = {
  waiting: Waiting,
  selling: Selling,
  hot: Hot,
  slow: Slow,
  soldout: SoldOut,
};

/** Texto corto para acompañar cada pose. */
export const MOOD_LABEL: Record<MascotMood, string> = {
  waiting: 'Esperando la primera venta',
  selling: 'Vendiendo',
  hot: '¡En racha!',
  slow: 'Sin ventas hace media hora',
  soldout: '¡Entradas agotadas!',
};

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
});
