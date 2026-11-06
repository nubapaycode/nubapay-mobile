import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useThemeReveal } from '@/components/fx/theme-reveal';
import { AppearancePicker } from '@/components/ui/appearance-picker';
import { LogoutButton } from '@/components/ui/logout-button';
import { NavCard } from '@/components/ui/nav-card';
import { Sheet, useSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { DisplayFont, Spacing } from '@/constants/theme';
import { initials } from '@/features/dashboard/format';
import {
  allowBiometricOffer,
  type BiometricKind,
  disableBiometricLogin,
  getBiometricEmail,
  getBiometricKind,
} from '@/lib/biometrics';
import { hasScanSounds, setScanSoundEnabled, useScanSoundEnabled, useSaleSoundEnabled, setSaleSoundEnabled } from '@/lib/sounds';
import { useAuth } from '@/providers/auth-provider';
import { makeStyles, useTheme } from '@/theme';

const HELP_URL = 'https://www.nubapay.app/ayuda';


/** Hoja de perfil (botón de arriba a la izquierda): cuenta, apariencia, accesos a Cobros y Ayuda, y cerrar sesión. */
export default function ProfileSheet() {
  return (
    <Sheet>
      <ProfileContent />
    </Sheet>
  );
}

function ProfileContent() {
  const styles = useStyles();
  const { dismiss } = useSheet();
  const { colors, preference } = useTheme();
  // Cambio de tema con revelado circular desde la opción tocada.
  const reveal = useThemeReveal();
  const { user } = useAuth();
  const name = user?.name ?? 'Organizador';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.account}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(name) || '·'}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {user?.email ? (
            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.appearance}>
        <Text style={styles.sectionTitle}>Apariencia</Text>
        <AppearancePicker value={preference} onChange={reveal} />
        {preference === 'system' ? (
          <Text style={styles.hint}>Automático sigue el modo claro u oscuro de tu teléfono.</Text>
        ) : null}
      </View>

      <View style={styles.menu}>
        <BiometricCard email={user?.email} />
        {hasScanSounds ? <ScanSoundCard /> : null}
        {hasScanSounds ? <SaleSoundCard /> : null}
        <NavCard
          icon="bank"
          title="Cobros"
          subtitle="Métodos de pago y comisión"
          onPress={() => dismiss(() => router.push('/payouts'))}
        />
        <NavCard
          icon="help"
          title="Ayuda"
          subtitle="Preguntas frecuentes y soporte"
          external
          onPress={() =>
            WebBrowser.openBrowserAsync(HELP_URL, {
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
              controlsColor: colors.primary,
            })
          }
        />
      </View>

      <LogoutButton onPress={(signOut) => dismiss(signOut)} />
    </ScrollView>
  );
}

/** Sonido al validar un QR (éxito, aviso, error). Al prenderlo suena una vez de muestra. */
function ScanSoundCard() {
  const { colors } = useTheme();
  const on = useScanSoundEnabled();
  const toggle = () => {
    Haptics.selectionAsync();
    setScanSoundEnabled(!on);
  };
  return (
    <NavCard
      icon="sound"
      title="Sonido del escáner"
      subtitle={on ? 'Suena al validar (respeta el modo silencio)' : 'Desactivado'}
      onPress={toggle}
      right={
        <Switch
          value={on}
          onValueChange={toggle}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel={`Sonido del escáner: ${on ? 'activado' : 'desactivado'}`}
        />
      }
    />
  );
}

/** "Ka-ching" cuando entra una venta con el inicio abierto. Al prenderlo suena una vez de muestra. */
function SaleSoundCard() {
  const { colors } = useTheme();
  const on = useSaleSoundEnabled();
  const toggle = () => {
    Haptics.selectionAsync();
    setSaleSoundEnabled(!on);
  };
  return (
    <NavCard
      icon="cash"
      title="Sonido de venta"
      subtitle={on ? 'Suena al entrar una venta en vivo' : 'Desactivado'}
      onPress={toggle}
      right={
        <Switch
          value={on}
          onValueChange={toggle}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel={`Sonido de venta: ${on ? 'activado' : 'desactivado'}`}
        />
      }
    />
  );
}

/**
 * Ingreso con Face ID / huella en este teléfono. Activarlo necesita la contraseña, así que desde acá
 * solo se apaga; prenderlo deja la oferta lista para el próximo ingreso con contraseña.
 */
function BiometricCard({ email }: { email?: string }) {
  const { colors } = useTheme();
  const [kind, setKind] = useState<BiometricKind | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    Promise.all([getBiometricKind(), getBiometricEmail()]).then(([k, saved]) => {
      setKind(k);
      setEnabled(!!email && saved === email);
    });
  }, [email]);

  if (!kind || !email) return null;

  async function toggle() {
    if (!kind) return;
    if (enabled) {
      await disableBiometricLogin();
      setEnabled(false);
      toast.info(`Ingreso con ${kind.name} desactivado`);
      return;
    }
    await allowBiometricOffer();
    toast.info(
      `Activá ${kind.name} al ingresar`,
      'La próxima vez que entres con tu contraseña te lo vamos a ofrecer.',
    );
  }

  return (
    <NavCard
      icon={kind.icon}
      title={`Ingreso con ${kind.name}`}
      subtitle={enabled ? 'Activado en este teléfono' : 'Desactivado'}
      onPress={toggle}
      right={
        <Switch
          value={enabled}
          onValueChange={() => {
            Haptics.selectionAsync();
            toggle();
          }}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel={`Ingreso con ${kind.name}: ${enabled ? 'activado' : 'desactivado'}`}
        />
      }
    />
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flexGrow: 0 },
    content: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },

    account: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.text,
    },
    avatarText: { color: c.surface, fontSize: 18, fontFamily: DisplayFont.bold },
    name: { color: c.text, fontSize: 20, fontFamily: DisplayFont.bold, letterSpacing: -0.4 },
    email: { color: c.textMuted, fontSize: 13 },

    appearance: { gap: 12 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    hint: { color: c.textMuted, fontSize: 12 },
    menu: { gap: 10 },
  }),
);
