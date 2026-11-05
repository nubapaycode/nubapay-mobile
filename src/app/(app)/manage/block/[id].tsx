import { Image } from 'expo-image';
import type { ImagePickerOptions } from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { Card, CardList, GroupHeader, HeaderAction, ProductThumb, SaveText } from '@/components/manage/catalog-kit';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { openBlockProductsPicker } from '@/features/manage/combo-picker';
import { type CatalogBlock, removeBlock, saveBlock, useBlocks, useProducts } from '@/features/manage/manage';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { loadImagePicker } from '@/lib/native-modules';
import { makeStyles, useTheme } from '@/theme';
import { toast } from '@/components/ui/toast';

const LAYOUT = LinearTransition.duration(240);
const PICK: ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [3, 1], quality: 0.8 };
const TITLE_MAX = 120;

/** Bloque de la tienda: alta (`id` = "new") y edición. Título, banner, si se muestra y sus productos. */
export default function BlockScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { blocks, error } = useBlocks();
  useFocusStatusBar();

  if (id === 'new') return <BlockForm />;
  const block = blocks?.find((b) => b.id === id);
  if (!block) {
    return (
      <View style={styles.missing}>
        {blocks || error ? (
          <Text style={styles.missingText}>{error ?? 'Este bloque ya no existe.'}</Text>
        ) : (
          <ActivityIndicator color={colors.textMuted} />
        )}
      </View>
    );
  }
  return <BlockForm key={block.id} block={block} />;
}

function BlockForm({ block }: { block?: CatalogBlock }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { products, eventId } = useProducts();
  const isNew = !block;

  const initial = useMemo(
    () => ({
      title: block?.title ?? '',
      active: block?.is_active ?? true,
      banner: block?.banner_image_url ?? null,
      ids: block?.products.map((p) => p.product_id) ?? [],
    }),
    [block],
  );
  const [title, setTitle] = useState(initial.title);
  const [active, setActive] = useState(initial.active);
  const [banner, setBanner] = useState<string | null>(initial.banner);
  const [ids, setIds] = useState<string[]>(initial.ids);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const fallbackName = (pid: string) => block?.products.find((p) => p.product_id === pid)?.name ?? 'Producto';

  const titleError = title.trim().length >= 2 ? null : 'Poné un título';
  const dirty =
    title !== initial.title || active !== initial.active || banner !== initial.banner || ids.join() !== initial.ids.join();
  const canSave = !titleError && (isNew || dirty) && !saving;

  const save = async () => {
    setTouched(true);
    if (titleError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!canSave || !eventId) return;
    setSaving(true);
    const res = await saveBlock(eventId, { title, isActive: active, productIds: ids, bannerUri: banner }, block);
    setSaving(false);
    if (!res.ok) {
      toast.error('No se pudo guardar', res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const remove = () =>
    Alert.alert('Eliminar bloque', `“${block?.title}” deja de mostrarse en la tienda. Los productos no se borran.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (!block || !eventId) return;
          const res = await removeBlock(eventId, block.id);
          if (!res.ok) {
            toast.error('No se pudo eliminar', res.error);
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.back();
        },
      },
    ]);

  const pick = async (source: 'library' | 'camera') => {
    const ImagePicker = await loadImagePicker();
    if (!ImagePicker) return;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        toast.error('Sin acceso a la cámara', 'Habilitá el permiso de cámara desde Ajustes.');
        return;
      }
    }
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(PICK) : await ImagePicker.launchImageLibraryAsync(PICK);
    if (!result.canceled && result.assets[0]) setBanner(result.assets[0].uri);
  };

  const chooseBanner = () => {
    Haptics.selectionAsync();
    const options = ['Elegir de la galería', 'Sacar una foto', ...(banner ? ['Quitar banner'] : []), 'Cancelar'];
    const run = (i: number) => {
      if (i === 0) pick('library');
      else if (i === 1) pick('camera');
      else if (banner && i === 2) setBanner(null);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: banner ? 2 : undefined },
        run,
      );
    } else {
      Alert.alert('Banner', undefined, [
        ...options.slice(0, -1).map((text, i) => ({
          text,
          onPress: () => run(i),
          style: (banner && i === 2 ? 'destructive' : 'default') as 'destructive' | 'default',
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ]);
    }
  };

  const move = (i: number, d: -1 | 1) => {
    Haptics.selectionAsync();
    setIds((prev) => {
      const next = [...prev];
      const j = i + d;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Nuevo bloque' : 'Editar bloque',
          ...(Platform.OS === 'ios'
            ? {
                unstable_headerRightItems: () => [
                  {
                    type: 'button',
                    label: isNew ? 'Crear' : 'Guardar',
                    onPress: save,
                    disabled: !canSave,
                    variant: canSave ? 'prominent' : 'plain',
                    tintColor: canSave ? colors.primary : colors.text,
                    labelStyle: { fontFamily: DisplayFont.semibold, fontSize: 16 },
                  },
                ],
              }
            : {
                headerRight: () => <SaveText label={isNew ? 'Crear' : 'Guardar'} enabled={canSave} onPress={save} />,
              }),
        }}
      />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          <Animated.View entering={enter(0)} style={styles.section}>
            <GroupHeader title="Bloque" />
            <Card danger={touched && !!titleError}>
              <View style={styles.field}>
                <Text style={styles.label}>Título</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ej: Lo más pedido"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="sentences"
                  autoFocus={isNew}
                  maxLength={TITLE_MAX}
                  style={styles.input}
                  accessibilityLabel="Título"
                />
                {touched && titleError ? <Text style={styles.error}>{titleError}</Text> : null}
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={enter(1)} style={styles.section}>
            <GroupHeader title="Banner" />
            <Pressable
              onPress={chooseBanner}
              accessibilityRole="button"
              accessibilityLabel={banner ? 'Cambiar banner' : 'Agregar banner'}
              style={({ pressed }) => [styles.banner, pressed && { opacity: 0.85 }]}>
              {banner ? (
                <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : (
                <View style={styles.bannerEmpty}>
                  <Icon name="photo" size={20} color={colors.textMuted} />
                  <Text style={styles.bannerText}>Agregar banner (opcional)</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          <Animated.View entering={enter(2)} layout={LAYOUT} style={styles.section}>
            <GroupHeader
              title="Productos"
              count={ids.length}
              action={
                <HeaderAction label={ids.length ? 'Elegir' : 'Agregar'} onPress={() => openBlockProductsPicker(ids, setIds)} />
              }
            />
            {ids.length === 0 ? (
              <Pressable
                onPress={() => openBlockProductsPicker(ids, setIds)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.addProducts, pressed && { backgroundColor: colors.border }]}>
                <Icon name="plus" size={15} color={colors.ink} />
                <Text style={styles.addProductsText}>Agregar productos</Text>
              </Pressable>
            ) : (
              <CardList>
                {ids.map((pid, i) => {
                  const p = byId.get(pid);
                  const name = p?.name ?? fallbackName(pid);
                  return (
                    <Animated.View key={pid} entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} layout={LAYOUT}>
                      <Card>
                        <View style={styles.productRow}>
                          <ProductThumb uri={p?.imageUri ?? null} name={name} size={40} />
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={[styles.productName, p && !p.isActive && styles.off]} numberOfLines={1}>
                              {name}
                            </Text>
                            {p && !p.isActive ? <Text style={styles.productMeta}>Pausado: no se muestra</Text> : null}
                          </View>
                          <SmallButton icon="arrowUp" label={`Subir ${name}`} disabled={i === 0} onPress={() => move(i, -1)} />
                          <SmallButton
                            icon="arrowDown"
                            label={`Bajar ${name}`}
                            disabled={i === ids.length - 1}
                            onPress={() => move(i, 1)}
                          />
                          <SmallButton
                            icon="close"
                            label={`Quitar ${name}`}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setIds((prev) => prev.filter((x) => x !== pid));
                            }}
                          />
                        </View>
                      </Card>
                    </Animated.View>
                  );
                })}
              </CardList>
            )}
          </Animated.View>

          <Animated.View entering={enter(3)} style={styles.section}>
            <GroupHeader title="Tienda" />
            <Card>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setActive((v) => !v);
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: active }}
                style={styles.toggleRow}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.toggleTitle}>Mostrar en la tienda</Text>
                  <Text style={styles.toggleText}>
                    {active ? 'Se ve arriba del catálogo' : 'Oculto: no se muestra hasta que lo actives'}
                  </Text>
                </View>
                <Switch
                  value={active}
                  onValueChange={(v) => {
                    Haptics.selectionAsync();
                    setActive(v);
                  }}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </Pressable>
            </Card>
          </Animated.View>

          {!isNew ? (
            <Pressable
              onPress={remove}
              accessibilityRole="button"
              style={({ pressed }) => [styles.delete, pressed && { opacity: 0.6 }]}>
              <Icon name="trash" size={15} color={colors.danger} />
              <Text style={styles.deleteText}>Eliminar bloque</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function SmallButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'arrowUp' | 'arrowDown' | 'close';
  label: string;
  disabled?: boolean;
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
      style={({ pressed }) => [styles.small, disabled && { opacity: 0.25 }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={12} color={colors.ink} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },
    section: { gap: 10 },
    field: { gap: 4, paddingVertical: 4 },
    label: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    input: { color: c.text, fontSize: 16, paddingVertical: 6 },
    error: { color: c.danger, fontSize: 13 },
    banner: {
      height: 120,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      overflow: 'hidden',
      backgroundColor: c.raised,
    },
    bannerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    bannerText: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
    addProducts: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.raised,
    },
    addProductsText: { color: c.ink, fontSize: 15, fontFamily: DisplayFont.semibold },
    productRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    productName: { color: c.text, fontSize: 15, fontWeight: '500' },
    productMeta: { color: c.textMuted, fontSize: 12 },
    off: { color: c.textMuted },
    small: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
    toggleTitle: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    toggleText: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
    delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 },
    deleteText: { color: c.danger, fontSize: 15, fontFamily: DisplayFont.semibold },
    missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    missingText: { color: c.textSecondary, fontSize: 15 },
  }),
);
