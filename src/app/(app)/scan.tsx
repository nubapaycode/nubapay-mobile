import { requireOptionalNativeModule } from 'expo';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  SlideInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/dashboard/icon';
import { DeliverPanel } from '@/components/operations/deliver-panel';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { useEventAccess } from '@/features/access/access';
import { formatMoney } from '@/features/dashboard/format';
import { parseOrderId, remainingOf, SCAN_COPY, scanKind } from '@/features/operations/scan';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { type Order, previewScan } from '@/lib/api/organizer';
import { invalidate } from '@/lib/query';
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

const FRAME = 248;

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
  const lock = useRef(false);
  useFocusStatusBar('light');

  const reset = useCallback(() => {
    lock.current = false;
    setResult({ kind: 'scanning' });
  }, []);

  const onCode = useCallback(
    async (data: string) => {
      if (lock.current || !eventId) return;
      lock.current = true;
      const orderId = parseOrderId(data);
      if (!orderId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setResult({ kind: 'error', message: 'Este QR no es de un pedido de Nubapay.' });
        return;
      }
      setResult({ kind: 'loading' });
      const res = await previewScan(eventId, orderId);
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResult({ kind: 'deliver', order: res.data });
      } else if (res.alreadyScanned) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setResult({ kind: 'already', order: res.order ?? null });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setResult({ kind: 'error', message: res.error });
      }
    },
    [eventId],
  );

  const delivered = (order: Order) => {
    invalidate(`orders:${eventId}`);
    invalidate(`order:${eventId}:${order.id}`);
    invalidate(`scan:${eventId}`);
    invalidate('dashboard');
    setResult({ kind: 'done', order });
  };

  const allowed = can('scanner');
  const scanning = result.kind === 'scanning';

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

        {!allowed ? (
          <Message text="Tu rol en este evento no incluye el escáner. Pedile acceso al organizador." />
        ) : !Camera ? (
          <Message text="Esta versión de la app no incluye la cámara. Instalá el build nuevo para escanear." />
        ) : (
          <>
            <View style={styles.center}>
              <Viewfinder active={scanning} />
              <Text style={styles.hint}>
                {result.kind === 'loading' ? 'Verificando pedido…' : 'Apuntá al código QR de la entrada o del pedido'}
              </Text>
              {result.kind === 'loading' ? <ActivityIndicator color="#ffffff" /> : null}
            </View>
            <View style={{ height: 40 }} />
          </>
        )}
      </View>

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
          />
        </BottomCard>
      ) : result.kind === 'already' ? (
        <BottomCard>
          <Outcome
            tone="warning"
            title={result.order ? SCAN_COPY[scanKind(result.order)].alreadyDone : 'Este QR ya fue escaneado'}
            text={result.order ? orderLine(result.order) : 'No queda nada pendiente en este pedido.'}
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
  onCode: (data: string) => void;
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
      onBarcodeScanned={active ? ({ data }) => onCode(data) : undefined}
    />
  );
}

/** Marco del visor con la línea de escaneo (suave, ida y vuelta). */
function Viewfinder({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const line = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    line.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [line, reduceMotion]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: line.value * (FRAME - 4) }] }));
  return (
    <View style={styles.frame}>
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />
      {active ? <Animated.View style={[styles.scanLine, lineStyle]} /> : null}
    </View>
  );
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

function Outcome({
  tone,
  title,
  text,
  onNext,
  onOpen,
}: {
  tone: 'success' | 'warning' | 'danger';
  title: string;
  text: string;
  onNext: () => void;
  onOpen?: () => void;
}) {
  const color = tone === 'success' ? light.success : tone === 'warning' ? light.warning : light.danger;
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ gap: 12, alignItems: 'center' }}>
      <View style={[styles.outcomeIcon, { backgroundColor: color }]}>
        <Icon name={tone === 'success' ? 'checkmark' : tone === 'warning' ? 'warning' : 'close'} size={22} color="#ffffff" />
      </View>
      <Text style={styles.outcomeTitle}>{title}</Text>
      <Text style={styles.outcomeText}>{text}</Text>
      <Pressable
        onPress={onNext}
        accessibilityRole="button"
        style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.85 }]}>
        <Text style={styles.nextText}>Escanear otro</Text>
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
  frame: { width: FRAME, height: FRAME, borderRadius: Radius.xl, overflow: 'hidden' },
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
  outcomeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  outcomeTitle: { color: '#000000', fontSize: 20, fontFamily: DisplayFont.bold, textAlign: 'center' },
  outcomeText: { color: light.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  nextBtn: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: Radius.xl,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  nextText: { color: '#ffffff', fontSize: 16, fontFamily: DisplayFont.semibold },
  link: { color: light.textSecondary, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
