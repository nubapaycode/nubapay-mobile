import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { KeyboardScroll } from "@/components/fx/keyboard";
import { MorphButton, useMorphStatus } from '@/components/motion/morph-button';
import { Icon } from '@/components/dashboard/icon';
import { Confetti } from '@/components/fx/confetti';
import { Tilt } from '@/components/motion/tilt';
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
import { toast } from '@/components/ui/toast';

const LAYOUT = LinearTransition.duration(260);
const MP_CREDENTIALS = 'https://www.mercadopago.com.ar/developers/panel/app';

/** Guarda un cambio del evento y actualiza el cache. Devuelve false si falló (ya avisó). */
async function save(e: EventDetail, payload: EventPatch): Promise<boolean> {
  const res = await patchEvent(e.id, payload);
  if (!res.ok) {
    toast.error('No se pudo guardar', res.error);
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
  const { colors } = useTheme();
  const sm = size === 'sm';
  return (
    <View style={[styles.mark, sm && styles.markSm, id !== 'mercadopago' && styles.markPlain]}>
      {id === 'mercadopago' ? (
        <MercadoPagoLogo width={sm ? 22 : 32} />
      ) : id === 'sipago' ? (
        <Icon name="card" size={sm ? 13 : 18} color={colors.ink} />
      ) : (
        <Icon name="cash" size={sm ? 13 : 18} color={colors.ink} />
      )}
    </View>
  );
}

/**
 * Métodos de pago del evento seleccionado: Mercado Pago y Sipago (online) y Efectivo (en el
 * evento). Resumen arriba; cada método en su card con estado en píldora y, al activarlo, su
 * configuración en sub-cards (sin divisores). Cada cambio se guarda en el backend
 * (PATCH /api/events/<id>).
 */
export default function PaymentMethodsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { data: event, error } = useSelectedEventDetail();
  useFocusStatusBar();

  if (!event) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.note}>{error}</Text> : <ActivityIndicator color={colors.textMuted} />}
      </View>
    );
  }

  const ready = METHODS.filter((m) => isReady(m, event));
  return <PaymentMethodsContent event={event} ready={ready} />;
}

/** Contenido con el evento cargado; celebra cuando un método queda listo para cobrar. */
function PaymentMethodsContent({ event, ready }: { event: EventDetail; ready: PaymentMethodId[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [party, setParty] = useState(0);
  const prevReady = useRef(ready.length);
  useEffect(() => {
    if (ready.length > prevReady.current) setParty((n) => n + 1);
    prevReady.current = ready.length;
  }, [ready.length]);
  const ordered = [...METHODS].sort((a, b) => Number(isReady(b, event)) - Number(isReady(a, event)));

  return (
    <View style={styles.screen}>
      <KeyboardScroll
        style={styles.screen}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        {/* Resumen: cuántos métodos acepta el evento, con sus logos y un segmento por método. */}
        <Animated.View entering={enter(0)} layout={LAYOUT}>
        <Tilt radius={Radius.xl}>
        <View style={styles.summary}>
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
        </View>
        </Tilt>
        </Animated.View>
        {ready.length === 0 ? (
          <Animated.View entering={FadeIn.duration(260)} style={styles.warning}>
            <Icon name="warning" size={15} color={colors.danger} />
            <Text style={styles.warningText}>
              Sin métodos activos tu catálogo no puede recibir pedidos.
            </Text>
          </Animated.View>
        ) : null}

        <Group title="Online" index={1}>
          <MercadoPagoCard event={event} />
          <SipagoCard event={event} />
        </Group>

        <Group title="En el evento" index={2}>
          <CashCard event={event} />
        </Group>

        <Text style={[styles.note, styles.footnote]}>Estos métodos son de {event.name}.</Text>
      </KeyboardScroll>
      {party ? <Confetti key={party} seed={party} /> : null}
    </View>
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
  const pill =
    tone === 'on'
      ? { fg: colors.success, bg: colors.successMuted }
      : tone === 'pending'
        ? { fg: colors.warning, bg: colors.warningMuted }
        : { fg: colors.textMuted, bg: colors.raised };

  return (
    <Animated.View layout={LAYOUT} style={[styles.card, enabled && styles.cardOn]}>
      <View style={styles.head}>
        <FlipOnReady ready={tone === 'on'}>
          <MethodMark id={id} />
        </FlipOnReady>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title}>{METHOD_LABEL[id]}</Text>
          {enabled ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={[styles.statusPill, { backgroundColor: pill.bg }]}>
              <View style={[styles.dot, { backgroundColor: pill.fg }]} />
              <Text style={[styles.status, { color: pill.fg }]} numberOfLines={1}>
                {status}
              </Text>
            </Animated.View>
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

/** El logo da una vuelta completa en 3D cuando el método queda activo y listo. */
function FlipOnReady({ ready, children }: { ready: boolean; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  const was = useRef(ready);
  useEffect(() => {
    if (ready && !was.current && !reduceMotion) {
      turn.set(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(360, { duration: 750, easing: Easing.inOut(Easing.cubic) }),
        ),
      );
    }
    was.current = ready;
  }, [ready, reduceMotion, turn]);
  const style = useAnimatedStyle(() => ({
    transform: [{ perspective: 500 }, { rotateY: `${turn.value}deg` }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function CashCard({ event }: { event: EventDetail }) {
  const styles = useStyles();
  const { colors } = useTheme();
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
      <View style={[styles.sub, styles.account]}>
        <Icon name="clock" size={15} color={colors.textSecondary} />
        <Text style={[styles.note, { flex: 1 }]}>
          Los pedidos en efectivo quedan como “por cobrar” hasta que los confirmás en caja.
        </Text>
      </View>
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
          <View style={[styles.sub, styles.account]}>
            <View style={styles.accountCheck}>
              <Icon name="checkmark" size={11} color={colors.onInk} />
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
            style={({ pressed }) => [styles.disconnect, pressed && { opacity: 0.7 }]}>
            <Icon name="trash" size={14} color={colors.danger} />
            <Text style={styles.disconnectText}>Desconectar</Text>
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
          <View style={[styles.sub, styles.account]}>
            <View style={styles.accountCheck}>
              <Icon name="checkmark" size={11} color={colors.onInk} />
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
            style={({ pressed }) => [styles.disconnect, pressed && { opacity: 0.7 }]}>
            <Icon name="trash" size={14} color={colors.danger} />
            <Text style={styles.disconnectText}>Desconectar</Text>
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
  const morph = useMorphStatus();
  const complete = fields.every((f) => (values[f.key as string] ?? '').trim().length > 0);

  if (!expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.sub, styles.subRow, pressed && { opacity: 0.7 }]}>
        <Icon name="pencil" size={14} color={colors.textSecondary} />
        <Text style={[styles.fieldValue, { flex: 1 }]}>{title}</Text>
        <Icon name="chevronRight" size={11} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {intro ? <Text style={styles.note}>{intro}</Text> : null}
      <View style={styles.inputs}>
        {fields.map((f) => {
          const k = f.key as string;
          return (
            <View key={k} style={styles.inputBlock}>
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
      <MorphButton
        label="Guardar credenciales"
        status={morph.status}
        disabled={!complete}
        colors={{ bg: colors.ink, fg: colors.onInk }}
        height={50}
        onPress={() =>
          morph.run(() =>
            onSave(
              Object.fromEntries(fields.map((f) => [f.key, (values[f.key as string] ?? '').trim()])) as EventPatch,
            ),
          )
        }
        onDone={() => {
          morph.reset();
          setValues({});
          if (collapsed) setExpanded(false);
        }}
      />
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
    <View style={[styles.sub, styles.toggleLine]}>
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
    screen: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background, padding: 24 },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.four },

    summary: {
      gap: 14,
      padding: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    summaryLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    summaryValue: {
      color: c.text,
      fontSize: 30,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.8,
      fontVariant: ['tabular-nums'],
    },
    summaryOf: { color: c.textMuted, fontSize: 15, fontFamily: DisplayFont.semibold, letterSpacing: 0 },
    segments: { flexDirection: 'row', gap: 4 },
    segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.raised },
    segmentOn: { backgroundColor: c.success },
    stack: { flexDirection: 'row' },
    stackItem: { borderRadius: 12, borderWidth: 2, borderColor: c.surface },
    warning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      marginTop: -12,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.dangerMuted,
    },
    warningText: { flex: 1, color: c.danger, fontSize: 13, lineHeight: 18, fontWeight: '500' },

    group: { gap: 10 },
    groupTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },

    card: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
      padding: 14,
      boxShadow: c.cardShadowSubtle,
    },
    cardOn: { borderColor: c.borderStrong },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    mark: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.elevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    markSm: { width: 32, height: 32, borderRadius: 16 },
    markPlain: { backgroundColor: c.raised, borderColor: c.raised },
    title: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    description: { color: c.textMuted, fontSize: 12, lineHeight: 16 },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: Radius.pill,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    status: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
    features: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    feature: {
      paddingHorizontal: 9,
      height: 24,
      justifyContent: 'center',
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    featureText: { color: c.textSecondary, fontSize: 11, fontWeight: '600' },

    body: { marginTop: 14 },
    sub: {
      padding: 12,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      backgroundColor: c.canvas,
    },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    disconnect: {
      flexDirection: 'row',
      gap: 8,
      height: 46,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.dangerMuted,
    },
    disconnectText: { color: c.danger, fontSize: 14, fontFamily: DisplayFont.semibold },

    inputs: { gap: 8 },
    inputBlock: {
      paddingTop: 10,
      paddingBottom: 6,
      paddingHorizontal: 12,
      gap: 2,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      backgroundColor: c.canvas,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    input: { color: c.text, fontSize: 15, paddingVertical: 6, paddingHorizontal: 0 },
    helpLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
    helpText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },

    primary: {
      height: 48,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.ink,
    },
    primaryDisabled: { backgroundColor: c.raised },
    primaryText: { color: c.onInk, fontSize: 15, fontFamily: DisplayFont.semibold },
    primaryTextDisabled: { color: c.textMuted },
  }),
);
