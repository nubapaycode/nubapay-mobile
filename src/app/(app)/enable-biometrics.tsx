import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AuthScreen, AuthTitle, PillButton } from '@/components/auth';
import { Icon, type IconName } from '@/components/dashboard/icon';
import { toast } from '@/components/ui/toast';
import {
  type BiometricKind,
  declineBiometricOffer,
  enableBiometricLogin,
  getBiometricKind,
  peekPendingBiometricOffer,
  setPendingBiometricOffer,
} from '@/lib/biometrics';
import { dark, makeStyles, PaletteScope, useTheme } from '@/theme';

/**
 * Oferta de ingreso con biometría, justo después de entrar con contraseña. Va en oscuro como el
 * resto del acceso. Sin oferta pendiente (o sin sensor) se cierra sola.
 */
export default function EnableBiometricsScreen() {
  return (
    <PaletteScope palette={dark}>
      <EnableBiometrics />
    </PaletteScope>
  );
}

function EnableBiometrics() {
  const styles = useStyles();
  const [kind, setKind] = useState<BiometricKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const offer = peekPendingBiometricOffer();

  useEffect(() => {
    if (!offer) {
      router.back();
      return;
    }
    getBiometricKind().then((k) => (k ? setKind(k) : finish()));
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    setPendingBiometricOffer(null);
    if (router.canGoBack()) router.back();
  }

  async function onLater() {
    if (offer) await declineBiometricOffer(offer.email);
    finish();
  }

  async function onEnable() {
    if (!offer || !kind) return;
    setBusy(true);
    const ok = await enableBiometricLogin(offer.email, offer.password, kind);
    setBusy(false);
    if (!ok) return; // Canceló el sensor: puede reintentar o elegir "Ahora no".
    // El ícono se vuelve un check que se dibuja; recién después se cierra.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDone(true);
    setTimeout(() => {
      toast.success(`${kind.name} activado`, 'La próxima vez entrás sin escribir tu contraseña.');
      finish();
    }, 1100);
  }

  if (!kind) return <View style={styles.blank} />;

  return (
    <AuthScreen
      onClose={onLater}
      footer={
        <>
          <PillButton title={`Activar ${kind.name}`} onPress={onEnable} loading={busy} disabled={done} />
          <PillButton title="Ahora no" variant="ghost" onPress={onLater} disabled={busy || done} />
        </>
      }>
      <View style={styles.hero}>
        <BiometricTile icon={kind.icon} done={done} />
        <AuthTitle
          center
          title={`Entrá con ${kind.phrase}`}
          subtitle="La próxima vez no vas a tener que escribir tu contraseña."
        />
      </View>
      <View style={styles.benefits}>
        <Benefit icon="bolt" title="Al instante" text="Una mirada o un toque y estás adentro." />
        <Benefit
          icon="shield"
          title="Privado"
          text="Tu biometría nunca sale del teléfono; la verifica el sistema."
        />
      </View>
    </AuthScreen>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LEN = 26;
const EASE = Easing.out(Easing.cubic);

/**
 * Ícono del sensor con una línea lima que lo recorre (como si escaneara). Al activarse, el ícono se
 * achica y se va, el fondo se llena de lima con una onda alrededor y el check se dibuja.
 */
function BiometricTile({ icon, done }: { icon: IconName; done: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const sweep = useSharedValue(0);
  const success = useSharedValue(0);
  const ring = useSharedValue(0);
  const check = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    sweep.set(withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [reduceMotion, sweep]);

  useEffect(() => {
    if (!done) return;
    if (reduceMotion) {
      success.set(1);
      check.set(1);
      return;
    }
    success.set(withTiming(1, { duration: 280, easing: EASE }));
    ring.set(withDelay(120, withTiming(1, { duration: 700, easing: EASE })));
    check.set(withDelay(220, withTiming(1, { duration: 360, easing: EASE })));
  }, [done, reduceMotion, success, ring, check]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: 1 - success.value,
    transform: [{ scale: 1 - success.value * 0.4 }],
  }));
  const lineStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : 0.7 * (1 - success.value),
    transform: [{ translateY: 18 + sweep.value * 92 }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: success.value,
    transform: [{ scale: 0.6 + success.value * 0.4 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value > 0 && ring.value < 1 ? 0.7 * (1 - ring.value) : 0,
    transform: [{ scale: 1 + ring.value * 0.45 }],
  }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - check.value) }));

  return (
    <View style={styles.tileSlot}>
      <Animated.View style={[styles.tileRing, { borderColor: colors.brand }, ringStyle]} />
      <View style={styles.tile}>
        <Animated.View style={iconStyle}>
          <Icon name={icon} size={60} color={colors.brand} />
        </Animated.View>
        <Animated.View style={[styles.scanLine, { backgroundColor: colors.brand }, lineStyle]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.tileFill, { backgroundColor: colors.brand }, fillStyle]}>
          <Svg width={64} height={64} viewBox="0 0 24 24">
            <AnimatedPath
              d="M5.5 12.5l4.2 4.2 8.8-9"
              stroke={colors.onBrand}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
              animatedProps={checkProps}
            />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

function Benefit({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}>
        <Icon name={icon} size={20} color={colors.brand} />
      </View>
      <View style={styles.benefitCopy}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitText}>{text}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    blank: { flex: 1, backgroundColor: c.background },
    hero: { alignItems: 'center', gap: 28, paddingTop: 12 },
    tileSlot: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
    tileRing: { position: 'absolute', width: 128, height: 128, borderRadius: 36, borderWidth: 2 },
    tileFill: { borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
    scanLine: { position: 'absolute', top: 0, left: 24, right: 24, height: 2, borderRadius: 1 },
    tile: {
      width: 128,
      height: 128,
      overflow: 'hidden',
      borderRadius: 36,
      backgroundColor: c.hero.glass,
      borderWidth: 1,
      borderColor: c.hero.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    benefits: { gap: 10 },
    benefit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 18,
      backgroundColor: c.hero.glass,
      borderWidth: 1,
      borderColor: c.hero.glassBorder,
    },
    benefitIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.brandMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    benefitCopy: { flex: 1, gap: 2 },
    benefitTitle: { color: c.text, fontSize: 15, fontWeight: '600' },
    benefitText: { color: c.textSecondary, fontSize: 14, lineHeight: 19 },
  }),
);
