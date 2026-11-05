import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Children, type ReactNode, useEffect, useMemo, useState } from 'react';
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
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { DateTimeField } from '@/components/events/date-time-field';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { eventPhase, PHASE_LABEL } from '@/features/dashboard/format';
import { toLocalIso } from '@/features/events/event-actions';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { type EventDetail, getEvent, patchEvent } from '@/lib/api/organizer';
import { invalidate, setQueryData, useQuery } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';

/** `starts_at` / `ends_at` del backend son hora local sin zona: `new Date` los lee como locales. */
const parse = (iso: string | null) => (iso ? new Date(iso) : null);
const DEFAULT_LENGTH_MS = 6 * 3_600_000;
const NAME_MAX = 80;
const DESCRIPTION_MAX = 500;
/** En iOS los selectores compactos entran a la derecha de la etiqueta; en Android van debajo. */
const INLINE_PICKERS = Platform.OS === 'ios';

/**
 * Editar evento, en secciones agrupadas: detalles (nombre y descripción), fecha y hora, y ajustes.
 * Carga el evento (GET /api/events/<id>) y guarda con PATCH. "Guardar" va arriba a la derecha:
 * en iOS es el botón nativo (cápsula de vidrio), en azul cuando hay cambios.
 */
export default function EditEventScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useQuery<EventDetail>(id ? `event:${id}` : null, () => getEvent(id));
  useFocusStatusBar('dark');

  if (!detail.data) {
    return (
      <View style={styles.missing}>
        {detail.error ? (
          <Text style={styles.missingText}>{detail.error}</Text>
        ) : (
          <ActivityIndicator color={colors.textMuted} />
        )}
      </View>
    );
  }
  // El formulario arranca con los datos ya cargados (y se reinicia si cambia el evento).
  return <EditEventForm key={detail.data.id} event={detail.data} />;
}

function EditEventForm({ event }: { event: EventDetail }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [saving, setSaving] = useState(false);

  const initial = useMemo(() => {
    const start = parse(event.starts_at) ?? new Date();
    const end = parse(event.ends_at);
    return {
      name: event.name,
      description: event.description ?? '',
      start,
      end,
      active: event.is_active,
      notifyPickup: event.notify_pickup_point,
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
  const [notifyPickup /* , setNotifyPickup */] = useState(initial.notifyPickup); // Puntos de retiro deshabilitado por ahora

  const nameError = name.trim().length < 2 ? 'Poné un nombre para el evento' : null;
  const endError = hasEnd && end <= start ? 'El fin tiene que ser después del inicio' : null;
  const dirty =
    name.trim() !== initial.name ||
    description.trim() !== initial.description ||
    start.getTime() !== initial.start.getTime() ||
    hasEnd !== (initial.end != null) ||
    (hasEnd && end.getTime() !== initial.end?.getTime()) ||
    active !== initial.active ||
    notifyPickup !== initial.notifyPickup;
  const canSave = dirty && !nameError && !endError && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const res = await patchEvent(event.id, {
      name: name.trim(),
      description: description.trim() || null,
      starts_at: toLocalIso(start),
      ends_at: hasEnd ? toLocalIso(end) : null,
      is_active: active,
      notify_pickup_point: notifyPickup,
    });
    setSaving(false);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('No se pudo guardar', res.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setQueryData<EventDetail>(`event:${event.id}`, () => res.data);
    await invalidate('events');
    router.back();
  };

  const phase = eventPhase(event);

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
              <View style={[styles.chip, phase === 'live' && styles.chipLive]}>
                <Text style={[styles.chipText, phase === 'live' && styles.chipTextLive]}>
                  {PHASE_LABEL[phase]}
                </Text>
              </View>
              <View style={[styles.chip, !active && styles.chipOff]}>
                <Text style={styles.chipText}>{active ? 'Activo' : 'Inactivo'}</Text>
              </View>
            </View>
          </View>
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
        {nameError ? <Text style={styles.error}>{nameError}</Text> : null}

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
          <ToggleRow
            title="Evento activo"
            description="Cuando está inactivo, el catálogo público no acepta nuevos pedidos"
            value={active}
            onValueChange={setActive}
          />
          {/* Puntos de retiro deshabilitado por ahora: se conserva el valor actual del evento al guardar.
          <ToggleRow
            title="Avisar punto de retiro en email"
            description="Cuando está activo, el email de confirmación del pedido incluye el nombre del punto de retiro asignado"
            value={notifyPickup}
            onValueChange={setNotifyPickup}
          />
          */}
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
    screen: { flex: 1, backgroundColor: '#ffffff' },
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

    missing: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
    },
    missingText: { color: c.textSecondary, fontSize: 15 },
  }),
);
