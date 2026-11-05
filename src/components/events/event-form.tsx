import { Image } from 'expo-image';
import type { ImagePickerOptions } from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { Children, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
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
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { Segmented } from '@/components/dashboard/segmented';
import { DateTimeField } from '@/components/events/date-time-field';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { setSelectedEventId } from '@/features/dashboard/selected-event';
import { eventPhase, PHASE_LABEL } from '@/features/dashboard/format';
import { toLocalIso } from '@/features/events/event-actions';
import {
  createEvent,
  type EventDetail,
  type EventStatus,
  patchEvent,
  uploadEventCover,
} from '@/lib/api/organizer';
import { loadImagePicker } from '@/lib/native-modules';
import { invalidate, setQueryData } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';
import { toast } from '@/components/ui/toast';

/** `starts_at` / `ends_at` del backend son hora local sin zona: `new Date` los lee como locales. */
const parse = (iso: string | null) => (iso ? new Date(iso) : null);
const DEFAULT_LENGTH_MS = 6 * 3_600_000;
const NAME_MAX = 80;
const SLUG_MAX = 60;
const DESCRIPTION_MAX = 500;
/** En iOS los selectores compactos entran a la derecha de la etiqueta; en Android van debajo. */
const INLINE_PICKERS = Platform.OS === 'ios';

const PICK: ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8 };

/** Estados del backend (routes/events.py). "Cancelado" solo aparece si el evento ya lo está. */
const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Publicado' },
  { value: 'paused', label: 'Pausado' },
  { value: 'finished', label: 'Terminado' },
];

/** "Fiesta de Fin de Año!" → "fiesta-de-fin-de-ano" (el backend lo normaliza igual). */
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX);

/**
 * Formulario de evento, en secciones: portada, detalles (nombre, link y descripción), fecha y hora,
 * y ajustes (estado, activo, accesos a categorías). Sin `event` crea uno nuevo (POST /api/events);
 * con `event` guarda con PATCH. La portada se sube después de guardar (POST /events/<id>/cover).
 * "Guardar" va arriba a la derecha: en iOS es el botón nativo, en azul cuando hay cambios.
 */
export function EventForm({ event }: { event?: EventDetail }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);

  const initial = useMemo(() => {
    const start = parse(event?.starts_at ?? null) ?? nextHour();
    const end = parse(event?.ends_at ?? null);
    return {
      name: event?.name ?? '',
      slug: event?.slug ?? '',
      description: event?.description ?? '',
      cover: event?.cover_image_url ?? null,
      start,
      end,
      status: (event?.status ?? 'draft') as EventStatus,
      active: event?.is_active ?? true,
      shortcuts: event?.show_category_shortcuts ?? false,
    };
  }, [event]);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [start, setStart] = useState(initial.start);
  const [hasEnd, setHasEnd] = useState(initial.end != null);
  const [end, setEnd] = useState(
    initial.end ?? new Date(initial.start.getTime() + DEFAULT_LENGTH_MS),
  );
  const [active, setActive] = useState(initial.active);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(!!event);
  const [cover, setCover] = useState<string | null>(initial.cover);
  const [status, setStatus] = useState<EventStatus>(initial.status);
  const [shortcuts, setShortcuts] = useState(initial.shortcuts);
  // Al crear, el link sigue al nombre hasta que se edita a mano.
  const shownSlug = slugTouched ? slug : slugify(name);

  const nameError = name.trim().length < 2 ? 'Poné un nombre para el evento' : null;
  const endError = hasEnd && end <= start ? 'El fin tiene que ser después del inicio' : null;
  const dirty =
    name.trim() !== initial.name ||
    description.trim() !== initial.description ||
    start.getTime() !== initial.start.getTime() ||
    hasEnd !== (initial.end != null) ||
    (hasEnd && end.getTime() !== initial.end?.getTime()) ||
    active !== initial.active ||
    shownSlug !== initial.slug ||
    cover !== initial.cover ||
    status !== initial.status ||
    shortcuts !== initial.shortcuts;
  const slugError = shownSlug.length > 0 && shownSlug.length < 2 ? 'El link es muy corto' : null;
  const canSave = (dirty || !event) && !nameError && !endError && !slugError && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const fields = {
      name: name.trim(),
      description: description.trim() || null,
      starts_at: toLocalIso(start),
      ends_at: hasEnd ? toLocalIso(end) : null,
      is_active: active,
      status,
      ...(shownSlug && shownSlug !== initial.slug ? { slug: shownSlug } : {}),
    };
    let res = event
      ? await patchEvent(event.id, {
          ...fields,
          show_category_shortcuts: shortcuts,
          ...(cover === null && initial.cover ? { cover_image_url: null } : {}),
        })
      : await createEvent(fields);
    if (!res.ok) {
      setSaving(false);
      toast.error('No se pudo guardar', res.error);
      return;
    }
    // Al crear, el backend no recibe `show_category_shortcuts`: va en un PATCH aparte.
    if (!event && shortcuts) {
      const patched = await patchEvent(res.data.id, { show_category_shortcuts: true });
      if (patched.ok) res = patched;
    }
    let coverError: string | null = null;
    if (cover && cover !== initial.cover && !/^https?:\/\//.test(cover)) {
      const up = await uploadEventCover(res.data.id, cover);
      if (up.ok) res = up;
      else coverError = up.error;
    }
    setSaving(false);
    if (!coverError) {
      toast.success(event ? 'Cambios guardados' : 'Evento creado', res.data.name, { celebrate: !event });
    }
    setQueryData<EventDetail>(`event:${res.data.id}`, () => (res.ok ? res.data : null));
    await invalidate('events');
    if (!event) setSelectedEventId(res.data.id);
    if (coverError) toast.error('Evento guardado', `No se pudo subir la portada: ${coverError}`);
    router.back();
  };

  const phase = event ? eventPhase(event) : 'upcoming';

  const pickCover = async (source: 'library' | 'camera') => {
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
    if (!result.canceled && result.assets[0]) setCover(result.assets[0].uri);
  };

  const chooseCover = () => {
    Haptics.selectionAsync();
    const options = ['Elegir de la galería', 'Sacar una foto', ...(cover ? ['Quitar portada'] : []), 'Cancelar'];
    const run = (i: number) => {
      if (i === 0) pickCover('library');
      else if (i === 1) pickCover('camera');
      else if (cover && i === 2) setCover(null);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: cover ? 2 : undefined },
        run,
      );
    } else {
      Alert.alert('Portada', undefined, [
        ...options.slice(0, -1).map((text, i) => ({ text, onPress: () => run(i), style: (cover && i === 2 ? 'destructive' : 'default') as 'destructive' | 'default' })),
        { text: 'Cancelar', style: 'cancel' as const },
      ]);
    }
  };

  return (
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
        <Stack.Screen
          options={
            Platform.OS === 'ios'
              ? {
                  // Botón nativo: iOS le pone su cápsula de vidrio (y el relleno azul en "prominent").
                  // (API `unstable_` de react-native-screens.)
                  unstable_headerRightItems: () => [
                    {
                      type: 'button',
                      label: 'Guardar',
                      onPress: save,
                      disabled: !canSave,
                      // Con cambios sin guardar: cápsula rellena en azul de marca ("prominent", iOS 26);
                      // sin cambios: la cápsula de vidrio normal, atenuada.
                      variant: canSave ? 'prominent' : 'plain',
                      tintColor: canSave ? colors.primary : colors.text,
                      labelStyle: { fontFamily: DisplayFont.semibold, fontSize: 16 },
                    },
                  ],
                }
              : {
                  headerRight: () => <SaveButton enabled={canSave} dirty={dirty} onPress={save} />,
                }
          }
        />
        {/* Resumen: qué evento se está editando y su estado actual */}
        <Animated.View entering={enter(0)} style={styles.summary}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.summaryName} numberOfLines={2}>
              {name.trim() || 'Sin nombre'}
            </Text>
            <View style={styles.summaryMeta}>
              {event ? (
                <View style={[styles.chip, phase === 'live' && styles.chipLive]}>
                  <Text style={[styles.chipText, phase === 'live' && styles.chipTextLive]}>
                    {PHASE_LABEL[phase]}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.chip, !active && styles.chipOff]}>
                <Text style={styles.chipText}>{active ? 'Activo' : 'Inactivo'}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <Pressable
            onPress={chooseCover}
            accessibilityRole="button"
            accessibilityLabel={cover ? 'Cambiar portada' : 'Agregar portada'}
            style={({ pressed }) => [styles.cover, pressed && { opacity: 0.85 }]}>
            {cover ? (
              <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : (
              <View style={styles.coverEmpty}>
                <Icon name="photo" size={22} color={colors.textMuted} />
                <Text style={styles.coverText}>Agregar portada</Text>
              </View>
            )}
            {cover ? (
              <View style={styles.coverBadge}>
                <Icon name="pencil" size={12} color="#ffffff" />
                <Text style={styles.coverBadgeText}>Cambiar</Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>

        <Section title="Detalles" index={1} separate>
          <View style={styles.inputBlock}>
            <View style={styles.inputHead}>
              <Text style={styles.inputLabel}>Nombre</Text>
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nombre del evento"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="sentences"
              returnKeyType="done"
              maxLength={NAME_MAX}
              style={styles.input}
              accessibilityLabel="Nombre"
            />
          </View>
          <View style={styles.inputBlock}>
            <View style={styles.inputHead}>
              <Text style={styles.inputLabel}>Link de la tienda</Text>
            </View>
            <TextInput
              value={shownSlug}
              onChangeText={(v) => {
                setSlugTouched(true);
                setSlug(slugify(v));
              }}
              placeholder="mi-evento"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={SLUG_MAX}
              style={styles.input}
              accessibilityLabel="Link de la tienda"
            />
          </View>
          <View style={styles.inputBlock}>
            <View style={styles.inputHead}>
              <Text style={styles.inputLabel}>Descripción</Text>
              <Text style={styles.counter}>
                {description.length}/{DESCRIPTION_MAX}
              </Text>
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Contá de qué se trata el evento"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={DESCRIPTION_MAX}
              style={[styles.input, styles.textarea]}
              accessibilityLabel="Descripción"
            />
          </View>
        </Section>
        {nameError && (name.length > 0 || event) ? <Text style={styles.error}>{nameError}</Text> : null}
        {slugError ? <Text style={styles.error}>{slugError}</Text> : null}

        <Section title="Fecha y hora" index={2} separate>
          <View style={[styles.dateRow, !INLINE_PICKERS && styles.dateRowStacked]}>
            <Text style={styles.rowTitle}>Inicio</Text>
            <DateTimeField value={start} onChange={setStart} />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowTitle}>Hora de fin</Text>
              {!hasEnd ? (
                <Text style={styles.rowDescription}>
                  Sin hora de fin, el evento sigue en curso hasta 12 h después del inicio
                </Text>
              ) : null}
            </View>
            <Switch
              value={hasEnd}
              onValueChange={(v) => {
                Haptics.selectionAsync();
                setHasEnd(v);
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel="Hora de fin"
            />
          </View>

          {hasEnd ? (
            <View style={[styles.dateRow, !INLINE_PICKERS && styles.dateRowStacked]}>
              <Text style={styles.rowTitle}>Fin</Text>
              <DateTimeField value={end} onChange={setEnd} minimumDate={start} />
            </View>
          ) : null}
        </Section>
        {endError ? <Text style={styles.error}>{endError}</Text> : null}

        <Section title="Ajustes" index={3} separate>
          <View style={styles.statusBlock}>
            <Text style={styles.rowTitle}>Estado</Text>
            <Segmented
              options={
                status === 'cancelled'
                  ? [...STATUS_OPTIONS, { value: 'cancelled' as const, label: 'Cancelado' }]
                  : STATUS_OPTIONS
              }
              value={status}
              onChange={(v) => {
                Haptics.selectionAsync();
                setStatus(v);
              }}
            />
          </View>
          <ToggleRow
            title="Evento activo"
            description="Cuando está inactivo, el catálogo público no acepta nuevos pedidos"
            value={active}
            onValueChange={setActive}
          />
          <ToggleRow
            title="Accesos a categorías"
            description="Muestra botones arriba de la tienda para saltar a cada categoría"
            value={shortcuts}
            onValueChange={setShortcuts}
          />
        </Section>
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const COLOR_FADE = { duration: 300, easing: Easing.inOut(Easing.quad) };

/** "Guardar" en Android: solo texto, de gris a negro con un fundido suave cuando hay cambios. */
function SaveButton({
  enabled,
  dirty,
  onPress,
}: {
  enabled: boolean;
  dirty: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const on = useSharedValue(enabled ? 1 : 0);

  useEffect(() => {
    on.set(withTiming(enabled ? 1 : 0, COLOR_FADE));
  }, [enabled, on]);

  const fg = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [colors.textMuted, colors.text]),
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={dirty ? 'Guardar cambios' : 'Sin cambios para guardar'}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [styles.save, pressed && { opacity: 0.6 }]}>
      <Animated.Text style={[styles.saveText, fg]}>Guardar</Animated.Text>
    </Pressable>
  );
}

/** Título + tarjeta. Con `separate`, cada hijo va en su propia tarjeta (con separación). */
function Section({
  title,
  index,
  separate,
  children,
}: {
  title: string;
  index: number;
  separate?: boolean;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <Animated.View entering={enter(index)} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {separate ? (
        <View style={styles.cards}>
          {/* toArray descarta los hijos vacíos (p. ej. "Fin" cuando no hay hora de fin). */}
          {Children.toArray(children).map((child, i) => (
            <View key={i} style={styles.card}>
              {child}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.card}>{children}</View>
      )}
    </Animated.View>
  );
}

/** Ajuste con título, explicación y switch (toda la fila es tocable). */
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
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={() => toggle(!value)}
      style={[styles.switchRow, divider && styles.divider]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={toggle}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },

    summary: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
    summaryName: { color: c.text, fontSize: 20, fontFamily: DisplayFont.bold, letterSpacing: -0.4 },
    summaryMeta: { flexDirection: 'row', gap: 6 },
    chip: {
      paddingHorizontal: 8,
      height: 22,
      justifyContent: 'center',
      borderRadius: 7,
      backgroundColor: c.raised,
    },
    chipLive: { backgroundColor: c.brandMuted },
    chipOff: { backgroundColor: c.dangerMuted },
    chipText: { color: c.textSecondary, fontSize: 11, fontWeight: '700' },
    chipTextLive: { color: c.brandText },

    section: { gap: 8 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    card: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: 16,
    },
    cards: { gap: 10 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },

    inputBlock: { paddingTop: 12, paddingBottom: 10, gap: 2 },
    inputHead: { flexDirection: 'row', justifyContent: 'space-between' },
    inputLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    counter: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    input: { color: c.text, fontSize: 16, paddingVertical: 6, paddingHorizontal: 0 },
    textarea: { minHeight: 96, lineHeight: 22 },

    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
    },
    dateRowStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
    rowTitle: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    rowDescription: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
    error: { color: c.danger, fontSize: 13, marginTop: -12, paddingHorizontal: 4 },

    save: { paddingHorizontal: 8, height: 32, justifyContent: 'center' },
    saveText: { fontSize: 16, fontFamily: DisplayFont.semibold },

    statusBlock: { paddingVertical: 14, gap: 10 },
    cover: {
      height: 168,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      overflow: 'hidden',
      backgroundColor: c.raised,
    },
    coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    coverText: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
    coverBadge: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    coverBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  }),
);

/** Próxima hora en punto (valor inicial del inicio al crear). */
function nextHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}
