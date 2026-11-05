import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { enter, enterRow } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';

/** Página de gestión (blanca, con header nativo): resumen, botón de agregar y la lista. */
export function ManageScreen({
  summary,
  addLabel,
  onAdd,
  loading,
  empty,
  children,
}: {
  summary?: ReactNode;
  addLabel?: string;
  onAdd?: () => void;
  loading?: boolean;
  /** Texto si la lista está vacía. */
  empty?: string | null;
  children?: ReactNode;
}) {
  const styles = useStyles();
  useFocusStatusBar();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      {summary ? <Animated.View entering={enter(0)}>{summary}</Animated.View> : null}
      {addLabel && onAdd ? (
        <Animated.View entering={enter(1)}>
          <AddButton label={addLabel} onPress={onAdd} />
        </Animated.View>
      ) : null}
      {loading ? (
        <Text style={styles.muted}>Cargando…</Text>
      ) : empty ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
          <Text style={styles.emptyText}>{empty}</Text>
        </Animated.View>
      ) : (
        <View style={styles.list}>{children}</View>
      )}
    </ScrollView>
  );
}

/** Resumen de la sección: cifra grande + texto. */
export function ManageSummary({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

export function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [styles.add, pressed && { backgroundColor: colors.border }]}>
      <Icon name="plus" size={15} color={colors.ink} />
      <Text style={styles.addText}>{label}</Text>
    </Pressable>
  );
}

/** Ítem en su propia tarjeta, con switch de activo/pausado. Toda la tarjeta entra con fundido. */
export function ItemCard({
  index,
  title,
  subtitle,
  value,
  footer,
  active,
  onToggle,
}: {
  index: number;
  title: string;
  subtitle?: string | null;
  /** A la derecha del título (p. ej. el precio). */
  value?: string;
  footer?: ReactNode;
  active: boolean;
  onToggle: (v: boolean) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={enterRow(index)}
      layout={LinearTransition.duration(260)}
      style={[styles.card, !active && styles.cardOff]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !active && styles.off]} numberOfLines={1}>
              {title}
            </Text>
            {!active ? (
              <View style={styles.paused}>
                <Text style={styles.pausedText}>Pausado</Text>
              </View>
            ) : null}
          </View>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {value ? <Text style={[styles.value, !active && styles.off]}>{value}</Text> : null}
        <Switch
          value={active}
          onValueChange={(v) => {
            Haptics.selectionAsync();
            onToggle(v);
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel={`${title}: ${active ? 'activo' : 'pausado'}`}
        />
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
    list: { gap: 10 },
    muted: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
    empty: {
      padding: 20,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

    summary: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4 },
    summaryValue: {
      color: c.text,
      fontSize: 28,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.8,
      fontVariant: ['tabular-nums'],
    },
    summaryLabel: { color: c.textMuted, fontSize: 13, flexShrink: 1 },

    add: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.raised,
    },
    addText: { color: c.ink, fontSize: 15, fontFamily: DisplayFont.semibold },

    card: {
      padding: 14,
      gap: 12,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    cardOff: { backgroundColor: c.canvas },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold, flexShrink: 1 },
    off: { color: c.textMuted },
    subtitle: { color: c.textMuted, fontSize: 13 },
    value: { color: c.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
    paused: {
      paddingHorizontal: 7,
      height: 20,
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: c.raised,
    },
    pausedText: { color: c.textSecondary, fontSize: 10, fontWeight: '700' },
    footer: { gap: 8 },
  }),
);
