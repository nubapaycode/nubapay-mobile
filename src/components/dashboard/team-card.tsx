import { StyleSheet, Text, View } from 'react-native';

import { DisplayFont, Radius } from '@/constants/theme';
import { formatInt, formatMoney } from '@/features/dashboard/format';
import type { DashboardInsights } from '@/features/dashboard/types';
import { makeStyles, useTheme } from '@/theme';

import { Card } from './card';
import { Icon } from './icon';
import { ProgressBar } from './progress-bar';

/** Hora pico del evento. */
export function PeakHourCard({
  insights,
  index = 0,
}: {
  insights: DashboardInsights;
  index?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const peak = insights.peak_hour;
  if (!peak) return null;
  const next = String((Number(peak.label.slice(0, 2)) + 1) % 24).padStart(2, '0');
  return (
    <Card index={index}>
      <View style={styles.peak}>
        <View style={styles.peakIcon}>
          <Icon name="clock" size={18} color={colors.brandText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.peakLabel}>Hora pico</Text>
          <Text style={styles.peakValue}>
            {peak.label} a {next}h
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.peakStat}>{formatInt(peak.orders)} pedidos</Text>
          <Text style={styles.peakSub}>{formatMoney(peak.revenue)}</Text>
        </View>
      </View>
    </Card>
  );
}

/** Escaneos (ingresos y retiros) por integrante del staff. */
export function StaffCard({
  insights,
  index = 0,
}: {
  insights: DashboardInsights;
  index?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const staff = insights.staff_scans;
  if (staff.length === 0) return null;
  const max = Math.max(1, ...staff.map((s) => s.units_redeemed));
  return (
    <Card title="Equipo" subtitle="Escaneos por persona" index={index}>
      <View style={{ gap: 14 }}>
        {staff.map((s, i) => (
          <View key={s.user_id} style={styles.staffRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(s.name ?? '?').slice(0, 1)}</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.staffHead}>
                <Text style={styles.staffName} numberOfLines={1}>
                  {s.name ?? 'Sin nombre'}
                </Text>
                <Text style={styles.staffCount}>{formatInt(s.units_redeemed)}</Text>
              </View>
              <ProgressBar
                height={4}
                total={max}
                delay={200 + i * 70}
                segments={[{ value: s.units_redeemed, color: colors.chart.series[1] }]}
              />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    peak: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    peakIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brandMuted,
    },
    peakLabel: { color: c.textSecondary, fontSize: 12 },
    peakValue: { color: c.text, fontSize: 19, fontFamily: DisplayFont.bold },
    peakStat: { color: c.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
    peakSub: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    staffRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    avatarText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
    staffHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    staffName: { color: c.text, fontSize: 15, flex: 1 },
    staffCount: { color: c.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
  }),
);
