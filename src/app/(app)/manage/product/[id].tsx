import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import type { ImagePickerOptions } from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
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
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatInt, formatMoney } from '@/features/dashboard/format';
import {
  addCategory,
  deleteProduct,
  type Product,
  type ProductInput,
  saveProduct,
  useCategories,
  useProducts,
} from '@/features/manage/manage';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { loadImagePicker } from '@/lib/native-modules';
import { makeStyles, useTheme } from '@/theme';

const LAYOUT = LinearTransition.duration(240);
const PICK: ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};

/** "12.500" / "12500" → 12500. */
const parseAmount = (s: string) => {
  const n = Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Producto: alta (`id` = "new") y edición, contra el backend (routes/event_workspace.py).
 * Foto (galería o cámara, se sube al guardar), nombre, descripción, precio, categoría (existente o
 * nueva) y, al editar, si está a la venta.
 */
export default function ProductScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, eventId } = useProducts();
  useFocusStatusBar('dark');

  const isNew = id === 'new';
  const product = isNew ? undefined : products?.find((p) => p.id === id);

  if (!isNew && !product) {
    return (
      <View style={styles.missing}>
        {products ? (
          <Text style={styles.missingText}>No encontramos este producto.</Text>
        ) : (
          <ActivityIndicator color={colors.textMuted} />
        )}
      </View>
    );
  }
  return <ProductForm key={product?.id ?? 'new'} product={product} eventId={eventId} />;
}

function ProductForm({ product, eventId }: { product?: Product; eventId: string | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isNew = !product;
  const categoryList = useCategories().data ?? [];
  const categories = categoryList.map((c) => c.name);
  const [saving, setSaving] = useState(false);

  const initial = useMemo(
    () => ({
      imageUri: product?.imageUri ?? null,
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product ? String(product.price) : '',
      category: product?.category ?? null,
      active: product?.isActive ?? true,
    }),
    [product],
  );

  const [imageUri, setImageUri] = useState(initial.imageUri);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [price, setPrice] = useState(initial.price);
  const [category, setCategory] = useState<string | null>(initial.category);
  const [active, setActiveState] = useState(initial.active);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const amount = parseAmount(price);
  const errors = {
    name: name.trim().length >= 2 ? null : 'Poné un nombre',
    price: price.trim() && amount >= 0 ? null : 'Poné un precio',
  };
  const valid = !errors.name && !errors.price;
  const dirty =
    imageUri !== initial.imageUri ||
    name !== initial.name ||
    description !== initial.description ||
    price !== initial.price ||
    category !== initial.category ||
    active !== initial.active;
  const canSave = valid && (isNew || dirty) && !saving;

  const save = async () => {
    setTouched(true);
    if (!valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!canSave || !eventId) return;
    setSaving(true);
    const input: ProductInput = {
      name: name.trim(),
      description: description.trim() || null,
      imageUri,
      price: amount,
      category,
    };
    const res = await saveProduct(eventId, input, product, isNew ? undefined : active);
    setSaving(false);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('No se pudo guardar', res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const remove = () =>
    Alert.alert('Eliminar producto', `“${product?.name}” deja de estar en el catálogo.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (!product || !eventId) return;
          const res = await deleteProduct(eventId, product.id);
          if (!res.ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('No se pudo eliminar', res.error);
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.back();
        },
      },
    ]);

  const pick = async (source: 'library' | 'camera') => {
    Haptics.selectionAsync();
    // Se carga al usarlo: si el build instalado no lo tiene, solo avisa (no rompe la pantalla).
    const ImagePicker = await loadImagePicker();
    if (!ImagePicker) return;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Sin acceso a la cámara', 'Habilitá el permiso de cámara desde Ajustes.');
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(PICK)
        : await ImagePicker.launchImageLibraryAsync(PICK);
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const createCategory = async () => {
    const n = (newCategory ?? '').trim();
    if (!n || !eventId) return;
    Haptics.selectionAsync();
    const res = await addCategory(eventId, n);
    if (!res.ok) {
      Alert.alert('No se pudo crear la categoría', res.error);
      return;
    }
    setCategory(n);
    setNewCategory(null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Nuevo producto' : 'Editar producto',
          ...(Platform.OS === 'ios'
            ? {
                // Botón nativo con la cápsula de vidrio; en azul cuando se puede guardar.
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
                headerRight: () => (
                  <SaveText label={isNew ? 'Crear' : 'Guardar'} enabled={canSave} onPress={save} />
                ),
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
          {/* Foto */}
          <Animated.View entering={enter(0)} style={styles.photoBlock}>
            <Pressable
              onPress={() => pick('library')}
              accessibilityRole="button"
              accessibilityLabel={imageUri ? 'Cambiar foto' : 'Agregar foto'}
              style={styles.photo}>
              {imageUri ? (
                <Animated.View key={imageUri} entering={FadeIn.duration(300)} style={StyleSheet.absoluteFill}>
                  <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                </Animated.View>
              ) : (
                <View style={styles.photoEmpty}>
                  <Icon name="photo" size={26} color={colors.textMuted} />
                  <Text style={styles.photoHint}>Agregar foto</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.photoActions}>
              <SmallButton icon="photo" label={imageUri ? 'Cambiar' : 'Galería'} onPress={() => pick('library')} />
              <SmallButton icon="camera" label="Cámara" onPress={() => pick('camera')} />
              {imageUri ? (
                <SmallButton
                  icon="trash"
                  label="Quitar"
                  danger
                  onPress={() => {
                    Haptics.selectionAsync();
                    setImageUri(null);
                  }}
                />
              ) : null}
            </View>
          </Animated.View>

          {/* Detalles */}
          <Section title="Detalles" index={1}>
            <Field label="Nombre" error={touched ? errors.name : null}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ej: Fernet con coca"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="sentences"
                style={styles.input}
                accessibilityLabel="Nombre"
              />
            </Field>
            <Field label="Descripción (opcional)" divider>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Ej: Fernet Branca con Coca-Cola, 500 ml"
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                maxLength={300}
                style={[styles.input, styles.textarea]}
                accessibilityLabel="Descripción"
              />
            </Field>
            <Field label="Precio" error={touched ? errors.price : null} divider>
              <View style={styles.priceRow}>
                <Text style={styles.currency}>$</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={[styles.input, styles.priceInput]}
                  accessibilityLabel="Precio"
                />
              </View>
            </Field>
          </Section>

          {/* Categoría: elegir una o crear una nueva */}
          <Animated.View entering={enter(2)} layout={LAYOUT} style={styles.section}>
            <Text style={styles.sectionTitle}>Categoría</Text>
            <View style={styles.chips}>
              <CategoryChip label="Sin categoría" on={category == null} onPress={() => setCategory(null)} />
              {categories.map((c) => (
                <CategoryChip key={c} label={c} on={category === c} onPress={() => setCategory(c)} />
              ))}
              {newCategory == null ? (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setNewCategory('');
                  }}
                  accessibilityRole="button"
                  style={[styles.chip, styles.chipNew]}>
                  <Icon name="plus" size={12} color="#000000" />
                  <Text style={styles.chipText}>Nueva</Text>
                </Pressable>
              ) : null}
            </View>
            {newCategory != null ? (
              <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)} style={styles.newCategory}>
                <TextInput
                  value={newCategory}
                  onChangeText={setNewCategory}
                  placeholder="Nombre de la categoría"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  onSubmitEditing={createCategory}
                  style={[styles.input, { flex: 1 }]}
                  accessibilityLabel="Nueva categoría"
                />
                <Pressable onPress={() => setNewCategory(null)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.cancel}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={createCategory}
                  disabled={!newCategory.trim()}
                  accessibilityRole="button"
                  style={[styles.create, !newCategory.trim() && { backgroundColor: colors.raised }]}>
                  <Text style={[styles.createText, !newCategory.trim() && { color: colors.textMuted }]}>
                    Crear
                  </Text>
                </Pressable>
              </Animated.View>
            ) : null}
          </Animated.View>

          {!isNew ? (
            <Section title="Venta" index={3}>
              <ToggleRow
                title="A la venta"
                description="Si lo pausás, deja de aparecer en el catálogo"
                value={active}
                onValueChange={setActiveState}
              />
            </Section>
          ) : null}

          {!isNew && product ? (
            <Animated.View entering={enter(4)} style={{ gap: 12 }}>
              <Text style={styles.stat}>
                {product.sold > 0
                  ? `${formatInt(product.sold)} vendidos · ${formatMoney(product.sold * product.price)} recaudado`
                  : 'Todavía sin ventas registradas'}
              </Text>
              <Pressable
                onPress={remove}
                accessibilityRole="button"
                style={({ pressed }) => [styles.delete, pressed && { opacity: 0.7 }]}>
                <Text style={styles.deleteText}>Eliminar producto</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Section({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Animated.View entering={enter(index)} layout={LAYOUT} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </Animated.View>
  );
}

function Field({
  label,
  error,
  divider,
  children,
}: {
  label: string;
  error?: string | null;
  divider?: boolean;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.field, divider && styles.divider]}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onValueChange,
  divider,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  divider?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toggle = (v: boolean) => {
    Haptics.selectionAsync();
    onValueChange(v);
  };
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => toggle(!value)}
      style={[styles.toggleRow, divider && styles.divider]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleText}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={toggle} trackColor={{ true: colors.primary, false: colors.border }} />
    </Pressable>
  );
}

function CategoryChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={() => {
        if (on) return;
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: 'photo' | 'camera' | 'trash';
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.small, pressed && { backgroundColor: colors.border }]}>
      <Icon name={icon} size={14} color={danger ? colors.danger : '#000000'} />
      <Text style={[styles.smallText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const FADE = { duration: 300, easing: Easing.inOut(Easing.quad) };

/** "Guardar" en Android: texto que pasa de gris a negro cuando se puede guardar. */
function SaveText({ label, enabled, onPress }: { label: string; enabled: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const on = useSharedValue(enabled ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(enabled ? 1 : 0, FADE));
  }, [enabled, on]);
  const fg = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [colors.textMuted, colors.text]),
  }));
  return (
    <Pressable onPress={onPress} disabled={!enabled} hitSlop={10} accessibilityRole="button" style={styles.saveText}>
      <Animated.Text style={[styles.saveLabel, fg]}>{label}</Animated.Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#ffffff' },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },

    photoBlock: { alignItems: 'center', gap: 12 },
    photo: {
      width: 148,
      height: 148,
      borderRadius: 28,
      borderCurve: 'continuous',
      overflow: 'hidden',
      backgroundColor: c.canvas,
      borderWidth: 1,
      borderColor: c.border,
    },
    photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
    photoHint: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    photoActions: { flexDirection: 'row', gap: 8 },
    small: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 34,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    smallText: { color: '#000000', fontSize: 13, fontFamily: DisplayFont.semibold },

    section: { gap: 8 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    card: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
    },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },
    field: { paddingTop: 11, paddingBottom: 7, gap: 2 },
    fieldHead: { flexDirection: 'row', justifyContent: 'space-between' },
    fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    fieldError: { color: c.danger, fontSize: 12 },
    input: { color: c.text, fontSize: 16, paddingVertical: 6, paddingHorizontal: 0 },
    textarea: { minHeight: 64, lineHeight: 22 },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    currency: { color: c.textMuted, fontSize: 20, fontFamily: DisplayFont.semibold },
    priceInput: { flex: 1, fontSize: 22, fontFamily: DisplayFont.bold },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    chipOn: { backgroundColor: '#000000' },
    chipNew: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: c.border, borderStyle: 'dashed' },
    chipText: { color: '#000000', fontSize: 14, fontWeight: '600' },
    chipTextOn: { color: '#ffffff' },
    newCategory: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 50,
      paddingLeft: 14,
      paddingRight: 6,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
    },
    cancel: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    create: {
      height: 38,
      paddingHorizontal: 14,
      borderRadius: Radius.md,
      justifyContent: 'center',
      backgroundColor: '#000000',
    },
    createText: { color: '#ffffff', fontSize: 14, fontFamily: DisplayFont.semibold },

    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    toggleTitle: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    toggleText: { color: c.textMuted, fontSize: 13 },

    stat: { color: c.textMuted, fontSize: 13, textAlign: 'center', fontVariant: ['tabular-nums'] },
    delete: {
      height: 52,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    deleteText: { color: c.danger, fontSize: 16, fontFamily: DisplayFont.semibold },

    saveText: { paddingHorizontal: 8, height: 32, justifyContent: 'center' },
    saveLabel: { fontSize: 16, fontFamily: DisplayFont.semibold },

    missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
    missingText: { color: c.textSecondary, fontSize: 15 },
  }),
);
