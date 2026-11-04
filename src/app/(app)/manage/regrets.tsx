import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Icon } from '@/components/dashboard/icon';
import { Segmented } from '@/components/dashboard/segmented';
import { ManageScreen, ManageSummary } from '@/components/manage/manage-ui';
import { DisplayFont, Radius } from '@/constants/theme';
import { relativeTime } from '@/features/dashboard/format';
import { type Regret, useRegrets } from '@/features/manage/manage';
import { useNow } from '@/hooks/use-now';
import { makeStyles, useTheme } from '@/theme';

type Filter = 'pending' | 'resolved';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'resolved', label: 'Resueltas' },
];

/**
 * Arrepentimientos de compra: solicitudes de los compradores (botón de arrepentimiento) para
 * gestionar la devolución. Cada una abre su detalle para marcarla como resuelta.
 */
export default function RegretsScreen() {
  const { regrets: list, error } = useRegrets();
  const now = useNow(30_000);
  const [filter, setFilter] = useState<Filter>('pending');
  const regrets = list ?? [];
  const pending = regrets.filter((r) => r.status === 'pending').length;
  const shown = regrets.filter((r) => r.status === filter);

  return (
    <ManageScreen
      loading={!list && !error}
      summary={
        <View style={{ gap: 14 }}>
          <ManageSummary
            value={String(pending)}
            label={pending === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
          />
          <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        </View>
      }
      empty={
        !list
          ? error
          : shown.length === 0
          ? filter === 'pending'
            ? 'No hay solicitudes pendientes.'
            : 'Todavía no resolviste ninguna solicitud.'
          : null
      }>
      {shown.map((r) => (
        <Animated.View
          key={r.id}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(160)}
          layout={LinearTransition.duration(260)}>
          <RegretCard
            regret={r}
            now={now}
            onPress={() => router.push({ pathname: '/manage/regret/[id]', params: { id: r.id } })}
          />
        </Animated.View>
      ))}
    </ManageScreen>
  );
}

function RegretCard({ regret: r, now, onPress }: { regret: Regret; now: number; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pending = r.status === 'pending';
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${r.fullName}, ${pending ? 'pendiente' : 'resuelta'}. Ver detalle`}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.canvas }]}>
      <View style={styles.top}>
        <Text style={styles.name} numberOfLines={1}>
          {r.fullName}
        </Text>
        <Text style={styles.time}>{relativeTime(r.createdAt, now)}</Text>
      </View>
      <Text style={styles.detail} numberOfLines={2}>
        {r.purchaseDetail}
      </Text>
      <View style={styles.bottom}>
        <View style={[styles.chip, pending ? styles.chipPending : styles.chipDone]}>
          <View style={[styles.dot, { backgroundColor: pending ? colors.brand : colors.textMuted }]} />
          <Text style={[styles.chipText, pending && { color: colors.brandText }]}>
            {pending ? 'Pendiente' : 'Resuelta'}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Icon name="chevronRight" size={12} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      gap: 10,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    top: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
    name: { flex: 1, color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    time: { color: c.textMuted, fontSize: 12 },
    detail: { color: c.textSecondary, fontSize: 14, lineHeight: 19 },
    bottom: { flexDirection: 'row', alignItems: 'center' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      height: 22,
      borderRadius: 7,
    },
    chipPending: { backgroundColor: c.brandMuted },
    chipDone: { backgroundColor: c.raised },
    dot: { width: 5, height: 5, borderRadius: 3 },
    chipText: { color: c.textSecondary, fontSize: 11, fontWeight: '700' },
  }),
);
