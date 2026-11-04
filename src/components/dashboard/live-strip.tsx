import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { formatInt, formatMoneyCompact } from '@/features/dashboard/format';
import type { DashboardSummary } from '@/features/dashboard/types';
import { makeStyles } from '@/theme';

import { AnimatedNumber } from './animated-number';
import { LivePill } from './live-pill';
import { PulseBars } from './pulse-bars';

/** Ritmo de la última hora en una sola línea (solo con el evento en curso). */
export function LiveStrip({ summary }: { summary: DashboardSummary }) {
  const styles = useStyles();
  const { live } = summary;
  return (
    <View
      style={styles.wrap}
      accessibilityLabel={`${live.orders_last_hour} pedidos en la última hora`}>
      <LivePill compact />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          <AnimatedNumber value={live.orders_last_hour} format={formatInt} style={styles.strong} />{' '}
          pedidos en la última hora
        </Text>
        <Text style={styles.sub}>{formatMoneyCompact(live.revenue_last_hour)} recaudados</Text>
      </View>
      <View style={styles.bars}>
        <PulseBars values={live.per_minute.slice(-16)} height={26} live />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.lg,
      backgroundColor: c.brandMuted,
    },
    title: { color: c.text, fontSize: 14 },
    strong: { color: c.text, fontSize: 14, fontWeight: '700' },
    sub: { color: c.textSecondary, fontSize: 12, marginTop: 1 },
    bars: { width: 84 },
  }),
);
