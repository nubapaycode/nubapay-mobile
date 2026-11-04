import { StyleSheet, Text, View } from 'react-native';

import { makeStyles } from '@/theme';

import { AnimatedNumber } from './animated-number';
import { Card } from './card';

export type Stat = {
  label: string;
  value: number;
  format: (n: number) => string;
  tone?: 'warning';
};

/** 2–3 cifras en línea dentro de una card (cabecera de cada detalle). */
export function StatRow({ stats, index = 0 }: { stats: Stat[]; index?: number }) {
  const styles = useStyles();
  return (
    <Card index={index}>
      <View style={styles.row}>
        {stats.map((s, i) => (
          <View key={s.label} style={[styles.cell, i > 0 && styles.divider]}>
            <Text style={styles.label} numberOfLines={1}>
              {s.label}
            </Text>
            <AnimatedNumber
              value={s.value}
              format={s.format}
              style={[styles.value, s.tone === 'warning' && styles.warning]}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          </View>
        ))}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: 'row' },
    cell: { flex: 1, gap: 4, paddingHorizontal: 4 },
    divider: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: c.border,
      paddingLeft: 14,
    },
    label: { color: c.textSecondary, fontSize: 12 },
    value: { color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
    warning: { color: c.warning },
  }),
);
