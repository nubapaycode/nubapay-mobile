import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { DisplayFont } from '@/constants/theme';

/** Lienzo original de `assets/illustrations/ticket-mascot.svg`. */
const VB_W = 240;
const VB_H = 260;

const LIME = '#c6ff00';
const INK = '#0b0f17';
const WHITE = '#f5f7fa';
const BLUE = '#0069ff';
const SKY = '#6cb0ff';
const SURFACE = '#161b25';

const HALF_JUMP = { duration: 800, easing: Easing.inOut(Easing.quad) };
const HALF_WAVE = { duration: 400, easing: Easing.inOut(Easing.quad) };

/**
 * Mascota "entrada" de nubapay (react-native-svg + Reanimated, sin resortes): salta suave, saluda
 * con una mano y parpadea de vez en cuando. Cada parte animada va en su propia capa con el mismo
 * viewBox, así los pivotes son los del boceto. Con "reducir movimiento" queda quieta.
 *
 * `onLight` aclara la sombra para usarla sobre fondos blancos.
 */
export function TicketMascot({
  size = 140,
  confetti = true,
  onLight = false,
  still = false,
}: {
  /** Ancho en px (el alto sale de la proporción 240×260). */
  size?: number;
  confetti?: boolean;
  onLight?: boolean;
  still?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const quiet = still || reduceMotion;
  const k = size / VB_W;
  const height = VB_H * k;

  const jump = useSharedValue(0);
  const wave = useSharedValue(0);
  const blink = useSharedValue(1);

  useEffect(() => {
    if (quiet) return;
    jump.set(withRepeat(withSequence(withTiming(1, HALF_JUMP), withTiming(0, HALF_JUMP)), -1, false));
    wave.set(withRepeat(withSequence(withTiming(1, HALF_WAVE), withTiming(0, HALF_WAVE)), -1, false));
    blink.set(
      withRepeat(
        withSequence(
          withDelay(2600, withTiming(0.1, { duration: 70, easing: Easing.in(Easing.quad) })),
          withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [quiet, jump, wave, blink]);

  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -14 * k * jump.value }] }));
  const armStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-22 * wave.value}deg` }] }));
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: (onLight ? 0.28 : 0.5) - (onLight ? 0.12 : 0.2) * jump.value,
    transform: [{ scaleX: 1 - 0.25 * jump.value }],
  }));

  const layer = { width: size, height };
  const svg = (children: React.ReactNode) => (
    <Svg width={size} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} fill="none">
      {children}
    </Svg>
  );

  return (
    <View style={layer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {confetti
        ? svg(
            <G>
              <Rect x="22" y="40" width="10" height="10" rx="2" fill={BLUE} transform="rotate(20 27 45)" />
              <Rect x="196" y="28" width="12" height="6" rx="3" fill={LIME} transform="rotate(-30 202 31)" />
              <Circle cx="210" cy="96" r="5" fill="#ff5c9a" />
              <Circle cx="30" cy="150" r="4" fill={LIME} />
              <Rect x="198" y="168" width="10" height="10" rx="2" fill={SKY} transform="rotate(35 203 173)" />
              <Rect x="40" y="14" width="12" height="5" rx="2.5" fill="#ffb020" transform="rotate(15 46 16)" />
            </G>,
          )
        : null}

      {/* Sombra: se achica y aclara cuando la entrada sube. */}
      <Animated.View style={[styles.layer, layer, pivot(120, 246), shadowStyle]}>
        {svg(<Ellipse cx="120" cy="246" rx="58" ry="8" fill="#000000" />)}
      </Animated.View>

      <Animated.View style={[styles.layer, layer, bodyStyle]}>
        {/* Piernas y brazo con el celular (QR). */}
        <View style={[styles.layer, layer]}>
          {svg(
            <G>
              <Path d="M100 200 L96 232" stroke={WHITE} strokeWidth={7} strokeLinecap="round" />
              <Path d="M140 200 L144 232" stroke={WHITE} strokeWidth={7} strokeLinecap="round" />
              <Rect x="80" y="228" width="24" height="12" rx="6" fill={BLUE} />
              <Rect x="136" y="228" width="24" height="12" rx="6" fill={BLUE} />
              <Path d="M178 130 C196 138 200 154 196 166" stroke={WHITE} strokeWidth={7} strokeLinecap="round" />
              <Rect x="184" y="160" width="22" height="34" rx="5" fill={SURFACE} stroke={WHITE} strokeWidth={3} />
              <Rect x="189" y="166" width="12" height="12" rx="2" fill={LIME} />
            </G>,
          )}
        </View>

        {/* Brazo que saluda: gira sobre el hombro (62, 118). */}
        <Animated.View style={[styles.layer, layer, pivot(62, 118), armStyle]}>
          {svg(
            <G>
              <Path d="M62 118 C44 108 36 90 40 72" stroke={WHITE} strokeWidth={7} strokeLinecap="round" />
              <Circle cx="40" cy="68" r="9" fill={WHITE} />
            </G>,
          )}
        </Animated.View>

        {/* Cuerpo: la entrada con muescas, la boca y el texto impreso. */}
        <View style={[styles.layer, layer]}>
          {svg(
            <G>
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
              <Path d="M108 112 Q120 122 132 112" stroke={INK} strokeWidth={3} strokeLinecap="round" />
              <SvgText
                x="120"
                y="168"
                textAnchor="middle"
                fontFamily={DisplayFont.extrabold}
                fontSize="20"
                fill={INK}>
                ADMIT 1
              </SvgText>
              <SvgText
                x="120"
                y="186"
                textAnchor="middle"
                fontWeight="600"
                fontSize="9"
                letterSpacing="2"
                fill={INK}
                opacity={0.6}>
                NUBAPAY
              </SvgText>
            </G>,
          )}
        </View>

        {/* Ojos: parpadean achicándose sobre su centro (y = 98). */}
        <Animated.View style={[styles.layer, layer, pivot(120, 98), eyesStyle]}>
          {svg(
            <G>
              <Ellipse cx="100" cy="98" rx="10" ry="12" fill="#ffffff" stroke={INK} strokeWidth={3} />
              <Ellipse cx="140" cy="98" rx="10" ry="12" fill="#ffffff" stroke={INK} strokeWidth={3} />
              <Circle cx="103" cy="101" r="5" fill={INK} />
              <Circle cx="143" cy="101" r="5" fill={INK} />
            </G>,
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Pivote de una capa en coordenadas del viewBox. */
const pivot = (x: number, y: number) => ({
  transformOrigin: `${(x / VB_W) * 100}% ${(y / VB_H) * 100}%`,
});

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0 },
});
