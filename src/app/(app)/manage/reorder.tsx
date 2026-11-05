import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/dashboard/icon';
import { GroupHeader } from '@/components/manage/catalog-kit';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatMoney } from '@/features/dashboard/format';
import {
  type ReorderKind,
  saveOrder,
  useBlocks,
  useProducts,
  useTickets,
} from '@/features/manage/manage';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';

type Item = { id: string; title: string; subtitle: string | null };
type Group = { title: string | null; items: Item[] };

const TITLE: Record<ReorderKind, string> = {
  tickets: 'Ordenar entradas',
  products: 'Ordenar productos',
  blocks: 'Ordenar bloques',
};
const HINT: Record<ReorderKind, string> = {
  tickets: 'Así se ven las entradas en la tienda, de arriba hacia abajo.',
  products: 'El orden de los productos dentro de cada categoría de la tienda.',
  blocks: 'El orden de los bloques arriba del catálogo.',
};

/** Ordenar entradas, productos (dentro de su categoría) o bloques con flechas. Guarda con /reorder. */
export default function ReorderScreen() {
  const { kind } = useLocalSearchParams<{ kind: ReorderKind }>();
  const groups = useGroups(kind);
  useFocusStatusBar();
  if (!groups.data) return <Loading error={groups.error} />;
  return <ReorderList key={kind} kind={kind} initial={groups.data} eventId={groups.eventId} />;
}

function useGroups(kind: ReorderKind): { data: Group[] | null; error: string | null; eventId: string | null } {
  const t = useTickets();
  const p = useProducts();
  const b = useBlocks();
  return useMemo(() => {
    if (kind === 'tickets') {
      return {
        eventId: t.eventId,
        error: t.error,
        data: t.tickets
          ? [{ title: null, items: t.tickets.map((x) => ({ id: x.id, title: x.name, subtitle: formatMoney(x.price) })) }]
          : null,
      };
    }
    if (kind === 'products') {
      if (!p.products) return { eventId: p.eventId, error: p.error, data: null };
      const map = new Map<string, Item[]>();
      for (const x of p.products) {
        const g = x.category ?? 'Sin categoría';
        if (!map.has(g)) map.set(g, []);
        map.get(g)!.push({ id: x.id, title: x.name, subtitle: formatMoney(x.price) });
      }
      return { eventId: p.eventId, error: null, data: [...map].map(([title, items]) => ({ title, items })) };
    }
    return {
      eventId: b.eventId,
      error: b.error,
      data: b.blocks
        ? [
            {
              title: null,
              items: b.blocks.map((x) => ({
                id: x.id,
                title: x.title,
                subtitle: `${x.products.length} producto${x.products.length === 1 ? '' : 's'}`,
              })),
            },
          ]
        : null,
    };
  }, [kind, t.tickets, t.error, t.eventId, p.products, p.error, p.eventId, b.blocks, b.error, b.eventId]);
}

function ReorderList({ kind, initial, eventId }: { kind: ReorderKind; initial: Group[]; eventId: string | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState(initial);
  const [saving, setSaving] = useState(false);

  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  const dirty = ids.join() !== initial.flatMap((g) => g.items.map((i) => i.id)).join();

  const move = (gi: number, ii: number, d: -1 | 1) => {
    Haptics.selectionAsync();
    setGroups((prev) =>
      prev.map((g, k) => {
        if (k !== gi) return g;
        const items = [...g.items];
        const j = ii + d;
        if (j < 0 || j >= items.length) return g;
        [items[ii], items[j]] = [items[j], items[ii]];
        return { ...g, items };
      }),
    );
  };

  const save = async () => {
    if (!eventId || !dirty) return;
    setSaving(true);
    const res = await saveOrder(eventId, kind, ids);
    setSaving(false);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('No se pudo guardar el orden', res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: TITLE[kind] }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]}
        contentInsetAdjustmentBehavior="automatic">
        <Text style={styles.hint}>{HINT[kind]}</Text>
        {ids.length === 0 ? <Text style={styles.hint}>No hay nada para ordenar todavía.</Text> : null}
        {groups.map((g, gi) => (
          <View key={g.title ?? gi} style={styles.group}>
            {g.title ? <GroupHeader title={g.title} count={g.items.length} /> : null}
            {g.items.map((it, ii) => (
              <Animated.View key={it.id} layout={LinearTransition.duration(200)} style={styles.card}>
                <Text style={styles.pos}>{ii + 1}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {it.title}
                  </Text>
                  {it.subtitle ? <Text style={styles.subtitle}>{it.subtitle}</Text> : null}
                </View>
                <Arrow icon="arrowUp" label={`Subir ${it.title}`} disabled={ii === 0} onPress={() => move(gi, ii, -1)} />
                <Arrow
                  icon="arrowDown"
                  label={`Bajar ${it.title}`}
                  disabled={ii === g.items.length - 1}
                  onPress={() => move(gi, ii, 1)}
                />
              </Animated.View>
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          onPress={save}
          disabled={!dirty || saving}
          accessibilityRole="button"
          style={({ pressed }) => [styles.save, (!dirty || saving) && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}>
          {saving ? <ActivityIndicator color={colors.onInk} /> : <Text style={styles.saveText}>Guardar orden</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function Arrow({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'arrowUp' | 'arrowDown';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.arrow, disabled && { opacity: 0.25 }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={14} color={colors.ink} />
    </Pressable>
  );
}

function Loading({ error }: { error: string | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      {error ? <Text style={styles.hint}>{error}</Text> : <ActivityIndicator color={colors.textMuted} />}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, gap: Spacing.three },
    hint: { color: c.textMuted, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
    group: { gap: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    pos: { width: 22, color: c.textMuted, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
    title: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    subtitle: { color: c.textMuted, fontSize: 12 },
    arrow: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: Spacing.three,
      paddingTop: 12,
      backgroundColor: c.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    save: {
      height: 52,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.ink,
    },
    saveText: { color: c.onInk, fontSize: 16, fontFamily: DisplayFont.semibold },
  }),
);
