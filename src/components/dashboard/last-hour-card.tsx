import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatInt, formatMoneyCompact } from '@/features/dashboard/format';
import type { DashboardSummary } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { AnimatedNumber } from './animated-number';
import { PulseBars } from './pulse-bars';

/** Con el evento en curso: pedidos y recaudación de la última hora, con el pulso por minuto. */
export function LastHourCard({ live }: { live: DashboardSummary['live'] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(80).duration(400)}
      style={styles.card}
      accessibilityLabel={`${live.orders_last_hour} pedidos en la última hora, ${formatMoneyCompact(live.revenue_last_hour)} recaudados`}>
      <View style={styles.head}>
        <Text style={styles.label}>Última hora</Text>
        <Text style={styles.value}>
          <AnimatedNumber value={live.orders_last_hour} format={formatInt} style={styles.value} /> pedidos ·{' '}
          {formatMoneyCompact(live.revenue_last_hour)}
        </Text>
      </View>
      <PulseBars
        values={live.per_minute.slice(-30)}
        height={40}
        live
        color={colors.scheme === 'dark' ? colors.borderStrong : colors.chart.ramp[2]}
        highlight={colors.hero.accent}
      />
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
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    label: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    value: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold, fontVariant: ['tabular-nums'] },
  }),
);
