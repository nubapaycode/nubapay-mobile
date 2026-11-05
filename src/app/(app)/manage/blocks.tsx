import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { enter, enterRow } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { EventContext } from '@/components/events/event-context';
import { EmptyState, ProductThumb } from '@/components/manage/catalog-kit';
import { NoAccess } from '@/components/ui/no-access';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { useEventAccess } from '@/features/access/access';
import { formatInt } from '@/features/dashboard/format';
import { setBlockActive, useBlocks, useProducts } from '@/features/manage/manage';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import type { CatalogBlock } from '@/lib/api/organizer';
import { makeStyles, useTheme } from '@/theme';

const openBlock = (id: string) => router.push({ pathname: '/manage/block/[id]', params: { id } });
const MAX_THUMBS = 4;

/**
 * Bloques de la tienda (routes/event_workspace.py `/blocks`): secciones destacadas arriba del
 * catálogo. Arriba, de qué evento es la tienda; después un resumen, crear / ordenar y cada bloque
 * en su card en el orden en que se ve: banner, posición, título, productos (miniaturas) y el switch
 * para mostrarlo u ocultarlo. Tocarlo abre la edición.
 */
export default function BlocksScreen() {
  const styles = useStyles();
  const { can } = useEventAccess();
  const { blocks, error, eventId } = useBlocks();
  const { products } = useProducts();
  useFocusStatusBar();

  const images = new Map((products ?? []).map((p) => [p.id, p.imageUri]));
  // En el orden en que se ven en la tienda (la posición de cada card sale de acá).
  const list = [...(blocks ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const visible = list.filter((b) => b.is_active).length;
  const featured = new Set(list.flatMap((b) => b.products.map((p) => p.product_id))).size;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Animated.View entering={enter(0)}>
        <EventContext caption="Tienda de" />
      </Animated.View>

      {!can('products') ? (
        <NoAccess text="Tu rol en este evento no incluye editar la tienda." />
      ) : !blocks ? (
        error ? (
          <EmptyState icon="help" title="No pudimos cargar los bloques" text={error} />
        ) : (
          <Text style={styles.muted}>Cargando…</Text>
        )
      ) : (
        <>
          {list.length > 0 ? (
            <Animated.View entering={enter(1)} style={styles.stats}>
              <Stat label="Bloques" value={formatInt(list.length)} />
              <Stat label="Visibles" value={formatInt(visible)} />
              <Stat label="Productos" value={formatInt(featured)} />
            </Animated.View>
          ) : null}

          <Animated.View entering={enter(2)} style={styles.actions}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                openBlock('new');
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Icon name="plus" size={15} color={styles.primaryText.color} />
              <Text style={styles.primaryText}>Nuevo bloque</Text>
            </Pressable>
            {list.length > 1 ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({ pathname: '/manage/reorder', params: { kind: 'blocks' } });
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                <Icon name="blocks" size={14} color={styles.secondaryText.color} />
                <Text style={styles.secondaryText}>Ordenar</Text>
              </Pressable>
            ) : null}
          </Animated.View>

          {list.length === 0 ? (
            <Animated.View entering={FadeIn.duration(300)}>
              <EmptyState
                icon="blocks"
                title="Todavía no hay bloques"
                text='Los bloques destacan productos arriba del catálogo (por ejemplo "Lo más pedido" o "Promos de la noche").'
              />
            </Animated.View>
          ) : (
            <View style={styles.list}>
              <Text style={styles.sectionTitle}>En la tienda, en este orden</Text>
              {list.map((b, i) => (
                <BlockCard
                  key={b.id}
                  block={b}
                  index={i}
                  images={images}
                  onToggle={(v) => eventId && setBlockActive(eventId, b.id, v)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.card, styles.stat]}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function BlockCard({
  block: b,
  index,
  images,
  onToggle,
}: {
  block: CatalogBlock;
  index: number;
  images: Map<string, string | null>;
  onToggle: (v: boolean) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const shown = b.products.slice(0, MAX_THUMBS);
  const extra = b.products.length - shown.length;

  return (
    <Animated.View entering={enterRow(index)} layout={LinearTransition.duration(260)}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          openBlock(b.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${b.title}, ${b.products.length} productos${b.is_active ? '' : ', oculto'}. Editar`}
        style={({ pressed }) => [styles.card, styles.block, !b.is_active && styles.blockOff, pressed && styles.pressed]}>
        {b.banner_image_url ? (
          <Image
            source={{ uri: b.banner_image_url }}
            style={[styles.banner, !b.is_active && { opacity: 0.5 }]}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.banner, styles.noBanner]}>
            <Icon name="photo" size={16} color={colors.textMuted} />
            <Text style={styles.noBannerText}>Sin banner</Text>
          </View>
        )}

        <View style={styles.blockBody}>
          <View style={styles.blockHead}>
            <View style={styles.position}>
              <Text style={styles.positionText}>{index + 1}</Text>
            </View>
            <View style={styles.grow}>
              <Text style={[styles.title, !b.is_active && styles.off]} numberOfLines={1}>
                {b.title}
              </Text>
              <Text style={styles.meta}>
                {b.is_active ? 'Visible' : 'Oculto'} · {b.products.length}{' '}
                {b.products.length === 1 ? 'producto' : 'productos'}
              </Text>
            </View>
            <Switch
              value={b.is_active}
              onValueChange={(v) => {
                Haptics.selectionAsync();
                onToggle(v);
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={`${b.title}: ${b.is_active ? 'visible' : 'oculto'}`}
            />
          </View>

          {shown.length > 0 ? (
            <View style={styles.thumbs}>
              {shown.map((p) => (
                <View key={p.product_id} style={styles.thumbItem}>
                  <ProductThumb
                    uri={images.get(p.product_id) ?? null}
                    name={p.name}
                    combo={p.type === 'combo'}
                    size={44}
                    dim={!p.is_active}
                  />
                  <Text style={styles.thumbName} numberOfLines={1}>
                    {p.name}
                  </Text>
                </View>
              ))}
              {extra > 0 ? (
                <View style={styles.thumbItem}>
                  <View style={styles.more}>
                    <Text style={styles.moreText}>+{extra}</Text>
                  </View>
                  <Text style={styles.thumbName}> </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.meta}>Sin productos todavía</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: 20 },
    muted: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
    pressed: { opacity: 0.8 },
    grow: { flex: 1, gap: 2 },
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },

    stats: { flexDirection: 'row', gap: 8 },
    stat: { flex: 1, gap: 4, padding: 12 },
    statLabel: { color: c.textSecondary, fontSize: 11 },
    statValue: {
      color: c.text,
      fontSize: 20,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.4,
      fontVariant: ['tabular-nums'],
    },

    actions: { flexDirection: 'row', gap: 8 },
    primary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.ink,
    },
    primaryText: { color: c.onInk, fontSize: 15, fontFamily: DisplayFont.semibold },
    secondary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 50,
      paddingHorizontal: 18,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.raised,
    },
    secondaryText: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },

    list: { gap: 10 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },

    block: { overflow: 'hidden' },
    blockOff: { backgroundColor: c.canvas },
    banner: { height: 96, backgroundColor: c.raised },
    noBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    noBannerText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    blockBody: { padding: 14, gap: 12 },
    blockHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    position: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    positionText: { color: c.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
    title: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    off: { color: c.textMuted },
    meta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },

    thumbs: { flexDirection: 'row', gap: 10 },
    thumbItem: { width: 56, alignItems: 'center', gap: 4 },
    thumbName: { color: c.textSecondary, fontSize: 10, textAlign: 'center', width: '100%' },
    more: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    moreText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  }),
);
