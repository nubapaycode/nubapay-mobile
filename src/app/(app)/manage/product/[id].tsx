import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import type { ImagePickerOptions } from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { type ReactNode, useMemo, useState } from "react";
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
} from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { enter } from "@/components/dashboard/detail-kit";
import { Icon, type IconName } from "@/components/dashboard/icon";
import {
  Card,
  CardList,
  ComboSavings,
  GroupHeader,
  ProductThumb,
  SaveText,
} from "@/components/manage/catalog-kit";
import {
  PromoSection,
  promoAnchor,
  usePromoDraft,
} from "@/components/manage/promo-section";
import { DisplayFont, Radius, Spacing } from "@/constants/theme";
import { useDashboardSnapshot } from "@/features/dashboard/dashboard-store";
import { formatInt, formatMoney } from "@/features/dashboard/format";
import { openCategoryPicker } from "@/features/manage/category-picker";
import { openComboPicker } from "@/features/manage/combo-picker";
import {
  deleteProduct,
  type ComboLine,
  type Product,
  type ProductInput,
  saveProduct,
  useProducts,
} from "@/features/manage/manage";
import { useFocusStatusBar } from "@/hooks/use-focus-status-bar";
import { loadImagePicker } from "@/lib/native-modules";
import { makeStyles, useTheme } from "@/theme";

const LAYOUT = LinearTransition.duration(240);
const PICK: ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};
const DESCRIPTION_MAX = 300;

/** "12.500" / "12500" → 12500. */
const parseAmount = (s: string) => {
  const n = Number(
    s
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.]/g, ""),
  );
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Producto o combo: alta (`id` = "new"; `type=combo` para un combo) y edición, contra el backend (routes/event_workspace.py).
 * Foto (galería o cámara, se sube al guardar), nombre, descripción, precio, categoría (existente o
 * nueva) y, al editar, si está a la venta. Un combo suma además los productos que lo forman, con
 * su cantidad (el backend solo acepta productos simples dentro de un combo).
 */
export default function ProductScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const { products, eventId } = useProducts();
  useFocusStatusBar();

  const isNew = id === "new";
  const product = isNew ? undefined : products?.find((p) => p.id === id);
  const combo = product ? product.type === "combo" : type === "combo";

  if (!isNew && !product) {
    return (
      <View style={styles.missing}>
        {products ? (
          <Text style={styles.missingText}>
            No encontramos este {combo ? "combo" : "producto"}.
          </Text>
        ) : (
          <ActivityIndicator color={colors.textMuted} />
        )}
      </View>
    );
  }
  return (
    <ProductForm
      key={product?.id ?? `new-${combo ? "combo" : "single"}`}
      product={product}
      combo={combo}
      singles={products?.filter((p) => p.type === "single") ?? []}
      eventId={eventId}
    />
  );
}

/** Para comparar las líneas del combo (orden + cantidades). */
const linesKey = (lines: ComboLine[]) =>
  lines.map((l) => `${l.productId}x${l.quantity}`).join(",");

/**
 * Formulario (patrón Shopify / Squarespace): portada grande con sus acciones, métricas de venta
 * (al editar), "Detalles" y "Precio" en cards agrupadas, productos del combo con el ahorro frente a
 * comprarlos por separado y "Organización" (categoría y si está a la venta).
 */
function ProductForm({
  product,
  combo,
  singles,
  eventId,
}: {
  product?: Product;
  /** Es un combo: se editan también sus productos. */
  combo: boolean;
  /** Productos simples del catálogo (lo que puede ir dentro de un combo). */
  singles: Product[];
  eventId: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isNew = !product;
  const noun = combo ? "combo" : "producto";
  const [saving, setSaving] = useState(false);

  const initial = useMemo(
    () => ({
      imageUri: product?.imageUri ?? null,
      name: product?.name ?? "",
      description: product?.description ?? "",
      price: product ? String(product.price) : "",
      category: product?.category ?? null,
      active: product?.isActive ?? true,
      lines: product?.lines ?? [],
    }),
    [product],
  );

  const [imageUri, setImageUri] = useState(initial.imageUri);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [price, setPrice] = useState(initial.price);
  const [category, setCategory] = useState<string | null>(initial.category);
  const [active, setActiveState] = useState(initial.active);
  const [lines, setLines] = useState<ComboLine[]>(initial.lines);
  const [touched, setTouched] = useState(false);

  const amount = parseAmount(price);

  // Promoción: las horas se anclan al día del evento.
  const snapshot = useDashboardSnapshot();
  const eventStartIso =
    snapshot?.eventId === eventId
      ? snapshot.data.insights.event.starts_at
      : null;
  const anchor = useMemo(() => promoAnchor(eventStartIso), [eventStartIso]);
  const promo = usePromoDraft(product?.promo ?? null, amount, anchor);

  const errors = {
    name: name.trim().length >= 2 ? null : "Poné un nombre",
    price: price.trim() && amount >= 0 ? null : "Poné un precio",
    lines: !combo || lines.length > 0 ? null : "Sumá al menos un producto",
  };
  const valid = !errors.name && !errors.price && !errors.lines && !promo.error;
  const dirty =
    imageUri !== initial.imageUri ||
    name !== initial.name ||
    description !== initial.description ||
    price !== initial.price ||
    category !== initial.category ||
    active !== initial.active ||
    (combo && linesKey(lines) !== linesKey(initial.lines)) ||
    promo.dirty;
  const canSave = valid && (isNew || dirty) && !saving;

  // Lo que costarían los productos del combo por separado (para ayudar a poner precio).
  const byId = useMemo(() => new Map(singles.map((p) => [p.id, p])), [singles]);
  const separate = combo
    ? lines.reduce(
        (a, l) => a + (byId.get(l.productId)?.price ?? 0) * l.quantity,
        0,
      )
    : 0;

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
      ...(combo ? { lines } : {}),
    };
    // Promo: se manda si cambió (o si cambió el precio, para recalcular el precio promo); se quita si se apagó.
    const promoChange = promo.enabled
      ? promo.dirty || price !== initial.price
        ? promo.input
        : undefined
      : promo.dirty
        ? null
        : undefined;
    const res = await saveProduct(
      eventId,
      input,
      product,
      isNew ? undefined : active,
      promoChange,
    );
    setSaving(false);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("No se pudo guardar", res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const remove = () =>
    Alert.alert(
      `Eliminar ${noun}`,
      `“${product?.name}” deja de estar en el catálogo.`,
      [
        { text: "Volver", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            if (!product || !eventId) return;
            const res = await deleteProduct(eventId, product.id);
            if (!res.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("No se pudo eliminar", res.error);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          },
        },
      ],
    );

  const pick = async (source: "library" | "camera") => {
    Haptics.selectionAsync();
    // Se carga al usarlo: si el build instalado no lo tiene, solo avisa (no rompe la pantalla).
    const ImagePicker = await loadImagePicker();
    if (!ImagePicker) return;
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Sin acceso a la cámara",
          "Habilitá el permiso de cámara desde Ajustes.",
        );
        return;
      }
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(PICK)
        : await ImagePicker.launchImageLibraryAsync(PICK);
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const chooseCategory = () => {
    Haptics.selectionAsync();
    openCategoryPicker(category, setCategory);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: `${isNew ? "Nuevo" : "Editar"} ${noun}`,
          ...(Platform.OS === "ios"
            ? {
                // Botón nativo con la cápsula de vidrio; en azul cuando se puede guardar.
                unstable_headerRightItems: () => [
                  {
                    type: "button",
                    label: isNew ? "Crear" : "Guardar",
                    onPress: save,
                    disabled: !canSave,
                    variant: canSave ? "prominent" : "plain",
                    tintColor: canSave ? colors.primary : colors.text,
                    labelStyle: {
                      fontFamily: DisplayFont.semibold,
                      fontSize: 16,
                    },
                  },
                ],
              }
            : {
                headerRight: () => (
                  <SaveText
                    label={isNew ? "Crear" : "Guardar"}
                    enabled={canSave}
                    onPress={save}
                  />
                ),
              }),
        }}
      />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Portada */}
          <Animated.View entering={enter(0)}>
            <Cover
              uri={imageUri}
              onLibrary={() => pick("library")}
              onCamera={() => pick("camera")}
              onRemove={() => {
                Haptics.selectionAsync();
                setImageUri(null);
              }}
            />
          </Animated.View>

          {/* Métricas de venta (solo al editar) */}
          {product ? (
            <Animated.View entering={enter(1)} style={styles.stats}>
              <Stat label="Vendidos" value={formatInt(product.sold)} />
              <View style={styles.statDivider} />
              <Stat
                label="Recaudado"
                value={formatMoney(product.sold * product.price)}
              />
              <View style={styles.statDivider} />
              <Stat
                label="Estado"
                value={active ? "A la venta" : "Pausado"}
                tone={active ? "success" : "muted"}
              />
            </Animated.View>
          ) : null}

          {/* Detalles */}
          <Animated.View
            entering={enter(2)}
            layout={LAYOUT}
            style={styles.section}
          >
            <GroupHeader title="Detalles" />
            <CardList>
              <Card danger={touched && !!errors.name}>
                <Field label="Nombre" error={touched ? errors.name : null}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={
                      combo ? "Ej: Combo previa" : "Ej: Fernet con coca"
                    }
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="sentences"
                    style={styles.input}
                    accessibilityLabel="Nombre"
                  />
                </Field>
              </Card>
              <Card>
                <Field
                  label="Descripción"
                  hint={
                    description.length > 0
                      ? `${description.length}/${DESCRIPTION_MAX}`
                      : "Opcional"
                  }
                >
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder={
                      combo
                        ? "Ej: 2 fernets + 1 hamburguesa"
                        : "Ej: Fernet Branca con Coca-Cola, 500 ml"
                    }
                    placeholderTextColor={colors.textMuted}
                    multiline
                    textAlignVertical="top"
                    maxLength={DESCRIPTION_MAX}
                    style={[styles.input, styles.textarea]}
                    accessibilityLabel="Descripción"
                  />
                </Field>
              </Card>
            </CardList>
          </Animated.View>

          {/* Productos del combo */}
          {combo ? (
            <ComboSection
              lines={lines}
              onChange={setLines}
              singles={singles}
              byId={byId}
              error={touched ? errors.lines : null}
            />
          ) : null}

          {/* Precio */}
          <Animated.View
            entering={enter(3)}
            layout={LAYOUT}
            style={styles.section}
          >
            <GroupHeader title="Precio" />
            <Card danger={touched && !!errors.price}>
              <Field
                label={combo ? "Precio del combo" : "Precio de venta"}
                error={touched ? errors.price : null}
              >
                <View style={styles.priceRow}>
                  <Text
                    style={[styles.currency, price && { color: colors.text }]}
                  >
                    $
                  </Text>
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
            </Card>
            {combo && separate > 0 ? (
              <View style={styles.savingsWrap}>
                <ComboSavings
                  separate={separate}
                  price={Number.isFinite(amount) ? amount : 0}
                />
              </View>
            ) : null}
          </Animated.View>

          {/* Promoción */}
          <PromoSection draft={promo} index={4} touched={touched} />

          {/* Organización */}
          <Animated.View
            entering={enter(4)}
            layout={LAYOUT}
            style={styles.section}
          >
            <GroupHeader title="Organización" />
            <CardList>
              <Card>
                <Pressable
                  onPress={chooseCategory}
                  accessibilityRole="button"
                  accessibilityLabel={`Categoría: ${category ?? "sin categoría"}. Cambiar`}
                  style={({ pressed }) => [
                    styles.settingRow,
                    pressed && { backgroundColor: colors.canvas },
                  ]}
                >
                  <RowIcon name="tag" />
                  <Text style={styles.settingTitle}>Categoría</Text>
                  <Text
                    style={[
                      styles.settingValue,
                      !category && { color: colors.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {category ?? "Sin categoría"}
                  </Text>
                  <Icon
                    name="chevronRight"
                    size={13}
                    color={colors.textMuted}
                  />
                </Pressable>
              </Card>
              {!isNew ? (
                <Card>
                  <ToggleRow
                    icon="eye"
                    title="A la venta"
                    description={
                      active
                        ? "Visible en la caja"
                        : "Pausado: no aparece en la caja"
                    }
                    value={active}
                    onValueChange={setActiveState}
                  />
                </Card>
              ) : null}
            </CardList>
          </Animated.View>

          {!isNew && product ? (
            <Animated.View entering={enter(5)}>
              <Pressable
                onPress={remove}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.delete,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Icon name="trash" size={15} color={colors.danger} />
                <Text style={styles.deleteText}>Eliminar {noun}</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

/**
 * Portada: sin foto, un área punteada con "Galería" y "Cámara"; con foto, la imagen a lo ancho con
 * sus acciones flotando abajo a la derecha.
 */
function Cover({
  uri,
  onLibrary,
  onCamera,
  onRemove,
}: {
  uri: string | null;
  onLibrary: () => void;
  onCamera: () => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!uri) {
    return (
      <Pressable
        onPress={onLibrary}
        accessibilityRole="button"
        accessibilityLabel="Agregar foto"
        style={({ pressed }) => [
          styles.coverEmpty,
          pressed && { backgroundColor: colors.raised },
        ]}
      >
        <View style={styles.coverIcon}>
          <Icon name="photo" size={22} color={colors.ink} />
        </View>
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text style={styles.coverTitle}>Agregar foto</Text>
          <Text style={styles.coverHint}>
            Con foto se reconoce más rápido en la caja
          </Text>
        </View>
        <View style={styles.coverActions}>
          <PillButton icon="photo" label="Galería" onPress={onLibrary} />
          <PillButton icon="camera" label="Cámara" onPress={onCamera} />
        </View>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onLibrary}
      accessibilityRole="button"
      accessibilityLabel="Cambiar foto"
      style={styles.cover}
    >
      <Animated.View
        key={uri}
        entering={FadeIn.duration(300)}
        style={StyleSheet.absoluteFill}
      >
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </Animated.View>
      <View style={styles.coverOverlay}>
        <PillButton icon="photo" label="Cambiar" onPress={onLibrary} floating />
        <PillButton
          icon="camera"
          onPress={onCamera}
          floating
          accessibilityLabel="Sacar foto"
        />
        <PillButton
          icon="trash"
          onPress={onRemove}
          floating
          danger
          accessibilityLabel="Quitar foto"
        />
      </View>
    </Pressable>
  );
}

function PillButton({
  icon,
  label,
  danger,
  floating,
  accessibilityLabel,
  onPress,
}: {
  icon: IconName;
  label?: string;
  danger?: boolean;
  /** Sobre la foto: fondo blanco con sombra. */
  floating?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.pill,
        floating && styles.pillFloating,
        !label && styles.pillIconOnly,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Icon name={icon} size={14} color={danger ? colors.danger : colors.ink} />
      {label ? <Text style={styles.pillText}>{label}</Text> : null}
    </Pressable>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "muted";
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          tone === "success" && { color: colors.success },
          tone === "muted" && { color: colors.textMuted },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  /** A la derecha del label cuando no hay error (p. ej. "Opcional" o el contador). */
  hint?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {error ? (
          <Text style={styles.fieldError}>{error}</Text>
        ) : hint ? (
          <Text style={styles.fieldHint}>{hint}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function RowIcon({ name }: { name: IconName }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.rowIcon}>
      <Icon name={name} size={15} color={colors.ink} />
    </View>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  value,
  onValueChange,
}: {
  icon: IconName;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
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
      style={styles.settingRow}
    >
      <RowIcon name={icon} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.toggleText}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={toggle}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </Pressable>
  );
}

/**
 * Productos del combo: lista agrupada, cada uno con su cantidad (− / +; en 1, el − lo quita) y
 * "Editar" que abre la hoja `/manage/combo-products` (buscador + catálogo) para sumar o quitar varios.
 */
function ComboSection({
  lines,
  onChange,
  singles,
  byId,
  error,
}: {
  lines: ComboLine[];
  onChange: (lines: ComboLine[]) => void;
  singles: Product[];
  byId: Map<string, Product>;
  error: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const units = lines.reduce((a, l) => a + l.quantity, 0);

  const setQty = (productId: string, quantity: number) => {
    Haptics.selectionAsync();
    onChange(
      quantity < 1
        ? lines.filter((l) => l.productId !== productId)
        : lines.map((l) =>
            l.productId === productId ? { ...l, quantity } : l,
          ),
    );
  };
  // Al volver de la hoja: se mantienen las cantidades de lo que sigue elegido y lo nuevo entra con 1.
  const pick = () => {
    Haptics.selectionAsync();
    openComboPicker(
      lines.map((l) => l.productId),
      (ids) =>
        onChange(
          ids.flatMap((id) => {
            const prev = lines.find((l) => l.productId === id);
            if (prev) return [prev];
            const p = byId.get(id);
            return p ? [{ productId: id, quantity: 1, name: p.name }] : [];
          }),
        ),
    );
  };

  return (
    <Animated.View entering={enter(3)} layout={LAYOUT} style={styles.section}>
      <GroupHeader
        title="Incluye"
        count={units || undefined}
        action={
          error ? (
            <Text style={styles.fieldError}>{error}</Text>
          ) : lines.length > 0 ? (
            <Pressable
              onPress={pick}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Editar productos del combo"
            >
              <Text style={styles.link}>Editar</Text>
            </Pressable>
          ) : null
        }
      />

      {singles.length === 0 ? (
        <View style={styles.comboEmpty}>
          <Text style={styles.comboHint}>
            Primero creá productos en el catálogo para armar el combo.
          </Text>
        </View>
      ) : lines.length === 0 ? (
        <Pressable
          onPress={pick}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.comboAdd,
            error && { borderColor: colors.danger },
            pressed && { backgroundColor: colors.raised },
          ]}
        >
          <View style={styles.comboAddIcon}>
            <Icon name="plus" size={14} color={colors.ink} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={styles.comboAddText}>Agregar productos</Text>
            <Text style={styles.comboHint}>
              Elegí qué incluye y cuántos de cada uno
            </Text>
          </View>
          <Icon name="chevronRight" size={13} color={colors.textMuted} />
        </Pressable>
      ) : (
        <CardList>
          {lines.map((l) => {
            const p = byId.get(l.productId);
            return (
              <Animated.View
                key={l.productId}
                entering={FadeIn.duration(220)}
                layout={LAYOUT}
              >
                <Card>
                  <View style={styles.lineRow}>
                    <ProductThumb
                      uri={p?.imageUri ?? null}
                      name={p?.name ?? l.name}
                      size={44}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.lineName} numberOfLines={1}>
                        {p?.name ?? l.name}
                      </Text>
                      {p ? (
                        <Text style={styles.lineMeta}>
                          {l.quantity > 1
                            ? `${l.quantity} × ${formatMoney(p.price)}`
                            : formatMoney(p.price)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.stepper}>
                      <Pressable
                        onPress={() => setQty(l.productId, l.quantity - 1)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={
                          l.quantity > 1
                            ? `Restar ${l.name}`
                            : `Quitar ${l.name}`
                        }
                        style={({ pressed }) => [
                          styles.stepBtn,
                          pressed && { backgroundColor: colors.border },
                        ]}
                      >
                        <Icon
                          name={l.quantity > 1 ? "minus" : "trash"}
                          size={13}
                          color={l.quantity > 1 ? colors.ink : colors.danger}
                        />
                      </Pressable>
                      <Text style={styles.stepQty}>{l.quantity}</Text>
                      <Pressable
                        onPress={() => setQty(l.productId, l.quantity + 1)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Sumar ${l.name}`}
                        style={({ pressed }) => [
                          styles.stepBtn,
                          pressed && { backgroundColor: colors.border },
                        ]}
                      >
                        <Icon name="plus" size={13} color={colors.ink} />
                      </Pressable>
                    </View>
                  </View>
                </Card>
              </Animated.View>
            );
          })}
        </CardList>
      )}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: {
      padding: Spacing.three,
      paddingBottom: Spacing.six,
      gap: Spacing.four,
    },

    // Portada
    cover: {
      height: 220,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      overflow: "hidden",
      backgroundColor: c.raised,
    },
    coverOverlay: {
      position: "absolute",
      right: 12,
      bottom: 12,
      flexDirection: "row",
      gap: 8,
    },
    coverEmpty: {
      height: 220,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: c.border,
      backgroundColor: c.canvas,
    },
    coverIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.elevated,
    },
    coverTitle: {
      color: c.text,
      fontSize: 16,
      fontFamily: DisplayFont.semibold,
    },
    coverHint: { color: c.textMuted, fontSize: 13 },
    coverActions: { flexDirection: "row", gap: 8, marginTop: 4 },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 34,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      backgroundColor: c.elevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    pillFloating: {
      borderWidth: 0,
      boxShadow: "0 2px 10px rgba(11, 15, 23, 0.18)",
    },
    pillIconOnly: { width: 34, paddingHorizontal: 0, justifyContent: "center" },
    pillText: {
      color: c.ink,
      fontSize: 13,
      fontFamily: DisplayFont.semibold,
    },

    // Métricas
    stats: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      backgroundColor: c.canvas,
    },
    stat: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 6 },
    statLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    statValue: {
      color: c.text,
      fontSize: 17,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: "stretch",
      backgroundColor: c.border,
    },

    // Campos
    section: { gap: 8 },
    field: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 2 },
    fieldHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    },
    fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    fieldHint: {
      color: c.textMuted,
      fontSize: 12,
      fontVariant: ["tabular-nums"],
    },
    fieldError: { color: c.danger, fontSize: 12, fontWeight: "600" },
    input: {
      color: c.text,
      fontSize: 16,
      paddingVertical: 6,
      paddingHorizontal: 0,
    },
    textarea: { minHeight: 64, lineHeight: 22 },
    priceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    currency: {
      color: c.textMuted,
      fontSize: 26,
      fontFamily: DisplayFont.bold,
    },
    priceInput: {
      flex: 1,
      fontSize: 28,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.6,
    },
    savingsWrap: { paddingHorizontal: 4 },

    // Organización
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      minHeight: 56,
      paddingVertical: 10,
    },
    rowIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.raised,
    },
    settingTitle: {
      color: c.text,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
    },
    settingValue: {
      flex: 1,
      textAlign: "right",
      color: c.textSecondary,
      fontSize: 15,
    },
    toggleText: { color: c.textMuted, fontSize: 13 },

    // Combo
    link: { color: c.primary, fontSize: 14, fontWeight: "600" },
    lineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
    },
    lineName: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    lineMeta: {
      color: c.textMuted,
      fontSize: 13,
      fontVariant: ["tabular-nums"],
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      padding: 3,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    stepBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.elevated,
    },
    stepQty: {
      minWidth: 22,
      textAlign: "center",
      color: c.text,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
      fontVariant: ["tabular-nums"],
    },
    comboEmpty: {
      padding: 16,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      backgroundColor: c.canvas,
    },
    comboHint: { color: c.textMuted, fontSize: 13 },
    comboAdd: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: "continuous",
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: c.border,
    },
    comboAddIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.raised,
    },
    comboAddText: {
      color: c.ink,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
    },

    delete: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 48,
    },
    deleteText: {
      color: c.danger,
      fontSize: 15,
      fontFamily: DisplayFont.semibold,
    },

    missing: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.background,
    },
    missingText: { color: c.textSecondary, fontSize: 15 },
  }),
);
