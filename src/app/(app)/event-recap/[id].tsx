import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedNumber } from '@/components/dashboard/animated-number';
import { Icon } from '@/components/dashboard/icon';
import { Confetti } from '@/components/fx/confetti';
import { MoodMascot, type MascotPose } from '@/components/illustrations/mood-mascot';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatEventDate, formatInt, formatMoney, formatMoneyCompact, formatPercent } from '@/features/dashboard/format';
import type { DashboardData } from '@/features/dashboard/types';
import { useEventDashboard, useEvents } from '@/features/dashboard/use-event-dashboard';
import { markRecapSeen } from '@/features/recap/recap-seen';
import { shareRecapImage } from '@/features/recap/share-recap';

/** Cuánto dura cada pantalla del resumen antes de pasar sola a la siguiente. */
const SLIDE_MS = 5_500;

const INK = '#080b11';
const LIME = '#c6ff00';
const BLUE = '#0069ff';
const WHITE = '#ffffff';

type Slide = {
  key: string;
  bg: string;
  fg: string;
  eyebrow: string;
  /** Número grande (cuenta desde 0) o texto grande. */
  big: { value: number; format: (n: number) => string } | string;
  lines: string[];
  pose: MascotPose;
  confetti?: boolean;
};

/**
 * Resumen del evento al terminar, en pantallas tipo historia (Duolingo Year in Review, Spotify
 * Wrapped): lo recaudado, la hora pico, las entradas, lo que más salió y quiénes compraron, con
 * la mascota en la pose de cada momento. Avanza solo; tocar a la derecha pasa, a la izquierda
 * vuelve y mantener apretado pausa. Al final, una tarjeta para compartir como imagen.
 */
export default function EventRecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { events } = useEvents();
  const event = events?.find((e) => e.id === id) ?? null;
  const filters = useMemo(() => ({ period: { preset: 'event' as const }, scope: 'all' as const }), []);
  const { state } = useEventDashboard(id ?? null, filters, { publish: false });
  const data = state.status === 'ready' ? state.data : null;

  // Visto (se abra solo o desde la card): no vuelve a abrirse solo.
  useEffect(() => {
    if (id) markRecapSeen(id);
  }, [id]);

  const slides = useMemo(() => (data && event ? buildSlides(data, event.name) : []), [data, event]);
  const total = slides.length + 1; // + la tarjeta final para compartir
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useSharedValue(0);
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState(false);
  const isLast = index === total - 1;

  // Tiempo ya mostrado de la pantalla actual: se lleva acá (no se lee de la animación) para que
  // cada pantalla arranque de cero y una pausa retome donde quedó.
  const elapsed = useRef(0);
  const shownIndex = useRef(index);

  // Barra de la pantalla actual: se llena en SLIDE_MS y pasa a la siguiente (no en la última).
  useEffect(() => {
    if (shownIndex.current !== index) {
      shownIndex.current = index;
      elapsed.current = 0;
    }
    if (!slides.length || isLast || paused) {
      progress.set(elapsed.current / SLIDE_MS);
      return;
    }
    const startedAt = Date.now();
    const remaining = Math.max(0, SLIDE_MS - elapsed.current);
    progress.set(elapsed.current / SLIDE_MS);
    progress.set(withTiming(1, { duration: remaining, easing: Easing.linear }));
    const t = setTimeout(() => setIndex((i) => Math.min(total - 1, i + 1)), remaining);
    return () => {
      clearTimeout(t);
      elapsed.current = Math.min(SLIDE_MS, elapsed.current + (Date.now() - startedAt));
    };
  }, [index, paused, slides.length, isLast, total, progress]);

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(total - 1, next));
    if (clamped === index) return;
    Haptics.selectionAsync();
    setIndex(clamped);
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const share = async () => {
    if (!data || !event || sharing) return;
    setSharing(true);
    try {
      const shared = await shareRecapImage(cardRef);
      if (!shared) {
        await Share.share({ message: recapMessage(data, event.name) });
      }
    } finally {
      setSharing(false);
    }
  };

  if (!data || !event) {
    return (
      <View style={[styles.screen, { backgroundColor: INK, justifyContent: 'center', alignItems: 'center' }]}>
        <MoodMascot mood={state.status === 'error' ? 'offline' : 'waiting'} size={110} />
        <Text style={[styles.lines, { color: WHITE, textAlign: 'center', marginTop: Spacing.three }]}>
          {state.status === 'error' ? 'No pudimos armar el resumen.' : 'Armando el resumen…'}
        </Text>
        <CloseButton onPress={close} top={insets.top} />
      </View>
    );
  }

  const slide = slides[index] ?? null;
  const bg = slide ? slide.bg : BLUE;
  const fg = slide ? slide.fg : WHITE;

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Tocá a la derecha para avanzar y a la izquierda para volver"
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        delayLongPress={220}
        onPress={(e) => {
          if (isLast) return;
          const left = e.nativeEvent.locationX < 120;
          go(left ? index - 1 : index + 1);
        }}
      />

      {/* Progreso: un segmento por pantalla. */}
      <View style={[styles.bars, { top: insets.top + 8 }]} pointerEvents="none">
        {Array.from({ length: total }).map((_, i) => (
          <ProgressSegment key={i} state={i < index ? 'done' : i === index ? 'active' : 'todo'} progress={progress} color={fg} />
        ))}
      </View>
      <CloseButton onPress={close} top={insets.top + 18} color={fg} />

      {slide ? (
        <Animated.View
          key={slide.key}
          entering={reduceMotion ? undefined : FadeIn.duration(260)}
          exiting={reduceMotion ? undefined : FadeOut.duration(140)}
          style={[styles.slide, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 40 }]}
          pointerEvents="none">
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(420)}>
            {/* Sobre lima la mascota (que es lima) se perdería: va sobre un círculo oscuro. */}
            <View style={slide.bg === LIME ? styles.mascotBadge : undefined}>
              <MoodMascot mood={slide.pose} size={slide.bg === LIME ? 130 : 150} />
            </View>
          </Animated.View>
          <Text style={[styles.eyebrow, { color: fg }]}>{slide.eyebrow}</Text>
          {typeof slide.big === 'string' ? (
            <Text style={[styles.big, { color: fg }]} numberOfLines={2} adjustsFontSizeToFit>
              {slide.big}
            </Text>
          ) : (
            <AnimatedNumber
              value={slide.big.value}
              format={slide.big.format}
              style={[styles.big, { color: fg }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          )}
          {slide.lines.map((l, i) => (
            <Animated.Text
              key={l}
              entering={reduceMotion ? undefined : FadeInDown.delay(500 + i * 220).duration(380)}
              style={[styles.lines, { color: fg }]}>
              {l}
            </Animated.Text>
          ))}
          {slide.confetti ? <Confetti seed={index} /> : null}
        </Animated.View>
      ) : (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(260)}
          style={[styles.final, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 }]}>
          <View ref={cardRef} collapsable={false} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardBrand}>nubapay</Text>
              <Text style={styles.cardDate}>{formatEventDate(event.starts_at)}</Text>
            </View>
            <Text style={styles.cardName} numberOfLines={2}>
              {event.name}
            </Text>
            <View style={styles.cardMascot}>
              <MoodMascot mood={finalPose(data)} size={120} />
            </View>
            <Text style={styles.cardLabel}>Recaudado</Text>
            <Text style={styles.cardTotal} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(data.summary.total_revenue)}
            </Text>
            <View style={styles.cardStats}>
              {cardStats(data).map((s) => (
                <View key={s.label} style={styles.cardStat}>
                  <Text style={styles.cardStatValue} numberOfLines={1}>
                    {s.value}
                  </Text>
                  <Text style={styles.cardStatLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable
              onPress={share}
              disabled={sharing}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, (pressed || sharing) && { opacity: 0.7 }]}>
              <Icon name="send" size={16} color={INK} />
              <Text style={styles.primaryText}>{sharing ? 'Preparando…' : 'Compartir'}</Text>
            </Pressable>
            <Pressable
              onPress={() => go(0)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}>
              <Text style={styles.secondaryText}>Ver de nuevo</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function ProgressSegment({
  state,
  progress,
  color,
}: {
  state: 'done' | 'active' | 'todo';
  progress: ReturnType<typeof useSharedValue<number>>;
  color: string;
}) {
  const fill = useAnimatedStyle(() => ({
    width: `${(state === 'done' ? 1 : state === 'active' ? progress.value : 0) * 100}%`,
  }));
  return (
    <View style={[styles.segment, { backgroundColor: `${color}40` }]}>
      <Animated.View style={[styles.segmentFill, { backgroundColor: color }, fill]} />
    </View>
  );
}

function CloseButton({ onPress, top, color = WHITE }: { onPress: () => void; top: number; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Cerrar resumen"
      style={[styles.close, { top }]}>
      <Icon name="close" size={18} color={color} />
    </Pressable>
  );
}

/* ---------- Contenido ---------- */

function buildSlides(data: DashboardData, name: string): Slide[] {
  const { summary, insights } = data;
  const { tickets, products, customers, peak_hour } = insights;
  const soldOut = !!tickets.capacity && tickets.sold >= tickets.capacity;
  const slides: Slide[] = [
    {
      key: 'intro',
      bg: INK,
      fg: WHITE,
      eyebrow: 'Terminó',
      big: name,
      lines: ['Esto es lo que pasó.'],
      pose: soldOut ? 'soldout' : 'selling',
    },
    {
      key: 'revenue',
      bg: LIME,
      fg: INK,
      eyebrow: 'Recaudaste',
      big: { value: summary.total_revenue, format: formatMoney },
      lines: [
        `${formatInt(summary.order_count)} pedidos`,
        ...(summary.avg_ticket > 0 ? [`Ticket promedio de ${formatMoneyCompact(summary.avg_ticket)}`] : []),
      ],
      pose: 'hot',
      confetti: summary.total_revenue > 0,
    },
  ];
  if (peak_hour && peak_hour.orders > 0) {
    slides.push({
      key: 'peak',
      bg: BLUE,
      fg: WHITE,
      eyebrow: 'Tu hora pico',
      big: peak_hour.label,
      lines: [`${formatInt(peak_hour.orders)} pedidos en esa hora`, `${formatMoneyCompact(peak_hour.revenue)} recaudados`],
      pose: 'hot',
    });
  }
  if (tickets.types.length > 0 && tickets.sold > 0) {
    slides.push({
      key: 'tickets',
      bg: INK,
      fg: WHITE,
      eyebrow: 'Vendiste',
      big: { value: tickets.sold, format: (n) => `${formatInt(n)} entradas` },
      lines: [
        ...(tickets.capacity ? [`${formatPercent(tickets.sold / tickets.capacity)} del aforo`] : []),
        ...(tickets.checked_in > 0
          ? [`Entraron ${formatInt(tickets.checked_in)} (${formatPercent(tickets.checked_in / tickets.sold)} de asistencia)`]
          : []),
      ],
      pose: soldOut ? 'soldout' : 'selling',
      confetti: soldOut,
    });
  }
  const top = summary.top_products[0];
  if (products.units_sold > 0 && top) {
    slides.push({
      key: 'bar',
      bg: LIME,
      fg: INK,
      eyebrow: 'Lo que más salió',
      big: top.name,
      lines: [`${formatInt(top.quantity)} unidades`, `${formatInt(products.units_sold)} productos en total`],
      pose: 'hot',
    });
  }
  if (customers.unique > 0) {
    slides.push({
      key: 'people',
      bg: BLUE,
      fg: WHITE,
      eyebrow: 'Compraron',
      big: { value: customers.unique, format: (n) => `${formatInt(n)} personas` },
      lines: customers.repeat > 0 ? [`${formatInt(customers.repeat)} volvieron a comprar`] : ['Gracias por usar Nubapay.'],
      pose: 'selling',
    });
  }
  return slides;
}

function finalPose(data: DashboardData): MascotPose {
  const { tickets } = data.insights;
  return tickets.capacity && tickets.sold >= tickets.capacity ? 'soldout' : 'hot';
}

function cardStats(data: DashboardData): { label: string; value: string }[] {
  const { summary, insights } = data;
  const stats = [{ label: 'Pedidos', value: formatInt(summary.order_count) }];
  if (insights.tickets.sold > 0) stats.push({ label: 'Entradas', value: formatInt(insights.tickets.sold) });
  const top = summary.top_products[0];
  if (top) stats.push({ label: 'Lo más pedido', value: top.name });
  else if (insights.peak_hour) stats.push({ label: 'Hora pico', value: insights.peak_hour.label });
  return stats.slice(0, 3);
}

function recapMessage(data: DashboardData, name: string): string {
  return `Así fue ${name}: ${formatMoney(data.summary.total_revenue)} recaudados en ${formatInt(
    data.summary.order_count,
  )} pedidos. Con Nubapay.`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bars: { position: 'absolute', left: Spacing.three, right: Spacing.three, flexDirection: 'row', gap: 4, zIndex: 2 },
  segment: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  segmentFill: { height: '100%', borderRadius: 2 },
  close: { position: 'absolute', right: Spacing.three, zIndex: 3, padding: 6 },
  slide: { flex: 1, paddingHorizontal: Spacing.four, justifyContent: 'center', gap: Spacing.two },
  mascotBadge: {
    alignSelf: 'flex-start',
    backgroundColor: INK,
    borderRadius: 999,
    padding: 18,
  },
  eyebrow: { fontSize: 17, fontWeight: '700', opacity: 0.8, marginTop: Spacing.three },
  big: { fontSize: 52, lineHeight: 58, fontFamily: DisplayFont.extrabold, fontVariant: ['tabular-nums'] },
  lines: { fontSize: 19, lineHeight: 26, fontWeight: '500', opacity: 0.9 },
  final: { flex: 1, paddingHorizontal: Spacing.four, justifyContent: 'center', gap: Spacing.four },
  card: {
    backgroundColor: INK,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#232a36',
    gap: 6,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { color: LIME, fontFamily: DisplayFont.extrabold, fontSize: 18 },
  cardDate: { color: '#9aa3b2', fontSize: 13, fontWeight: '500' },
  cardName: { color: WHITE, fontFamily: DisplayFont.extrabold, fontSize: 28, lineHeight: 32, marginTop: Spacing.two },
  cardMascot: { alignItems: 'center', marginVertical: Spacing.two },
  cardLabel: { color: '#9aa3b2', fontSize: 14, fontWeight: '600' },
  cardTotal: { color: WHITE, fontFamily: DisplayFont.extrabold, fontSize: 40, fontVariant: ['tabular-nums'] },
  cardStats: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  cardStat: { flex: 1, gap: 2 },
  cardStatValue: { color: WHITE, fontSize: 16, fontWeight: '700' },
  cardStatLabel: { color: '#9aa3b2', fontSize: 12 },
  actions: { gap: Spacing.two },
  primary: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LIME,
    borderRadius: 999,
    paddingVertical: 15,
  },
  primaryText: { color: INK, fontSize: 16, fontWeight: '700' },
  secondary: { alignItems: 'center', paddingVertical: 12 },
  secondaryText: { color: WHITE, fontSize: 15, fontWeight: '600', opacity: Platform.OS === 'ios' ? 0.85 : 1 },
});
