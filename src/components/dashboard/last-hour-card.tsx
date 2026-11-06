import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { MOOD_LABEL, MoodMascot } from '@/components/illustrations/mood-mascot';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatInt, formatMoneyCompact } from '@/features/dashboard/format';
import type { ActivityItem, DashboardSummary } from '@/features/dashboard/types';
import type { MascotMood } from '@/widgets/types';
import { makeStyles, useTheme } from '@/theme';

import { AnimatedNumber } from './animated-number';
import { LiveTicker } from './live-ticker';
import { PulseBars } from './pulse-bars';

/**
 * Con el evento en curso: pedidos y recaudación de la última hora, con el pulso por minuto y la
 * mascota en la pose que corresponde (la misma que la Live Activity, la decide el backend).
 */
export function LastHourCard({
  live,
  activity = [],
  mood = null,
}: {
  live: DashboardSummary['live'];
  /** Pose de la mascota; sin pulso cargado todavía, no se muestra. */
  mood?: MascotMood | null;
  /** Actividad reciente: se muestra de a un ítem en la tira de abajo. */
  activity?: ActivityItem[];
}) {
  const styles = useStyles();
  const { colors } = useTheme();
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
          {mood ? <Text style={styles.mood}>{MOOD_LABEL[mood]}</Text> : null}
        </View>
        {mood ? <MoodMascot mood={mood} size={64} onLight={colors.scheme === 'light'} /> : null}
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
    mood: { color: c.brandText, fontSize: 13, fontWeight: '600' },
    label: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    value: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold, fontVariant: ['tabular-nums'] },
  }),
);
