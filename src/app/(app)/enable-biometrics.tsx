import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
  const { colors } = useTheme();
  const [kind, setKind] = useState<BiometricKind | null>(null);
  const [busy, setBusy] = useState(false);
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
    toast.success(`${kind.name} activado`, 'La próxima vez entrás sin escribir tu contraseña.');
    finish();
  }

  if (!kind) return <View style={styles.blank} />;

  return (
    <AuthScreen
      onClose={onLater}
      footer={
        <>
          <PillButton title={`Activar ${kind.name}`} onPress={onEnable} loading={busy} />
          <PillButton title="Ahora no" variant="ghost" onPress={onLater} disabled={busy} />
        </>
      }>
      <View style={styles.hero}>
        <View style={styles.tile}>
          <Icon name={kind.icon} size={60} color={colors.brand} />
        </View>
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
    tile: {
      width: 128,
      height: 128,
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
