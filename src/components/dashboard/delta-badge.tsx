import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { formatPercent } from '@/features/dashboard/format';
import { makeStyles, useTheme } from '@/theme';

import { Icon } from './icon';

/** Variación vs. período anterior. Color + ícono + signo: nunca solo color. */
export function DeltaBadge({ ratio, suffix }: { ratio: number | null; suffix?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (ratio == null || !Number.isFinite(ratio)) return null;
  const up = ratio >= 0;
  const color = up ? colors.success : colors.danger;
  return (
    <View style={styles.row}>
      <View
        style={[styles.badge, { backgroundColor: up ? colors.successMuted : colors.dangerMuted }]}>
        <Icon name={up ? 'up' : 'down'} size={11} color={color} />
        <Text style={[styles.text, { color }]}>
          {up ? '+' : '−'}
          {formatPercent(Math.abs(ratio), 1)}
        </Text>
      </View>
      {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      height: 22,
      borderRadius: Radius.pill,
    },
    text: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
    suffix: { color: c.textMuted, fontSize: 12 },
  }),
);
