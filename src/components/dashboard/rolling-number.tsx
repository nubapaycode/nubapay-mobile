import { useEffect } from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  Easing,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Mismo ritmo que los fundidos: 1200 ms, arranca y frena gradualmente. */
const ROLL = { duration: 1200, easing: Easing.inOut(Easing.cubic) };

type Props = {
  value: number;
  format: (n: number) => string;
  /** Debe incluir `fontSize`; `lineHeight` fija el alto de cada rodillo. */
  style: TextStyle;
};

/**
 * Cifra con dígitos que ruedan (patrón NumberFlow / tickers de trading): solo giran los dígitos que
 * cambian; separadores y símbolo quedan fijos. Con "reducir movimiento" el valor cambia sin animar.
 */
export function RollingNumber({ value, format, style }: Props) {
  const text = format(value);
  const chars = [...text];
  const flat = StyleSheet.flatten(style) ?? {};
  const lh = flat.lineHeight ?? Math.round((flat.fontSize ?? 16) * 1.15);
  const textStyle: TextStyle[] = [style, styles.tabular, { lineHeight: lh, height: lh }];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
      style={[styles.row, { height: lh }]}>
      {chars.map((ch, i) => {
        // Clave por posición desde la derecha: unidades, decenas… conservan su rodillo al crecer la cifra.
        const pos = chars.length - i;
        return /\d/.test(ch) ? (
          <Digit key={`d${pos}`} digit={Number(ch)} lh={lh} pos={pos} style={textStyle} />
        ) : (
          <Text key={`s${pos}${ch}`} style={textStyle}>
            {ch}
          </Text>
        );
      })}
    </View>
  );
}

function Digit({
  digit,
  lh,
  pos,
  style,
}: {
  digit: number;
  lh: number;
  pos: number;
  style: TextStyle[];
}) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(reduceMotion ? -digit * lh : 0);

  useEffect(() => {
    const to = -digit * lh;
    // Al montar, los dígitos de mayor peso arrancan apenas antes: la cifra "se arma" de izquierda a derecha.
    y.set(reduceMotion ? to : withDelay(Math.max(0, 12 - pos) * 40, withTiming(to, ROLL)));
  }, [digit, lh, pos, reduceMotion, y]);

  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={{ height: lh, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
      <Animated.View style={roll}>
        {DIGITS.map((d) => (
          <Text key={d} style={style}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  tabular: { fontVariant: ['tabular-nums'] },
});
