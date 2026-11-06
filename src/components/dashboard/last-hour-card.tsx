import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { MOOD_LABEL, MoodMascot } from '@/components/illustrations/mood-mascot';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatInt, formatMoneyCompact } from '@/features/dashboard/format';
import { MASCOT_LINE_EVERY_MS, msUntilNextLine, nextMascotLine } from '@/features/dashboard/mascot-lines';
import type { ActivityItem, DashboardSummary } from '@/features/dashboard/types';
import type { MascotMood } from '@/widgets/types';
import { makeStyles, useTheme } from '@/theme';

import { AnimatedNumber } from './animated-number';
import { LiveTicker } from './live-ticker';
import { PulseBars } from './pulse-bars';

/** Cuánto espera la mascota antes de hablar por primera vez y cuánto dura el globo. */
const FIRST_LINE_MS = 20_000;
const BUBBLE_MS = 7_000;

/**
 * Con el evento en curso: pedidos y recaudación de la última hora, con el pulso por minuto y la
 * mascota en la pose que corresponde (la misma que la Live Activity, la decide el backend).
 *
 * La mascota comenta algo del evento en un globo (en lugar del texto de la pose) como mucho una
 * vez cada MASCOT_LINE_EVERY_MS: con muchas ventas no molesta. Tocarla la hace hablar ya.
 */
export function LastHourCard({
  live,
  activity = [],
  mood = null,
  eventId,
  lines = [],
  onMascotPress,
}: {
  live: DashboardSummary['live'];
  /** Pose de la mascota; sin pulso cargado todavía, no se muestra. */
  mood?: MascotMood | null;
  /** Actividad reciente: se muestra de a un ítem en la tira de abajo. */
  activity?: ActivityItem[];
  /** Evento actual: el límite de frases es por evento. */
  eventId: string;
  /** Frases posibles para el globo (`mascotLines`). */
  lines?: string[];
  /** Al tocar la mascota (p. ej. para cerrar el tip que invita a tocarla). */
  onMascotPress?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [line, setLine] = useState<string | null>(null);
  const [hopKey, setHopKey] = useState(0);
  // Las frases cambian con cada actualización; los timers leen siempre las últimas.
  const linesRef = useRef(lines);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = (text: string | null) => {
    if (!text) return;
    setLine(text);
    setHopKey((k) => k + 1);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setLine(null), BUBBLE_MS);
  };

  // Habla sola: la primera vez a los 20 s (o cuando se cumpla el límite) y después cada 12 min.
  useEffect(() => {
    if (!mood) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (ms: number) => {
      timer = setTimeout(() => {
        say(nextMascotLine(eventId, linesRef.current));
        schedule(MASCOT_LINE_EVERY_MS);
      }, ms);
    };
    schedule(Math.max(FIRST_LINE_MS, msUntilNextLine(eventId)));
    return () => clearTimeout(timer);
    // `say` usa setters estables; se reprograma al cambiar de evento o al aparecer la mascota.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, !!mood]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(80).duration(400)}
      style={styles.card}
      accessibilityLabel={`${live.orders_last_hour} pedidos en la última hora, ${formatMoneyCompact(live.revenue_last_hour)} recaudados`}>
      <View style={styles.top}>
        <View style={styles.texts}>
          <Text style={styles.label}>Última hora</Text>
          <Text style={styles.value}>
            <AnimatedNumber value={live.orders_last_hour} format={formatInt} style={styles.value} /> pedidos ·{' '}
            {formatMoneyCompact(live.revenue_last_hour)}
          </Text>
          {line ? (
            <Animated.View
              key={line}
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(160)}
              style={styles.bubble}
              accessibilityLiveRegion="polite">
              <Text style={styles.bubbleText} numberOfLines={2}>
                {line}
              </Text>
              <View style={styles.bubbleTail} />
            </Animated.View>
          ) : mood ? (
            <Animated.Text entering={FadeIn.duration(220)} style={styles.mood}>
              {MOOD_LABEL[mood]}
            </Animated.Text>
          ) : null}
        </View>
        {mood ? (
          <MoodMascot
            mood={mood}
            size={64}
            onLight={colors.scheme === 'light'}
            hopKey={hopKey}
            onPress={() => {
              onMascotPress?.();
              say(nextMascotLine(eventId, linesRef.current, { force: true }));
            }}
          />
        ) : null}
      </View>
      <PulseBars
        values={live.per_minute.slice(-30)}
        height={40}
        live
        color={colors.scheme === 'dark' ? colors.borderStrong : colors.chart.ramp[2]}
        highlight={colors.hero.accent}
      />
      {activity.length ? <LiveTicker items={activity} /> : null}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.hero.glass,
      boxShadow: c.cardShadow,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hero.glassBorder,
      padding: Spacing.three,
      gap: Spacing.three,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    texts: { flex: 1, gap: 2 },
    mood: { color: c.hero.accent, fontSize: 13, fontWeight: '600' },
    bubble: {
      alignSelf: 'flex-start',
      marginTop: 4,
      backgroundColor: c.surface,
      borderRadius: Radius.md,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    bubbleText: { color: c.text, fontSize: 13, fontWeight: '500' },
    bubbleTail: {
      position: 'absolute',
      right: -5,
      top: 10,
      width: 10,
      height: 10,
      backgroundColor: c.surface,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      transform: [{ rotate: '45deg' }],
    },
    label: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    value: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold, fontVariant: ['tabular-nums'] },
  }),
);
