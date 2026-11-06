import { requireOptionalNativeModule } from 'expo';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  LinearTransition,
  SlideInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/dashboard/icon';
import { RollingNumber } from '@/components/dashboard/rolling-number';
import { Confetti } from '@/components/fx/confetti';
import { TicketMascot } from '@/components/illustrations/ticket-mascot';
import { DeliverPanel } from '@/components/operations/deliver-panel';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { useEventAccess } from '@/features/access/access';
import { formatInt, formatMoney } from '@/features/dashboard/format';
import { parseOrderId, remainingOf, SCAN_COPY, scanKind } from '@/features/operations/scan';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { type Order, previewScan } from '@/lib/api/organizer';
import { invalidate } from '@/lib/query';
import { playScanSound, preloadScanSounds } from '@/lib/sounds';
import { light, PaletteScope } from '@/theme';

/**
 * `expo-camera` tiene código nativo: si el build instalado es anterior a agregarlo, importarlo
 * arriba rompería la ruta entera. Se carga solo si el módulo nativo existe.
 */
type CameraModule = typeof import('expo-camera');
const Camera: CameraModule | null = requireOptionalNativeModule('ExpoCamera')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-camera') as CameraModule)
  : null;

/** Pantalla siempre encendida mientras se escanea (también nativo: sin el módulo, no hace nada). */
type KeepAwakeModule = typeof import('expo-keep-awake');
const KeepAwake: KeepAwakeModule | null = requireOptionalNativeModule('ExpoKeepAwake')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-keep-awake') as KeepAwakeModule)
  : null;

/** Escaneo continuo: tras un ingreso válido, cuánto se ve el resultado antes de volver a leer. */
const AUTO_NEXT_MS = 1600;

const FRAME = 248;

/** Rectángulo del QR detectado, en coordenadas de pantalla. */
type Box = { x: number; y: number; width: number; height: number };

type Tone = 'success' | 'warning' | 'danger';
/** Colores vivos del resultado (se leen de lejos sobre la cámara). */
const TONE: Record<Tone, string> = { success: '#3ddc84', warning: '#ffb020', danger: '#ff5c5c' };
const HAPTIC: Record<Tone, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  danger: Haptics.NotificationFeedbackType.Error,
};

/** Lo último que pasó por el escáner en esta sesión (se ve apilado abajo del visor). */
type Recent = { key: number; tone: Tone; title: string; line: string };
const RECENT_MAX = 3;

type Result =
  | { kind: 'scanning' }
  | { kind: 'loading' }
  | { kind: 'deliver'; order: Order }
  | { kind: 'done'; order: Order }
  | { kind: 'already'; order: Order | null }
  | { kind: 'error'; message: string };

/**
 * Escáner de QR (entradas y retiros) a pantalla completa. Lee el QR del pedido, lo valida contra
 * el backend (scan-qr/preview) y abre el panel de entrega: cobrar efectivo si falta y marcar lo
 * entregado (scan-qr).
 */
export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { eventId, can } = useEventAccess();
  const [torch, setTorch] = useState(false);
  const [result, setResult] = useState<Result>({ kind: 'scanning' });
  const [target, setTarget] = useState<Box | null>(null);
  const lock = useRef(false);
  const [flash, setFlash] = useState<{ tone: Tone; id: number } | null>(null);
  const flashId = useRef(0);
  // Sesión de puerta: cuántos se validaron desde que se abrió el escáner y los últimos resultados.
  const [count, setCount] = useState(0);
  const [recent, setRecent] = useState<Recent[]>([]);
  const recentKey = useRef(0);
  const remember = useCallback((tone: Tone, title: string, line: string) => {
    recentKey.current += 1;
    const item = { key: recentKey.current, tone, title, line };
    setRecent((l) => [item, ...l].slice(0, RECENT_MAX));
  }, []);
  useFocusStatusBar('light');

  useEffect(() => {
    preloadScanSounds();
    // En la puerta el teléfono queda en la mano entre persona y persona: que no se bloquee.
    KeepAwake?.activateKeepAwakeAsync('scanner').catch(() => {});
    return () => {
      KeepAwake?.deactivateKeepAwake('scanner').catch(() => {});
    };
  }, []);

  /**
   * Resultado a la vista, al oído y en la mano: destello de color a pantalla completa, sonido
   * (si está prendido) y háptico. Pensado para la puerta, donde no siempre se mira la pantalla.
   */
  const signal = useCallback((tone: Tone, opts?: { haptic?: boolean; sound?: boolean }) => {
    if (opts?.haptic !== false) Haptics.notificationAsync(HAPTIC[tone]);
    if (opts?.sound !== false) playScanSound(tone === 'danger' ? 'error' : tone);
    flashId.current += 1;
    setFlash({ tone, id: flashId.current });
  }, []);

  const reset = useCallback(() => {
    lock.current = false;
    setTarget(null);
    setResult({ kind: 'scanning' });
  }, []);

  const onCode = useCallback(
    async (data: string, box: Box | null) => {
      if (lock.current || !eventId) return;
      lock.current = true;
      setTarget(box);
      const orderId = parseOrderId(data);
      if (!orderId) {
        signal('danger');
        setResult({ kind: 'error', message: 'Este QR no es de un pedido de Nubapay.' });
        return;
      }
      setResult({ kind: 'loading' });
      const res = await previewScan(eventId, orderId);
      if (res.ok) {
        signal('success');
        setResult({ kind: 'deliver', order: res.data });
      } else if (res.alreadyScanned) {
        signal('warning');
        setResult({ kind: 'already', order: res.order ?? null });
        remember('warning', 'Ya usado', res.order ? orderLine(res.order) : 'QR escaneado antes');
      } else {
        signal('danger');
        setResult({ kind: 'error', message: res.error });
      }
    },
    [eventId, signal, remember],
  );

  const delivered = (order: Order) => {
    invalidate(`orders:${eventId}`);
    invalidate(`order:${eventId}:${order.id}`);
    invalidate(`scan:${eventId}`);
    invalidate('dashboard');
    // El háptico ya lo dio el deslizar y el sonido sonó al validar: acá solo el destello.
    signal('success', { haptic: false, sound: false });
    setResult({ kind: 'done', order });
    setCount((n) => n + 1);
    remember('success', SCAN_COPY[scanKind(order)].done, orderLine(order));
  };

  const allowed = can('scanner');
  const scanning = result.kind === 'scanning';
  const resultTone: Tone | null =
    result.kind === 'deliver' || result.kind === 'done'
      ? 'success'
      : result.kind === 'already'
        ? 'warning'
        : result.kind === 'error'
          ? 'danger'
          : null;

  return (
    <View style={styles.screen}>
      {Camera && allowed ? (
        <CameraLayer camera={Camera} torch={torch} active={scanning} onCode={onCode} />
      ) : null}

      <View style={[styles.overlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.top}>
          <RoundButton icon="close" label="Cerrar" onPress={() => router.back()} />
          <Text style={styles.title}>Escanear QR</Text>
          {Camera && allowed ? (
            <RoundButton
              icon={torch ? 'flashlightOn' : 'flashlight'}
              label={torch ? 'Apagar linterna' : 'Prender linterna'}
              active={torch}
              onPress={() => {
                Haptics.selectionAsync();
                setTorch((t) => !t);
              }}
            />
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {count > 0 ? <SessionCount count={count} /> : null}

        {!allowed ? (
          <Message text="Tu rol en este evento no incluye el escáner. Pedile acceso al organizador." />
        ) : !Camera ? (
          <Message text="Esta versión de la app no incluye la cámara. Instalá el build nuevo para escanear." />
        ) : (
          <>
            <View style={styles.center}>
              <Viewfinder active={scanning} target={target} color={resultTone ? TONE[resultTone] : '#ffffff'} />
              <Text style={styles.hint}>
                {result.kind === 'loading' ? 'Verificando pedido…' : 'Apuntá al código QR de la entrada o del pedido'}
              </Text>
              {result.kind === 'loading' ? <ActivityIndicator color="#ffffff" /> : null}
            </View>
            {scanning && recent.length ? <RecentStack items={recent} /> : <View style={{ height: 40 }} />}
          </>
        )}
      </View>

      {flash ? <ScreenFlash key={flash.id} color={TONE[flash.tone]} /> : null}

      {result.kind === 'deliver' && eventId ? (
        <BottomCard>
          <DeliverPanel
            eventId={eventId}
            order={result.order}
            canConfirmCash={allowed}
            onDone={delivered}
            onCancel={reset}
          />
        </BottomCard>
      ) : result.kind === 'done' ? (
        <>
        <Confetti />
        <BottomCard>
          <Outcome
            tone="success"
            title={
              result.order.items.some((i) => remainingOf(i) > 0)
                ? SCAN_COPY[scanKind(result.order)].partial
                : SCAN_COPY[scanKind(result.order)].done
            }
            text={
              result.order.items.some((i) => remainingOf(i) > 0)
                ? SCAN_COPY[scanKind(result.order)].pendingNote
                : orderLine(result.order)
            }
            onNext={reset}
            autoNextMs={AUTO_NEXT_MS}
          />
        </BottomCard>
        </>
      ) : result.kind === 'already' ? (
        <BottomCard>
          <Outcome
            tone="warning"
            title={result.order ? SCAN_COPY[scanKind(result.order)].alreadyDone : 'Este QR ya fue escaneado'}
            text={
              result.order
                ? [orderLine(result.order), usedAgo(result.order)].filter(Boolean).join('\n')
                : 'No queda nada pendiente en este pedido.'
            }
            onNext={reset}
            onOpen={
              result.order
                ? () => router.replace({ pathname: '/operation/[key]', params: { key: result.order!.id } })
                : undefined
            }
          />
        </BottomCard>
      ) : result.kind === 'error' ? (
        <BottomCard>
          <Outcome tone="danger" title="No se pudo validar" text={result.message} onNext={reset} />
        </BottomCard>
      ) : null}
    </View>
  );
}

const orderLine = (o: Order) =>
  [`Pedido${o.orderNumber ? ` #${o.orderNumber}` : ''}`, o.customerName, formatMoney(o.total)].filter(Boolean).join(' · ');

/** "Escaneado hace 4 min" según el último ítem canjeado (null si el backend no manda la hora). */
function usedAgo(o: Order): string | null {
  const times = o.items.map((i) => (i.redeemedAt ? Date.parse(i.redeemedAt) : NaN)).filter((t) => !Number.isNaN(t));
  if (!times.length) return null;
  const min = Math.max(0, Math.round((Date.now() - Math.max(...times)) / 60000));
  if (min < 1) return 'Escaneado hace instantes';
  if (min < 60) return `Escaneado hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Escaneado hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
  const d = new Date(Math.max(...times));
  return `Escaneado el ${d.getDate()}/${d.getMonth() + 1} a las ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Contador de la sesión: aparece con el primero y cada validación hace rodar el número. */
function SessionCount({ count }: { count: number }) {
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={styles.count}
      accessible
      accessibilityLabel={`${count} validados en esta sesión`}>
      <View style={styles.countDot} />
      <RollingNumber value={count} format={formatInt} style={styles.countValue} />
      <Text style={styles.countLabel}>{count === 1 ? 'validado' : 'validados'}</Text>
    </Animated.View>
  );
}

/**
 * Los últimos resultados apilados abajo del visor: el nuevo entra desde arriba y empuja a los
 * otros, que se achican y se apagan un poco (el más viejo sale).
 */
function RecentStack({ items }: { items: Recent[] }) {
  return (
    <View style={styles.recent} accessibilityLabel="Últimos escaneos">
      {items.map((it, i) => (
        <Animated.View
          key={it.key}
          entering={FadeInUp.duration(260).easing(Easing.out(Easing.cubic))}
          exiting={FadeOut.duration(160)}
          layout={LinearTransition.duration(260).easing(Easing.out(Easing.cubic))}
          style={[styles.recentRow, { opacity: 1 - i * 0.28, transform: [{ scale: 1 - i * 0.04 }] }]}>
          <View style={[styles.recentDot, { backgroundColor: TONE[it.tone] }]} />
          <Text style={styles.recentTitle} numberOfLines={1}>
            {it.title}
          </Text>
          <Text style={styles.recentLine} numberOfLines={1}>
            {it.line}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

/** Vista de la cámara (con permiso). Mientras hay un resultado en pantalla no lee códigos. */
function CameraLayer({
  camera,
  torch,
  active,
  onCode,
}: {
  camera: CameraModule;
  torch: boolean;
  active: boolean;
  onCode: (data: string, box: Box | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = camera.useCameraPermissions();
  const { CameraView } = camera;

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.permission, { paddingTop: insets.top + 80 }]}>
        <Text style={styles.permissionText}>
          Necesitamos la cámara para leer los QR de las entradas y los pedidos.
        </Text>
        <Pressable
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          accessibilityRole="button"
          style={({ pressed }) => [styles.permissionBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.permissionBtnText}>
            {permission.canAskAgain ? 'Permitir cámara' : 'Abrir configuración'}
          </Text>
        </Pressable>
      </View>
    );
  }
  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      enableTorch={torch}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={
        active
          ? ({ data, bounds }) =>
              onCode(
                data,
                bounds && bounds.size.width > 0 && bounds.size.height > 0
                  ? { x: bounds.origin.x, y: bounds.origin.y, width: bounds.size.width, height: bounds.size.height }
                  : null,
              )
          : undefined
      }
    />
  );
}

const LOCK = { duration: 240, easing: Easing.out(Easing.cubic) };
/** Margen alrededor del QR cuando las esquinas lo enganchan. */
const LOCK_PAD = 14;

/**
 * Marco del visor con la línea de escaneo (suave, ida y vuelta). Al detectar un QR, cada esquina
 * se mueve hasta la esquina del código ("engancha") y la línea se apaga; al reiniciar vuelven.
 */
function Viewfinder({ active, target, color }: { active: boolean; target: Box | null; color: string }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const line = useSharedValue(0);
  const lineOpacity = useSharedValue(1);
  // Desplazamiento de cada esquina respecto de su lugar en el marco.
  const tl = { x: useSharedValue(0), y: useSharedValue(0) };
  const tr = { x: useSharedValue(0), y: useSharedValue(0) };
  const bl = { x: useSharedValue(0), y: useSharedValue(0) };
  const br = { x: useSharedValue(0), y: useSharedValue(0) };

  useEffect(() => {
    if (reduceMotion) return;
    line.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [line, reduceMotion]);

  useEffect(() => {
    lineOpacity.set(withTiming(target ? 0 : 1, { duration: 160 }));
    const move = (sv: { x: { set: (v: number) => void }; y: { set: (v: number) => void } }, x: number, y: number) => {
      sv.x.set(reduceMotion ? x : withTiming(x, LOCK));
      sv.y.set(reduceMotion ? y : withTiming(y, LOCK));
    };
    if (!target || !origin) {
      move(tl, 0, 0);
      move(tr, 0, 0);
      move(bl, 0, 0);
      move(br, 0, 0);
      return;
    }
    // Caja del QR relativa al marco, con margen y sin achicarse más que dos esquinas juntas.
    const size = Math.max(CORNER * 2 + 8, Math.max(target.width, target.height) + LOCK_PAD * 2);
    const cx = target.x + target.width / 2 - origin.x;
    const cy = target.y + target.height / 2 - origin.y;
    const left = cx - size / 2;
    const top = cy - size / 2;
    const right = cx + size / 2 - FRAME;
    const bottom = cy + size / 2 - FRAME;
    move(tl, left, top);
    move(tr, right, top);
    move(bl, left, bottom);
    move(br, right, bottom);
    // Los shared values son estables: solo importan el objetivo y la posición medida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, origin, reduceMotion]);

  const lineStyle = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
    transform: [{ translateY: line.value * (FRAME - 4) }],
  }));
  const tlStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tl.x.value }, { translateY: tl.y.value }] }));
  const trStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tr.x.value }, { translateY: tr.y.value }] }));
  const blStyle = useAnimatedStyle(() => ({ transform: [{ translateX: bl.x.value }, { translateY: bl.y.value }] }));
  const brStyle = useAnimatedStyle(() => ({ transform: [{ translateX: br.x.value }, { translateY: br.y.value }] }));

  return (
    <View
      ref={ref}
      style={styles.frame}
      onLayout={() => ref.current?.measureInWindow((x, y) => setOrigin({ x, y }))}>
      <View style={styles.frameClip}>
        {active ? <Animated.View style={[styles.scanLine, lineStyle]} /> : null}
      </View>
      <Animated.View style={[styles.corner, styles.tl, { borderColor: color }, tlStyle]} />
      <Animated.View style={[styles.corner, styles.tr, { borderColor: color }, trStyle]} />
      <Animated.View style={[styles.corner, styles.bl, { borderColor: color }, blStyle]} />
      <Animated.View style={[styles.corner, styles.br, { borderColor: color }, brStyle]} />
    </View>
  );
}

/**
 * Destello del color del resultado sobre toda la pantalla: sube rápido y se apaga en medio segundo.
 * Con "reducir movimiento" igual se muestra (es color, no movimiento), solo más corto.
 */
function ScreenFlash({ color }: { color: string }) {
  const reduceMotion = useReducedMotion();
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(
      withSequence(
        withTiming(0.45, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: reduceMotion ? 260 : 620, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [o, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]} />;
}

function RoundButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: 'close' | 'flashlight' | 'flashlightOn';
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.round, active && { backgroundColor: '#ffffff' }]}>
      <Icon name={icon} size={16} color={active ? '#000000' : '#ffffff'} />
    </Pressable>
  );
}

function Message({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <View style={styles.messageIcon}>
        <Icon name="lock" size={22} color="#ffffff" />
      </View>
      <Text style={styles.hint}>{text}</Text>
    </View>
  );
}

/** Tarjeta blanca abajo, sobre la cámara (para el pedido validado o el resultado). */
function BottomCard({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
      style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
      <PaletteScope palette={light}>
        <ScrollView bounces={false} contentContainerStyle={{ padding: Spacing.three }}>
          {children}
        </ScrollView>
      </PaletteScope>
    </Animated.View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LEN = 20;

/**
 * Resultado del escaneo. El ícono entra creciendo con una onda alrededor; según el tono:
 * éxito dibuja el check, advertencia se balancea y error hace temblar la tarjeta.
 */
function Outcome({
  tone,
  title,
  text,
  onNext,
  onOpen,
  autoNextMs,
}: {
  tone: 'success' | 'warning' | 'danger';
  title: string;
  text: string;
  onNext: () => void;
  onOpen?: () => void;
  /** Escaneo continuo: vuelve a leer solo pasado este tiempo (la barra del botón lo muestra). */
  autoNextMs?: number;
}) {
  const reduceMotion = useReducedMotion();
  const countdown = useSharedValue(0);
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onNextRef.current = onNext;
  });
  useEffect(() => {
    if (!autoNextMs) return;
    countdown.set(withTiming(1, { duration: autoNextMs, easing: Easing.linear }));
    const t = setTimeout(() => onNextRef.current(), autoNextMs);
    return () => clearTimeout(t);
  }, [autoNextMs, countdown]);
  const countdownStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: countdown.value }] }));
  const color = tone === 'success' ? light.success : tone === 'warning' ? light.warning : light.danger;
  const pop = useSharedValue(reduceMotion ? 1 : 0.4);
  const ring = useSharedValue(0);
  const check = useSharedValue(reduceMotion ? 1 : 0);
  const shake = useSharedValue(0);
  const wobble = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pop.set(
      withSequence(
        withTiming(1.12, { duration: 220, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 160, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    ring.set(withDelay(80, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })));
    if (tone === 'success') {
      check.set(withDelay(180, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) })));
    } else if (tone === 'danger') {
      const step = (x: number) => withTiming(x, { duration: 55, easing: Easing.inOut(Easing.quad) });
      shake.set(withDelay(120, withSequence(step(-10), step(9), step(-7), step(5), step(-3), step(0))));
    } else {
      const step = (r: number) => withTiming(r, { duration: 90, easing: Easing.inOut(Easing.quad) });
      wobble.set(withDelay(160, withSequence(step(-12), step(10), step(-6), step(3), step(0))));
    }
  }, [tone, reduceMotion, pop, ring, check, shake, wobble]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { rotate: `${wobble.value}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value > 0 && ring.value < 1 ? 0.6 * (1 - ring.value) : 0,
    transform: [{ scale: 1 + ring.value * 0.9 }],
  }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - check.value) }));

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[{ gap: 12, alignItems: 'center' }, cardStyle]}>
      {tone === 'success' ? <TicketMascot size={96} onLight confetti={false} /> : null}
      <View style={[styles.outcomeIconSlot, tone === 'success' && styles.outcomeBadge]}>
        <Animated.View style={[styles.outcomeRing, { borderColor: color }, ringStyle]} />
        <Animated.View style={[styles.outcomeIcon, { backgroundColor: color }, iconStyle]}>
          {tone === 'success' ? (
            <Svg width={26} height={26} viewBox="0 0 24 24">
              <AnimatedPath
                d="M6 12.5l4 4 8-8.5"
                stroke="#ffffff"
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
                animatedProps={checkProps}
              />
            </Svg>
          ) : (
            <Icon name={tone === 'warning' ? 'warning' : 'close'} size={22} color="#ffffff" />
          )}
        </Animated.View>
      </View>
      <Text style={styles.outcomeTitle}>{title}</Text>
      <Text style={styles.outcomeText}>{text}</Text>
      <Pressable
        onPress={onNext}
        accessibilityRole="button"
        accessibilityHint={autoNextMs ? 'Vuelve a escanear solo en un momento' : undefined}
        style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.85 }]}>
        {autoNextMs ? <Animated.View style={[styles.nextFill, countdownStyle]} /> : null}
        <Text style={styles.nextText}>{autoNextMs ? 'Escaneando el siguiente…' : 'Escanear otro'}</Text>
      </Pressable>
      {onOpen ? (
        <Pressable onPress={onOpen} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>Ver pedido</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const CORNER = 30;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05070b' },
  overlay: { flex: 1, paddingHorizontal: Spacing.three },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#ffffff', fontSize: 17, fontFamily: DisplayFont.semibold },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  count: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  countDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3ddc84' },
  countValue: { color: '#ffffff', fontSize: 15, lineHeight: 18, fontFamily: DisplayFont.bold },
  countLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  recent: { gap: 6, minHeight: 40 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  recentDot: { width: 8, height: 8, borderRadius: 4 },
  recentTitle: { color: '#ffffff', fontSize: 13, fontFamily: DisplayFont.semibold },
  recentLine: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  frame: { width: FRAME, height: FRAME },
  frameClip: { ...StyleSheet.absoluteFill, borderRadius: Radius.xl, overflow: 'hidden' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#ffffff' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
  scanLine: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#c6ff00',
  },
  hint: {
    color: '#ffffff',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  messageIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  permission: { alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.five },
  permissionText: { color: '#ffffff', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  permissionBtn: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  permissionBtnText: { color: '#000000', fontSize: 15, fontFamily: DisplayFont.semibold },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '78%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    backgroundColor: '#ffffff',
  },
  outcomeIconSlot: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  // En el éxito el check va como insignia sobre la mascota.
  outcomeBadge: { marginTop: -34, marginLeft: 76, transform: [{ scale: 0.72 }] },
  outcomeRing: { position: 'absolute', width: 52, height: 52, borderRadius: 26, borderWidth: 2 },
  outcomeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  outcomeTitle: { color: '#000000', fontSize: 20, fontFamily: DisplayFont.bold, textAlign: 'center' },
  outcomeText: { color: light.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  nextBtn: {
    overflow: 'hidden',
    alignSelf: 'stretch',
    height: 52,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  nextText: { color: '#ffffff', fontSize: 16, fontFamily: DisplayFont.semibold },
  // Se llena de izquierda a derecha mientras corre la cuenta del escaneo continuo.
  nextFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transformOrigin: 'left center',
  },
  link: { color: light.textSecondary, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
