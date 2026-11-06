import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Confetti } from '@/components/fx/confetti';
import { DisplayFont, Radius } from '@/constants/theme';
import { formatMoney } from '@/features/dashboard/format';
import { playSaleSound } from '@/lib/sounds';
import { makeStyles, useTheme } from '@/theme';

/* ───────────── Venta que entra ───────────── */

type Burst = { id: number; amount: number };

/**
 * Cuando sube la recaudación en vivo, una moneda con "+ $X" sube desde la cifra y se desvanece
 * (con un toque háptico suave). `resetKey` cambia con el período/filtro: ahí el salto no es una
 * venta, así que no se festeja.
 */
export function SaleBurst({ value, live, resetKey }: { value: number; live: boolean; resetKey: string }) {
  const prev = useRef<{ value: number; key: string } | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const id = useRef(0);

  useEffect(() => {
    const p = prev.current;
    prev.current = { value, key: resetKey };
    if (!p || p.key !== resetKey || !live) return;
    const diff = value - p.value;
    if (diff <= 0) return;
    id.current += 1;
    const b = { id: id.current, amount: diff };
    setBursts((l) => [...l.slice(-2), b]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSaleSound();
  }, [value, live, resetKey]);

  if (!bursts.length) return null;
  return (
    <View pointerEvents="none" style={styles.burstLayer} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {bursts.map((b) => (
        <BurstChip key={b.id} amount={b.amount} onEnd={() => setBursts((l) => l.filter((x) => x.id !== b.id))} />
      ))}
    </View>
  );
}

function BurstChip({ amount, onEnd }: { amount: number; onEnd: () => void }) {
  const s = useStyles();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  });

  useEffect(() => {
    t.set(withTiming(1, { duration: reduceMotion ? 900 : 1500, easing: Easing.out(Easing.cubic) }));
    const timer = setTimeout(() => onEndRef.current(), reduceMotion ? 950 : 1550);
    return () => clearTimeout(timer);
  }, [t, reduceMotion]);

  const style = useAnimatedStyle(() => {
    const v = t.value;
    return {
      opacity: v < 0.15 ? v / 0.15 : v > 0.65 ? (1 - v) / 0.35 : 1,
      transform: [{ translateY: reduceMotion ? 0 : -v * 38 }, { scale: 0.85 + Math.min(1, v * 4) * 0.15 }],
    };
  });

  return (
    <Animated.View style={[s.chip, style]}>
      <View style={s.coin}>
        <Text style={s.coinText}>$</Text>
      </View>
      <Text style={s.chipText}>+ {formatMoney(amount)}</Text>
    </Animated.View>
  );
}

/* ───────────── Hitos de aforo ───────────── */

const MILESTONES = [0.5, 0.75, 1];

/** Hitos que cruzó `ratio` desde el render anterior (solo subiendo; al montar, ninguno). */
function useCrossed(ratio: number | null) {
  const prev = useRef<number | null>(null);
  const [crossed, setCrossed] = useState<{ n: number; list: number[] }>({ n: 0, list: [] });
  useEffect(() => {
    const p = prev.current;
    prev.current = ratio;
    if (p == null || ratio == null || ratio <= p) return;
    const list = MILESTONES.filter((m) => p < m && ratio >= m);
    if (list.length) setCrossed((c) => ({ n: c.n + 1, list }));
  }, [ratio]);
  return crossed;
}

/** Confetti a pantalla completa cuando el evento se agota en vivo (montalo en la raíz de la pantalla). */
export function SoldOutParty({ ratio }: { ratio: number | null }) {
  const crossed = useCrossed(ratio);
  if (!crossed.n || !crossed.list.includes(1)) return null;
  return <Confetti key={crossed.n} seed={crossed.n} />;
}

/**
 * Halo alrededor del anillo de aforo cuando cruza 50%, 75% o se agota (en vivo, no al cargar).
 * `size` es el diámetro del anillo.
 */
export function MilestoneHalo({ ratio, size }: { ratio: number | null; size: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const crossed = useCrossed(ratio);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (!crossed.n) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduceMotion) return;
    halo.set(0);
    halo.set(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
        withDelay(80, withTiming(2, { duration: 900, easing: Easing.out(Easing.cubic) })),
      ),
    );
  }, [crossed, halo, reduceMotion]);

  const ring = (offset: number) => {
    'worklet';
    return {
      opacity: Math.max(0, 1 - Math.abs(halo.value - offset - 0.5) * 2) * 0.7,
      transform: [{ scale: 1 + Math.max(0, Math.min(1, halo.value - offset)) * 0.45 }],
    };
  };
  const first = useAnimatedStyle(() => ring(0));
  const second = useAnimatedStyle(() => ring(1));

  const base = { width: size, height: size, borderRadius: size / 2, borderColor: colors.brand };
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.halo, base, first]} />
      <Animated.View pointerEvents="none" style={[styles.halo, base, second]} />
    </>
  );
}

const styles = StyleSheet.create({
  burstLayer: { position: 'absolute', left: 0, right: 0, top: -6, alignItems: 'center' },
  halo: { position: 'absolute', top: 0, left: 0, borderWidth: 3 },
});

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    chip: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 28,
      paddingLeft: 4,
      paddingRight: 10,
      borderRadius: Radius.pill,
      backgroundColor: c.surface,
      boxShadow: c.cardShadowSubtle,
    },
    coin: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brand,
    },
    coinText: { color: c.onBrand, fontSize: 12, fontFamily: DisplayFont.extrabold },
    chipText: { color: c.text, fontSize: 13, fontFamily: DisplayFont.bold, fontVariant: ['tabular-nums'] },
  }),
);
