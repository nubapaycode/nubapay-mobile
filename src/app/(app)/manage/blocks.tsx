import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/dashboard/icon';
import { HeaderAction } from '@/components/manage/catalog-kit';
import { ItemCard, ManageScreen, ManageSummary } from '@/components/manage/manage-ui';
import { NoAccess } from '@/components/ui/no-access';
import { Radius } from '@/constants/theme';
import { useEventAccess } from '@/features/access/access';
import { formatInt } from '@/features/dashboard/format';
import { setBlockActive, useBlocks } from '@/features/manage/manage';
import { makeStyles } from '@/theme';

const openBlock = (id: string) => router.push({ pathname: '/manage/block/[id]', params: { id } });

/**
 * Bloques de la tienda (routes/event_workspace.py `/blocks`): secciones destacadas arriba del
 * catálogo, cada una con título, banner opcional y sus productos. Cada bloque en su card con el
 * switch para mostrarlo u ocultarlo; tocarlo abre la edición.
 */
export default function BlocksScreen() {
  const styles = useStyles();
  const { can } = useEventAccess();
  const { blocks, error, eventId } = useBlocks();

  if (!can('products')) {
    return (
      <ManageScreen>
        <NoAccess text="Tu rol en este evento no incluye editar la tienda." />
      </ManageScreen>
    );
  }

  const list = blocks ?? [];
  const visible = list.filter((b) => b.is_active).length;

  return (
    <ManageScreen
      summary={
        blocks ? (
          <View style={styles.summaryRow}>
            <ManageSummary
              value={formatInt(list.length)}
              label={`${list.length === 1 ? 'bloque' : 'bloques'} · ${formatInt(visible)} visible${visible === 1 ? '' : 's'}`}
            />
            {list.length > 1 ? (
              <HeaderAction
                label="Ordenar"
                onPress={() => router.push({ pathname: '/manage/reorder', params: { kind: 'blocks' } })}
              />
            ) : null}
          </View>
        ) : undefined
      }
      addLabel="Nuevo bloque"
      onAdd={() => openBlock('new')}
      loading={!blocks && !error}
      empty={
        error ??
        (blocks && list.length === 0
          ? 'Los bloques destacan productos arriba del catálogo (por ejemplo "Lo más pedido" o "Promos de la noche").'
          : null)
      }>
      {list.map((b, i) => (
        <Pressable key={b.id} onPress={() => openBlock(b.id)} accessibilityRole="button">
          <ItemCard
            index={i}
            title={b.title}
            subtitle={`${b.products.length} producto${b.products.length === 1 ? '' : 's'}${
              b.products.length ? ` · ${b.products.slice(0, 3).map((p) => p.name).join(', ')}` : ''
            }`}
            active={b.is_active}
            onToggle={(v) => eventId && setBlockActive(eventId, b.id, v)}
            footer={
              b.banner_image_url ? (
                <Image source={{ uri: b.banner_image_url }} style={styles.banner} contentFit="cover" transition={200} />
              ) : (
                <View style={styles.noBanner}>
                  <Icon name="photo" size={13} />
                  <Text style={styles.noBannerText}>Sin banner</Text>
                </View>
              )
            }
          />
        </Pressable>
      ))}
    </ManageScreen>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 4 },
    banner: { height: 84, borderRadius: Radius.lg, backgroundColor: c.raised },
    noBanner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    noBannerText: { color: c.textMuted, fontSize: 12 },
  }),
);
