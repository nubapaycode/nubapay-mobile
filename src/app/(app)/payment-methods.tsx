import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { type ReactNode, useState } from 'react';
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
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { MercadoPagoLogo } from '@/components/payouts/brand-logos';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  isReady,
  METHOD_LABEL,
  METHODS,
  type PaymentMethodId,
  useSelectedEventDetail,
} from '@/features/payouts/payment-methods';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { type EventDetail, type EventPatch, patchEvent } from '@/lib/api/organizer';
import { invalidate, setQueryData } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';

const LAYOUT = LinearTransition.duration(260);
const MP_CREDENTIALS = 'https://www.mercadopago.com.ar/developers/panel/app';

/** Guarda un cambio del evento y actualiza el cache. Devuelve false si falló (ya avisó). */
async function save(e: EventDetail, payload: EventPatch): Promise<boolean> {
  const res = await patchEvent(e.id, payload);
  if (!res.ok) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert('No se pudo guardar', res.error);
    return false;
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  setQueryData<EventDetail>(`event:${e.id}`, () => res.data);
  invalidate('events');
  return true;
}

/** Logo de cada método, en su tile. */
function MethodMark({ id, size = 'md' }: { id: PaymentMethodId; size?: 'sm' | 'md' }) {
  const styles = useStyles();
  const sm = size === 'sm';
  return (
    <View style={[styles.mark, sm && styles.markSm, id !== 'mercadopago' && styles.markPlain]}>
      {id === 'mercadopago' ? (
        <MercadoPagoLogo width={sm ? 22 : 32} />
      ) : id === 'sipago' ? (
        <Icon name="card" size={sm ? 13 : 18} color="#000000" />
      ) : (
        <Icon name="cash" size={sm ? 13 : 18} color="#000000" />
      )}
    </View>
  );
}

/**
 * Métodos de pago del evento seleccionado: Mercado Pago y Sipago (online) y Efectivo (en el
 * evento). Cada cambio se guarda en el backend (PATCH /api/events/<id>).
 */
export default function PaymentMethodsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { data: event, error } = useSelectedEventDetail();
  useFocusStatusBar('dark');

  if (!event) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.note}>{error}</Text> : <ActivityIndicator color={colors.textMuted} />}
      </View>
    );
  }

  const ready = METHODS.filter((m) => isReady(m, event));
  const ordered = [...METHODS].sort((a, b) => Number(isReady(b, event)) - Number(isReady(a, event)));

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
        {/* Resumen tipo checklist */}
        <Animated.View entering={enter(0)} layout={LAYOUT} style={styles.summary}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.summaryLabel} numberOfLines={1}>
                {event.name} acepta
              </Text>
              <Text style={styles.summaryValue}>
                {ready.length}
                <Text style={styles.summaryOf}> de {METHODS.length} métodos</Text>
              </Text>
            </View>
            {ready.length ? (
              <View style={styles.stack}>
                {ready.map((m, i) => (
                  <View key={m} style={[styles.stackItem, i > 0 && { marginLeft: -10 }]}>
                    <MethodMark id={m} size="sm" />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.segments}>
            {ordered.map((m) => (
              <View key={m} style={[styles.segment, isReady(m, event) && styles.segmentOn]} />
            ))}
          </View>
        </Animated.View>
        {ready.length === 0 ? (
          <Text style={styles.warning}>Sin métodos activos tu catálogo no puede recibir pedidos.</Text>
        ) : null}

        <Group title="Online" index={1}>
          <MercadoPagoCard event={event} />
          <SipagoCard event={event} />
        </Group>

        <Group title="En el evento" index={2}>
          <CashCard event={event} />
        </Group>

        <Text style={[styles.note, styles.footnote]}>Estos métodos son de {event.name}.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Group({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Animated.View entering={enter(index)} layout={LAYOUT} style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {children}
    </Animated.View>
  );
}

/** Tarjeta de un método: logo, nombre, estado y switch; al activarlo muestra su configuración. */
function MethodCard({
  id,
  description,
  features,
  enabled,
  status,
  tone,
  busy,
  onToggle,
  children,
}: {
  id: PaymentMethodId;
  description: string;
  features: string[];
  enabled: boolean;
  status: string;
  tone: 'on' | 'pending' | 'off';
  busy?: boolean;
  onToggle: (v: boolean) => void;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const dot = tone === 'on' ? colors.brand : tone === 'pending' ? colors.warning : colors.border;
  const statusColor = tone === 'on' ? colors.brandText : tone === 'pending' ? colors.warning : colors.textMuted;

  return (
    <Animated.View layout={LAYOUT} style={[styles.card, enabled && styles.cardOn]}>
      <View style={styles.head}>
        <MethodMark id={id} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title}>{METHOD_LABEL[id]}</Text>
          {enabled ? (
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: dot }]} />
              <Text style={[styles.status, { color: statusColor }]} numberOfLines={1}>
                {status}
              </Text>
            </View>
          ) : (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>
        {busy ? (
          <ActivityIndicator color={colors.textMuted} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              onToggle(v);
            }}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={`${METHOD_LABEL[id]}: ${status}`}
          />
        )}
      </View>
      <View style={styles.features}>
        {features.map((f) => (
          <View key={f} style={styles.feature}>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      {enabled && children ? (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(160)} style={styles.body}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function CashCard({ event }: { event: EventDetail }) {
  const styles = useStyles();
  const [busy, setBusy] = useState(false);
  return (
    <MethodCard
      id="cash"
      description="Se paga en el evento y se confirma en caja"
      features={['En caja']}
      enabled={event.cash_enabled}
      status="Activo"
      tone="on"
      busy={busy}
      onToggle={async (v) => {
        setBusy(true);
        await save(event, { cash_enabled: v });
        setBusy(false);
      }}>
      <Text style={styles.note}>
        Los pedidos en efectivo quedan como “por cobrar” hasta que los confirmás en caja.
      </Text>
    </MethodCard>
  );
}

/** Desactivar un método con credenciales = borrarlas (pide confirmación). */
function confirmDisconnect(name: string, onConfirm: () => void) {
  Alert.alert(`Desconectar ${name}`, 'Se borran las credenciales y deja de cobrarse con este medio.', [
    { text: 'Volver', style: 'cancel' },
    { text: 'Desconectar', style: 'destructive', onPress: onConfirm },
  ]);
}

function MercadoPagoCard({ event }: { event: EventDetail }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const connected = event.has_mp_token;
  const enabled = connected || open;

  const disconnect = () =>
    confirmDisconnect('Mercado Pago', async () => {
      setBusy(true);
      await save(event, { mp_access_token: null, mp_public_key: null, mp_card_enabled: false });
      setBusy(false);
      setOpen(false);
    });

  return (
    <MethodCard
      id="mercadopago"
      description="Cobrá online con Mercado Pago"
      features={['Tarjetas', 'Dinero en cuenta', 'QR']}
      enabled={enabled}
      status={connected ? 'Conectado' : 'Falta cargar las credenciales'}
      tone={connected ? 'on' : 'pending'}
      busy={busy}
      onToggle={(v) => (v ? setOpen(true) : connected ? disconnect() : setOpen(false))}>
      {connected ? (
        <View style={{ gap: 12 }}>
          <View style={styles.account}>
            <View style={styles.accountCheck}>
              <Icon name="checkmark" size={11} color="#ffffff" />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.fieldValue}>Credenciales cargadas</Text>
              <Text style={styles.note}>
                Access Token{event.has_mp_public_key ? ' y Public Key' : ' (falta la Public Key)'}
              </Text>
            </View>
          </View>
          <ToggleLine
            title="Cobrar con tarjeta en el sitio"
            description={
              event.has_mp_public_key
                ? 'El comprador paga con tarjeta sin salir del catálogo'
                : 'Necesita la Public Key de la misma app'
            }
            value={event.mp_card_enabled}
            disabled={!event.has_mp_public_key}
            onChange={(v) => save(event, { mp_card_enabled: v })}
          />
          <CredentialsForm
            key="mp-replace"
            collapsed
            title="Cambiar credenciales"
            fields={[
              { key: 'mp_access_token', label: 'Access Token', secure: true },
              { key: 'mp_public_key', label: 'Public Key' },
            ]}
            onSave={(values) => save(event, values)}
          />
          <Pressable
            onPress={disconnect}
            accessibilityRole="button"
            style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.6 }]}>
            <Text style={[styles.ghostText, { color: colors.danger }]}>Desconectar</Text>
          </Pressable>
        </View>
      ) : (
        <CredentialsForm
          key="mp-new"
          intro="Pegá las credenciales de producción de tu app de Mercado Pago."
          helpLabel="¿Dónde las encuentro?"
          helpUrl={MP_CREDENTIALS}
          fields={[
            { key: 'mp_access_token', label: 'Access Token', secure: true },
            { key: 'mp_public_key', label: 'Public Key' },
          ]}
          onSave={(values) => save(event, values)}
        />
      )}
    </MethodCard>
  );
}

function SipagoCard({ event }: { event: EventDetail }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const connected = event.has_sipago_credentials;
  const enabled = connected || open;

  const disconnect = () =>
    confirmDisconnect('Sipago', async () => {
      setBusy(true);
      await save(event, { sipago_client_id: null, sipago_client_secret: null });
      setBusy(false);
      setOpen(false);
    });

  return (
    <MethodCard
      id="sipago"
      description="Cobrá con tarjetas a través de Sipago"
      features={['Crédito', 'Débito']}
      enabled={enabled}
      status={connected ? 'Conectado' : 'Faltan las credenciales'}
      tone={connected ? 'on' : 'pending'}
      busy={busy}
      onToggle={(v) => (v ? setOpen(true) : connected ? disconnect() : setOpen(false))}>
      {connected ? (
        <View style={{ gap: 12 }}>
          <View style={styles.account}>
            <View style={styles.accountCheck}>
              <Icon name="checkmark" size={11} color="#ffffff" />
            </View>
            <Text style={[styles.fieldValue, { flex: 1 }]}>Credenciales cargadas</Text>
          </View>
          <CredentialsForm
            key="sp-replace"
            collapsed
            title="Cambiar credenciales"
            fields={[
              { key: 'sipago_client_id', label: 'Client ID' },
              { key: 'sipago_client_secret', label: 'Client Secret', secure: true },
            ]}
            onSave={(values) => save(event, values)}
          />
          <Pressable
            onPress={disconnect}
            accessibilityRole="button"
            style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.6 }]}>
            <Text style={[styles.ghostText, { color: colors.danger }]}>Desconectar</Text>
          </Pressable>
        </View>
      ) : (
        <CredentialsForm
          key="sp-new"
          intro="Pegá el Client ID y el Client Secret que te dio Sipago."
          fields={[
            { key: 'sipago_client_id', label: 'Client ID' },
            { key: 'sipago_client_secret', label: 'Client Secret', secure: true },
          ]}
          onSave={(values) => save(event, values)}
        />
      )}
    </MethodCard>
  );
}

type CredentialField = { key: keyof EventPatch; label: string; secure?: boolean };

/** Campos de credenciales (borrador local). Con `collapsed`, arranca como un enlace "Cambiar…". */
function CredentialsForm({
  fields,
  intro,
  helpLabel,
  helpUrl,
  collapsed,
  title,
  onSave,
}: {
  fields: CredentialField[];
  intro?: string;
  helpLabel?: string;
  helpUrl?: string;
  collapsed?: boolean;
  title?: string;
  onSave: (values: EventPatch) => Promise<boolean>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(!collapsed);
  const [values, setValues] = useState<Record<string, string>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const complete = fields.every((f) => (values[f.key as string] ?? '').trim().length > 0);

  if (!expanded) {
    return (
      <Pressable onPress={() => setExpanded(true)} accessibilityRole="button" style={styles.helpLink}>
        <Text style={styles.helpText}>{title}</Text>
        <Icon name="chevronRight" size={11} color={colors.textSecondary} />
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {intro ? <Text style={styles.note}>{intro}</Text> : null}
      <View style={styles.inputs}>
        {fields.map((f, i) => {
          const k = f.key as string;
          return (
            <View key={k} style={[styles.inputBlock, i > 0 && styles.divider]}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={values[k] ?? ''}
                  onChangeText={(t) => setValues((v) => ({ ...v, [k]: t }))}
                  placeholder={`Pegá tu ${f.label}`}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={f.secure && !shown[k]}
                  style={[styles.input, { flex: 1 }]}
                  accessibilityLabel={f.label}
                />
                {f.secure ? (
                  <Pressable
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={shown[k] ? 'Ocultar' : 'Mostrar'}
                    onPress={() => setShown((s) => ({ ...s, [k]: !s[k] }))}>
                    <Icon name={shown[k] ? 'eyeOff' : 'eye'} size={17} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={!complete || saving}
        onPress={async () => {
          setSaving(true);
          const ok = await onSave(
            Object.fromEntries(fields.map((f) => [f.key, (values[f.key as string] ?? '').trim()])) as EventPatch,
          );
          setSaving(false);
          if (ok) {
            setValues({});
            if (collapsed) setExpanded(false);
          }
        }}
        style={({ pressed }) => [
          styles.primary,
          (!complete || saving) && styles.primaryDisabled,
          pressed && { opacity: 0.85 },
        ]}>
        {saving ? (
          <ActivityIndicator color={colors.textMuted} />
        ) : (
          <Text style={[styles.primaryText, !complete && styles.primaryTextDisabled]}>
            Guardar credenciales
          </Text>
        )}
      </Pressable>
      {helpUrl ? (
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            WebBrowser.openBrowserAsync(helpUrl, {
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
              controlsColor: colors.primary,
            })
          }
          style={styles.helpLink}>
          <Text style={styles.helpText}>{helpLabel}</Text>
          <Icon name="external" size={11} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ToggleLine({
  title,
  description,
  value,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => Promise<boolean>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.toggleLine}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.fieldValue, disabled && { color: colors.textMuted }]}>{title}</Text>
        <Text style={styles.note}>{description}</Text>
      </View>
      {busy ? (
        <ActivityIndicator color={colors.textMuted} />
      ) : (
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={async (v) => {
            Haptics.selectionAsync();
            setBusy(true);
            await onChange(v);
            setBusy(false);
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#ffffff' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', padding: 24 },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },

    summary: {
      gap: 12,
      padding: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: c.border,
    },
    summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    summaryLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    summaryValue: {
      color: c.text,
      fontSize: 28,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.8,
      fontVariant: ['tabular-nums'],
    },
    summaryOf: { color: c.textMuted, fontSize: 15, fontFamily: DisplayFont.semibold, letterSpacing: 0 },
    segments: { flexDirection: 'row', gap: 4 },
    segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: c.border },
    segmentOn: { backgroundColor: c.brand },
    stack: { flexDirection: 'row' },
    stackItem: { borderRadius: 12, borderWidth: 2, borderColor: '#ffffff' },
    warning: { color: c.danger, fontSize: 13, lineHeight: 18, marginTop: -16, paddingHorizontal: 4 },

    group: { gap: 10 },
    groupTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },

    card: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      padding: 14,
      overflow: 'hidden',
    },
    cardOn: { borderColor: '#d4d9e1' },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    mark: {
      width: 46,
      height: 46,
      borderRadius: 13,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: c.border,
    },
    markSm: { width: 32, height: 32, borderRadius: 10 },
    markPlain: { backgroundColor: c.raised, borderColor: c.raised },
    title: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    description: { color: c.textMuted, fontSize: 12, lineHeight: 16 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    status: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
    features: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    feature: {
      paddingHorizontal: 8,
      height: 22,
      justifyContent: 'center',
      borderRadius: 7,
      backgroundColor: c.canvas,
    },
    featureText: { color: c.textSecondary, fontSize: 11, fontWeight: '600' },

    body: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    note: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
    footnote: { textAlign: 'center' },

    account: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    accountCheck: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.text,
    },
    fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    fieldValue: { color: c.text, fontSize: 15, fontWeight: '500' },
    toggleLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    ghost: {
      height: 44,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    ghostText: { color: '#000000', fontSize: 14, fontFamily: DisplayFont.semibold },

    inputs: {
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      backgroundColor: c.canvas,
      paddingHorizontal: 12,
    },
    inputBlock: { paddingTop: 10, paddingBottom: 6, gap: 2 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    input: { color: c.text, fontSize: 15, paddingVertical: 6, paddingHorizontal: 0 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    helpLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
    helpText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },

    primary: {
      height: 48,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
    },
    primaryDisabled: { backgroundColor: c.raised },
    primaryText: { color: '#ffffff', fontSize: 15, fontFamily: DisplayFont.semibold },
    primaryTextDisabled: { color: c.textMuted },
  }),
);
