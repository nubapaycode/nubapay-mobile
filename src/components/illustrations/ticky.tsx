import { useEffect } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

/** Lienzo de `assets/illustrations/ticky.svg`. */
const VB_W = 240;
const VB_H = 260;

const LIME = "#c6ff00";
const INK = "#0b0f17";
const WHITE = "#f5f7fa";
const BLUE = "#0069ff";
const SKY = "#6cb0ff";
const SURFACE = "#161b25";
const PINK = "#ff5c9a";
const GOLD = "#ffb020";

/**
 * Poses de Ticky, la mascota "entrada" de nubapay:
 * - `idle`: respira, se balancea apenas y mira alrededor;
 * - `wave`: saluda con la mano izquierda, rebotando suave;
 * - `celebrate`: salta con los brazos arriba entre confeti;
 * - `think`: se rasca la sien, con una ceja arriba y puntitos de duda;
 * - `sad`: cabizbajo, con una lágrima que resbala;
 * - `scan`: levanta el celular con el QR y lo mira.
 */
export type TickyPose =
  "idle" | "wave" | "celebrate" | "think" | "sad" | "scan";

type Eyes = "open" | "happy";
type Mouth = "smile" | "grin" | "o" | "frown" | "flat";
type Brow = "sad" | "think" | null;

type PoseConfig = {
  /** Ángulos (°) del brazo superior y del antebrazo; el derecho es el espejo del izquierdo. */
  lU: number;
  lF: number;
  rU: number;
  rF: number;
  /** Inclinación del cuerpo (°) y cuánto baja (unidades del dibujo). */
  lean: number;
  drop: number;
  /** Amplitudes de los bucles: antebrazo que saluda, vaivén de brazos a 1× y 2×, respiración, rebote, balanceo. */
  waveAmp: number;
  swing1: number;
  swing2: number;
  breath: number;
  hop: number;
  sway: number;
  /** Hacia dónde miran las pupilas y cuánto "miran alrededor". */
  pupX: number;
  pupY: number;
  look: number;
  eyes: Eyes;
  mouth: Mouth;
  brow: Brow;
};

const BASE: PoseConfig = {
  lU: 3,
  lF: 0,
  rU: -3,
  rF: 0,
  lean: 0,
  drop: 0,
  waveAmp: 0,
  swing1: 2.5,
  swing2: 0,
  breath: 1,
  hop: 0,
  sway: 1.2,
  pupX: 0,
  pupY: 1,
  look: 1,
  eyes: "open",
  mouth: "smile",
  brow: null,
};

const POSES: Record<TickyPose, PoseConfig> = {
  idle: BASE,
  wave: {
    ...BASE,
    lU: 105,
    lF: 58,
    waveAmp: 14,
    swing1: 3,
    hop: 0,
    breath: 1.5,
    sway: 1.5,
    lean: -2,
  },
  celebrate: {
    ...BASE,
    lU: 122,
    lF: 30,
    rU: -125,
    rF: -15,
    swing1: 0,
    swing2: 9,
    hop: 1,
    breath: 0,
    sway: 0,
    look: 0,
    eyes: "happy",
    mouth: "grin",
  },
  think: {
    ...BASE,
    lU: 110,
    lF: 85,
    lean: -4,
    swing1: 1.5,
    sway: 2.6,
    pupX: 3,
    pupY: -4,
    look: 0,
    mouth: "flat",
    brow: "think",
  },
  sad: {
    ...BASE,
    lU: 8,
    lF: 8,
    rU: -8,
    rF: -8,
    drop: 4,
    swing1: 1,
    breath: 1.6,
    sway: 0,
    pupY: 4,
    look: 0,
    mouth: "frown",
    brow: "sad",
  },
  scan: { ...BASE, rU: -8, rF: -28, swing1: 1.2, pupX: 4, pupY: 0, look: 0 },
};

/** Una vuelta del reloj maestro; todos los bucles son múltiplos enteros, así nunca se desfasan. */
const PERIOD = 2400;
const HOP_PX = 24;
const TAU = Math.PI * 2;
const MOVE = Easing.bezier(0.4, 0, 0.2, 1);

/* Curva del salto (2 por vuelta): agacharse → impulso → aire → caída → amortiguar. */
const HOP_P = [0, 0.18, 0.26, 0.34, 0.5, 0.66, 0.74, 0.82, 0.9, 1];
const HOP_H = [0, 0, 0.4375, 0.75, 1, 0.75, 0.4375, 0, 0, 0];
const SQ_P = [0, 0.1, 0.18, 0.26, 0.5, 0.74, 0.82, 0.9, 1];
const SQ_Y = [1, 0.9, 0.9, 1.08, 1.04, 1, 0.88, 0.96, 1];

const UP_L = "M64 126 C58 133 52 140 47 146";
const FO_L = "M47 146 C46 154 45 162 45 170";
const UP_R = "M176 126 C182 133 188 140 193 146";
const FO_R = "M193 146 C194 160 195 172 195 182";
const FINGERS = "M-7 4 L-9 15 M-2.5 6 L-3 18 M2.5 6 L3 18 M7 4 L9 15";
const LEG_L = "M101 198 C103 211 95 217 96 230";
const LEG_R = "M139 198 C137 211 145 217 144 230";

type Dim = { size: number; height: number };

function Sv({ d, children }: { d: Dim; children: ReactNode }) {
  return (
    <Svg
      width={d.size}
      height={d.height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      fill="none"
    >
      {children}
    </Svg>
  );
}

/** Capa con el tamaño del lienzo; `origin` fija el pivote en coordenadas del dibujo. */
function Ly({
  d,
  style,
  origin,
  children,
}: {
  d: Dim;
  style?: object;
  origin?: [number, number];
  children?: ReactNode;
}) {
  return (
    <Animated.View
      style={[
        styles.layer,
        { width: d.size, height: d.height },
        origin ? pivot(origin[0], origin[1]) : null,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Funde una parte de la cara cuando entra o sale de la pose. */
function Fade({
  on,
  d,
  children,
}: {
  on: boolean;
  d: Dim;
  children: ReactNode;
}) {
  const o = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    o.set(
      withTiming(on ? 1 : 0, {
        duration: 200,
        easing: Easing.inOut(Easing.quad),
      }),
    );
  }, [on, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Ly d={d} style={style}>
      <Sv d={d}>{children}</Sv>
    </Ly>
  );
}

const Limb = ({ d, stroke }: { d: string; stroke: "ink" | "white" }) => (
  <Path
    d={d}
    stroke={stroke === "ink" ? INK : WHITE}
    strokeWidth={stroke === "ink" ? 11 : 5}
    strokeLinecap="round"
  />
);

function LeftHand() {
  return (
    <G transform="translate(45 170)">
      <G
        stroke={INK}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={INK}
      >
        <Path d={FINGERS} />
        <Path d="M-8 -2 L-14 2" />
        <Ellipse cx="0" cy="0" rx="11" ry="10" />
      </G>
      <G
        stroke={WHITE}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={WHITE}
      >
        <Path d={FINGERS} />
        <Path d="M-8 -2 L-14 2" />
        <Ellipse cx="0" cy="0" rx="9" ry="8" />
      </G>
    </G>
  );
}

function PhoneHand() {
  return (
    <G>
      <Rect
        x="184"
        y="156"
        width="22"
        height="34"
        rx="5"
        fill={SURFACE}
        stroke={WHITE}
        strokeWidth={3}
      />
      <Rect x="188" y="161" width="14" height="14" rx="2" fill={LIME} />
      <Path
        d="M191 164 h3 v3 h-3 z M196 164 h3 v3 h-3 z M191 169 h3 v3 h-3 z M197 170 h2 v2 h-2 z"
        fill={INK}
      />
      <Rect x="191" y="182" width="8" height="2.5" rx="1.25" fill={SKY} />
      <Path
        d="M185 184 C185 179 191 177 196 179 C201 181 203 187 200 190 C197 193 189 193 186 190 C185 188 185 186 185 184 Z"
        fill={WHITE}
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path
        d="M189 182 V188 M193 181.5 V189 M197 182 V188"
        stroke={INK}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.45}
      />
    </G>
  );
}

/** "ADMIT 1" a trazos (sin depender de fuentes), centrado sobre la entrada. */
function Admit() {
  return (
    <G
      transform="translate(77 162)"
      stroke={INK}
      strokeWidth={4.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M1 12 L6 0 L11 12 M3 8.5 H9" />
      <Path d="M18 0 V12 H21 C26 12 27 9 27 6 C27 3 26 0 21 0 Z" />
      <Path d="M34 12 V0 L40 8 L46 0 V12" />
      <Path d="M53 0 V12" />
      <Path d="M60 0 H70 M65 0 V12" />
      <Path d="M81 3 L85 0 V12" />
    </G>
  );
}

/**
 * Ticky (react-native-svg + Reanimated, sin resortes). Cada articulación es su propia capa con el
 * mismo viewBox, así los pivotes son coordenadas del dibujo: hombro → codo en los brazos, pies en el
 * cuerpo. Un reloj maestro lineal mueve los bucles con senos (arranque y frenado suaves), y al cambiar
 * de `pose` los ángulos y las amplitudes se interpolan, de modo que pasa de una a otra sin cortes.
 * El salto agacha, estira y amortigua; los brazos van con retraso respecto del cuerpo.
 * Con "reducir movimiento" queda quieta en la pose.
 *
 * `onLight` aclara la sombra para usarla sobre fondos blancos.
 */
export function Ticky({
  size = 140,
  pose = "wave",
  confetti = true,
  onLight = false,
  still = false,
}: {
  /** Ancho en px (el alto sale de la proporción 240×260). */
  size?: number;
  pose?: TickyPose;
  confetti?: boolean;
  onLight?: boolean;
  still?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const quiet = still || reduceMotion;
  const k = size / VB_W;
  const d: Dim = { size, height: VB_H * k };
  const cfg = POSES[pose];

  const t = useSharedValue(0);
  const blink = useSharedValue(1);
  const glance = useSharedValue(0);

  const lU = useSharedValue(cfg.lU);
  const lF = useSharedValue(cfg.lF);
  const rU = useSharedValue(cfg.rU);
  const rF = useSharedValue(cfg.rF);
  const lean = useSharedValue(cfg.lean);
  const drop = useSharedValue(cfg.drop);
  const waveAmp = useSharedValue(cfg.waveAmp);
  const swing1 = useSharedValue(cfg.swing1);
  const swing2 = useSharedValue(cfg.swing2);
  const breath = useSharedValue(cfg.breath);
  const hop = useSharedValue(cfg.hop);
  const sway = useSharedValue(cfg.sway);
  const pupX = useSharedValue(cfg.pupX);
  const pupY = useSharedValue(cfg.pupY);
  const look = useSharedValue(cfg.look);

  // Reloj maestro, parpadeos irregulares (uno doble) y mirada que se pasea.
  useEffect(() => {
    if (quiet) return;
    t.set(
      withRepeat(
        withTiming(1, { duration: PERIOD, easing: Easing.linear }),
        -1,
        false,
      ),
    );
    const lid = () =>
      withSequence(
        withTiming(0.08, { duration: 80, easing: Easing.in(Easing.quad) }),
        withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
      );
    blink.set(
      withRepeat(
        withSequence(
          withDelay(2300, lid()),
          withDelay(3600, lid()),
          withDelay(1900, lid()),
          withDelay(180, lid()),
        ),
        -1,
        false,
      ),
    );
    const ease = Easing.inOut(Easing.sin);
    glance.set(
      withRepeat(
        withSequence(
          withDelay(1800, withTiming(1, { duration: 600, easing: ease })),
          withDelay(1400, withTiming(-1, { duration: 700, easing: ease })),
          withDelay(1300, withTiming(0, { duration: 500, easing: ease })),
        ),
        -1,
        false,
      ),
    );
  }, [quiet, t, blink, glance]);

  // Cambio de pose: todo se interpola hacia los nuevos valores.
  useEffect(() => {
    const to = (v: typeof lU, n: number, ms = 620) =>
      v.set(quiet ? n : withTiming(n, { duration: ms, easing: MOVE }));
    to(lU, cfg.lU);
    to(lF, cfg.lF);
    to(rU, cfg.rU);
    to(rF, cfg.rF);
    to(lean, cfg.lean);
    to(drop, cfg.drop);
    to(waveAmp, cfg.waveAmp);
    to(swing1, cfg.swing1);
    to(swing2, cfg.swing2);
    to(breath, cfg.breath);
    to(hop, cfg.hop);
    to(sway, cfg.sway);
    to(pupX, cfg.pupX, 360);
    to(pupY, cfg.pupY, 360);
    to(look, cfg.look, 360);
  }, [
    cfg,
    quiet,
    lU,
    lF,
    rU,
    rF,
    lean,
    drop,
    waveAmp,
    swing1,
    swing2,
    breath,
    hop,
    sway,
    pupX,
    pupY,
    look,
  ]);

  const bodyStyle = useAnimatedStyle(() => {
    const p = (t.value * 2) % 1;
    const h = interpolate(p, HOP_P, HOP_H, Extrapolation.CLAMP) * hop.value;
    const sy =
      1 +
      (interpolate(p, SQ_P, SQ_Y, Extrapolation.CLAMP) - 1) * hop.value +
      breath.value * 0.014 * Math.sin(TAU * t.value);
    return {
      transform: [
        { translateY: (drop.value - HOP_PX * h) * k },
        { rotate: `${lean.value + sway.value * Math.sin(TAU * t.value)}deg` },
        { scaleX: 1 + (1 - sy) * 0.6 },
        { scaleY: sy },
      ],
    };
  });

  const shadowStyle = useAnimatedStyle(() => {
    const p = (t.value * 2) % 1;
    const h = interpolate(p, HOP_P, HOP_H, Extrapolation.CLAMP) * hop.value;
    const base = onLight ? 0.28 : 0.5;
    return {
      opacity: base - (onLight ? 0.14 : 0.24) * h,
      transform: [{ scaleX: 1 - 0.3 * h }],
    };
  });

  // Los brazos van un poco por detrás del cuerpo (seguimiento) y el derecho es el espejo del izquierdo.
  const swingOf = (phase: number) => {
    "worklet";
    return (
      swing1.value * Math.sin(TAU * t.value + phase) +
      swing2.value * Math.sin(TAU * (2 * t.value - 0.1) + phase)
    );
  };
  const upL = useAnimatedStyle(() => ({
    transform: [{ rotate: `${lU.value + swingOf(1)}deg` }],
  }));
  const foreL = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${lF.value + waveAmp.value * Math.sin(TAU * 3 * t.value) + 0.8 * swing1.value * Math.sin(TAU * t.value + 1.7)}deg`,
      },
    ],
  }));
  const upR = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rU.value - swingOf(2.4)}deg` }],
  }));
  const foreR = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${rF.value - 0.8 * swing1.value * Math.sin(TAU * t.value + 3.1)}deg`,
      },
    ],
  }));

  const eyesStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blink.value }],
  }));
  const pupilStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (pupX.value + look.value * glance.value * 2.6) * k },
      { translateY: pupY.value * k },
    ],
  }));
  const confettiStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 3 * k * Math.sin(TAU * t.value) }],
  }));

  const rain = (offset: number) => {
    "worklet";
    return {
      transform: [{ translateY: -10 * k + 46 * k * ((t.value + offset) % 1) }],
      opacity: Math.sin(Math.PI * ((t.value + offset) % 1)),
    };
  };
  const rainA = useAnimatedStyle(() => rain(0));
  const rainB = useAnimatedStyle(() => rain(0.5));
  const tearStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 18 * k * (t.value % 1) }],
    opacity: Math.sin(Math.PI * (t.value % 1)),
  }));
  const dot = (i: number) => {
    "worklet";
    return {
      opacity: Math.min(
        1,
        Math.max(0, Math.sin(TAU * (t.value - i * 0.1)) * 2.2),
      ),
    };
  };
  const dot0 = useAnimatedStyle(() => dot(0));
  const dot1 = useAnimatedStyle(() => dot(1));
  const dot2 = useAnimatedStyle(() => dot(2));

  const celebrate = pose === "celebrate";
  const think = pose === "think";
  const sad = pose === "sad";

  return (
    <View
      style={d_(d)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {confetti ? (
        <Ly d={d} style={confettiStyle}>
          <Sv d={d}>
            <Rect
              x="22"
              y="40"
              width="10"
              height="10"
              rx="2"
              fill={BLUE}
              transform="rotate(20 27 45)"
            />
            <Rect
              x="196"
              y="28"
              width="12"
              height="6"
              rx="3"
              fill={LIME}
              transform="rotate(-30 202 31)"
            />
            <Circle cx="210" cy="96" r="5" fill={PINK} />
            <Circle cx="30" cy="150" r="4" fill={LIME} />
            <Rect
              x="198"
              y="168"
              width="10"
              height="10"
              rx="2"
              fill={SKY}
              transform="rotate(35 203 173)"
            />
            <Rect
              x="40"
              y="14"
              width="12"
              height="5"
              rx="2.5"
              fill={GOLD}
              transform="rotate(15 46 16)"
            />
          </Sv>
        </Ly>
      ) : null}

      {celebrate ? (
        <>
          <Ly d={d} style={rainA}>
            <Sv d={d}>
              <Rect
                x="28"
                y="70"
                width="8"
                height="8"
                rx="2"
                fill={PINK}
                transform="rotate(25 32 74)"
              />
              <Rect
                x="204"
                y="62"
                width="10"
                height="5"
                rx="2.5"
                fill={SKY}
                transform="rotate(-25 209 64)"
              />
              <Circle cx="16" cy="118" r="4" fill={GOLD} />
            </Sv>
          </Ly>
          <Ly d={d} style={rainB}>
            <Sv d={d}>
              <Rect
                x="218"
                y="116"
                width="8"
                height="8"
                rx="2"
                fill={LIME}
                transform="rotate(15 222 120)"
              />
              <Rect
                x="14"
                y="40"
                width="10"
                height="5"
                rx="2.5"
                fill={BLUE}
                transform="rotate(30 19 42)"
              />
              <Circle cx="192" cy="40" r="4" fill={PINK} />
            </Sv>
          </Ly>
        </>
      ) : null}

      {/* Sombra: se achica y aclara cuando la entrada sube. */}
      <Ly d={d} origin={[120, 246]} style={shadowStyle}>
        <Sv d={d}>
          <Ellipse cx="120" cy="246" rx="58" ry="8" fill="#000000" />
        </Sv>
      </Ly>

      {/* Todo el cuerpo gira, respira y se agacha sobre los pies (120, 242). */}
      <Ly d={d} origin={[120, 242]} style={bodyStyle}>
        <Ly d={d}>
          <Sv d={d}>
            <Limb d={LEG_L} stroke="ink" />
            <Limb d={LEG_R} stroke="ink" />
            <Limb d={LEG_L} stroke="white" />
            <Limb d={LEG_R} stroke="white" />
            <Rect
              x="76"
              y="234"
              width="34"
              height="8"
              rx="4"
              fill={WHITE}
              stroke={INK}
              strokeWidth={3}
            />
            <Path
              d="M84 235 V230 C84 225 88 223 93 223 H98 C103 223 105 228 109 232 C110 234 109 235 107 235 Z"
              fill={BLUE}
              stroke={INK}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <Path
              d="M95 227 L100 229 M93 230 L98 232"
              stroke={WHITE}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Rect
              x="130"
              y="234"
              width="34"
              height="8"
              rx="4"
              fill={WHITE}
              stroke={INK}
              strokeWidth={3}
            />
            <Path
              d="M156 235 V230 C156 225 152 223 147 223 H142 C137 223 135 228 131 232 C130 234 131 235 133 235 Z"
              fill={BLUE}
              stroke={INK}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <Path
              d="M145 227 L140 229 M147 230 L142 232"
              stroke={WHITE}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Sv>
        </Ly>

        {/* Cuerpo: la entrada con muescas, la línea punteada y el texto. */}
        <Ly d={d}>
          <Sv d={d}>
            <Path
              d="M70 70 H170 A10 10 0 0 1 180 80 V112 A14 14 0 0 0 180 140 V190 A10 10 0 0 1 170 200 H70 A10 10 0 0 1 60 190 V140 A14 14 0 0 0 60 112 V80 A10 10 0 0 1 70 70 Z"
              fill={LIME}
              stroke={INK}
              strokeWidth={3}
            />
            <Path
              d="M76 126 H164"
              stroke={INK}
              strokeWidth={3}
              strokeDasharray="6 6"
              strokeLinecap="round"
              opacity={0.35}
            />
            <Admit />
          </Sv>
        </Ly>

        {/* Cara. */}
        <FadeEyes
          on={cfg.eyes === "open"}
          d={d}
          eyesStyle={eyesStyle}
          pupilStyle={pupilStyle}
        />
        <Fade on={cfg.eyes === "happy"} d={d}>
          <G stroke={INK} strokeWidth={3.5} strokeLinecap="round">
            <Path d="M91 101 Q100 90 109 101" />
            <Path d="M131 101 Q140 90 149 101" />
          </G>
        </Fade>
        <Fade on={cfg.brow === "sad"} d={d}>
          <G stroke={INK} strokeWidth={3} strokeLinecap="round">
            <Path d="M90 84 L109 77" />
            <Path d="M150 84 L131 77" />
          </G>
        </Fade>
        <Fade on={cfg.brow === "think"} d={d}>
          <G stroke={INK} strokeWidth={3} strokeLinecap="round">
            <Path d="M91 82 L109 84" />
            <Path d="M131 76 L149 71" />
          </G>
        </Fade>
        <Fade on={cfg.mouth === "smile"} d={d}>
          <Path
            d="M108 112 Q120 122 132 112"
            stroke={INK}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Fade>
        <Fade on={cfg.mouth === "grin"} d={d}>
          <Path
            d="M106 109 Q120 132 134 109 Z"
            fill={INK}
            stroke={INK}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Ellipse cx="120" cy="119" rx="6" ry="3" fill={PINK} />
        </Fade>
        <Fade on={cfg.mouth === "o"} d={d}>
          <Ellipse cx="120" cy="116" rx="4" ry="5" fill={INK} />
        </Fade>
        <Fade on={cfg.mouth === "frown"} d={d}>
          <Path
            d="M109 119 Q120 109 131 119"
            stroke={INK}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Fade>
        <Fade on={cfg.mouth === "flat"} d={d}>
          <Path
            d="M110 116 Q120 114 130 117"
            stroke={INK}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Fade>

        {sad ? (
          <Ly d={d} style={tearStyle}>
            <Sv d={d}>
              <Path
                d="M152 108 C149 113 148 116 152 118 C156 116 155 113 152 108 Z"
                fill={SKY}
              />
            </Sv>
          </Ly>
        ) : null}

        {/* Brazo derecho (con el celular): hombro (176, 126) → codo (193, 146). */}
        <Ly d={d} origin={[176, 126]} style={upR}>
          <Sv d={d}>
            <Limb d={UP_R} stroke="ink" />
          </Sv>
          <Ly d={d} origin={[193, 146]} style={foreR}>
            <Sv d={d}>
              <Limb d={FO_R} stroke="ink" />
            </Sv>
          </Ly>
          <Ly d={d}>
            <Sv d={d}>
              <Limb d={UP_R} stroke="white" />
            </Sv>
          </Ly>
          <Ly d={d} origin={[193, 146]} style={foreR}>
            <Sv d={d}>
              <Limb d={FO_R} stroke="white" />
              <PhoneHand />
            </Sv>
          </Ly>
        </Ly>

        {/* Brazo izquierdo (mano con dedos): hombro (64, 126) → codo (47, 146). */}
        <Ly d={d} origin={[64, 126]} style={upL}>
          <Sv d={d}>
            <Limb d={UP_L} stroke="ink" />
          </Sv>
          <Ly d={d} origin={[47, 146]} style={foreL}>
            <Sv d={d}>
              <Limb d={FO_L} stroke="ink" />
            </Sv>
          </Ly>
          <Ly d={d}>
            <Sv d={d}>
              <Limb d={UP_L} stroke="white" />
            </Sv>
          </Ly>
          <Ly d={d} origin={[47, 146]} style={foreL}>
            <Sv d={d}>
              <Limb d={FO_L} stroke="white" />
              <LeftHand />
            </Sv>
          </Ly>
        </Ly>

        {think ? (
          <>
            <Ly d={d} style={dot0}>
              <Sv d={d}>
                <Circle cx="150" cy="54" r="3" fill={SKY} />
              </Sv>
            </Ly>
            <Ly d={d} style={dot1}>
              <Sv d={d}>
                <Circle cx="164" cy="44" r="4" fill={SKY} />
              </Sv>
            </Ly>
            <Ly d={d} style={dot2}>
              <Sv d={d}>
                <Circle cx="181" cy="36" r="5" fill={SKY} />
              </Sv>
            </Ly>
          </>
        ) : null}
      </Ly>
    </View>
  );
}

/** Ojos abiertos: se funden con la pose, parpadean sobre su centro (y = 98) y las pupilas se mueven. */
function FadeEyes({
  on,
  d,
  eyesStyle,
  pupilStyle,
}: {
  on: boolean;
  d: Dim;
  eyesStyle: object;
  pupilStyle: object;
}) {
  const o = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    o.set(
      withTiming(on ? 1 : 0, {
        duration: 200,
        easing: Easing.inOut(Easing.quad),
      }),
    );
  }, [on, o]);
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Ly d={d} style={fade}>
      <Ly d={d} origin={[120, 98]} style={eyesStyle}>
        <Sv d={d}>
          <Ellipse
            cx="100"
            cy="98"
            rx="10"
            ry="12"
            fill="#ffffff"
            stroke={INK}
            strokeWidth={3}
          />
          <Ellipse
            cx="140"
            cy="98"
            rx="10"
            ry="12"
            fill="#ffffff"
            stroke={INK}
            strokeWidth={3}
          />
        </Sv>
        <Ly d={d} style={pupilStyle}>
          <Sv d={d}>
            <Circle cx="100" cy="98" r="5" fill={INK} />
            <Circle cx="140" cy="98" r="5" fill={INK} />
          </Sv>
        </Ly>
      </Ly>
    </Ly>
  );
}

const d_ = (d: Dim) => ({ width: d.size, height: d.height });

/** Pivote de una capa en coordenadas del viewBox. */
const pivot = (x: number, y: number) => ({
  transformOrigin: `${(x / VB_W) * 100}% ${(y / VB_H) * 100}%`,
});

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0 },
});
