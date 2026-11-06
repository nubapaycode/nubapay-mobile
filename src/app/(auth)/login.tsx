import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthField, AuthScreen, AuthTitle, isEmail, PillButton } from '@/components/auth';
import { Icon } from '@/components/dashboard/icon';
import { toast } from '@/components/ui/toast';
import {
  type BiometricKind,
  disableBiometricLogin,
  getBiometricEmail,
  getBiometricKind,
  readBiometricCredentials,
} from '@/lib/biometrics';
import { useAuth } from '@/providers/auth-provider';
import { makeStyles, useTheme } from '@/theme';

type Mode = 'checking' | 'biometric' | 'form';

/**
 * Ingreso, paso 1. Si este teléfono tiene activo el ingreso con biometría, lo ofrece (y lo pide
 * solo al abrir); si no, pide el email y la contraseña va en la pantalla siguiente.
 */
export default function LoginScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>(params.email ? 'form' : 'checking');
  const [kind, setKind] = useState<BiometricKind | null>(null);
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const autoPrompted = useRef(false);

  async function biometricLogin(k: BiometricKind) {
    setLoading(true);
    setError(null);
    const read = await readBiometricCredentials();
    if (read.status === 'cancelled') {
      setLoading(false);
      return;
    }
    if (read.status === 'invalid') {
      setLoading(false);
      setMode('form');
      toast.info(`${capitalize(k.name)} desactivado`, 'Cambió la biometría del teléfono. Ingresá con tu contraseña.');
      return;
    }
    const res = await signIn(read.email, read.password);
    if (res.ok) return; // El layout raíz lleva a la app.
    setLoading(false);
    if (res.status && res.status >= 400 && res.status < 500) {
      // Las credenciales guardadas ya no sirven (p. ej. cambió la contraseña).
      await disableBiometricLogin();
      setEmail(read.email);
      setMode('form');
      toast.error('No pudimos ingresar', `Ingresá con tu contraseña para volver a activar ${k.phrase}.`);
      return;
    }
    setError(res.error ?? 'No se pudo iniciar sesión');
  }

  useEffect(() => {
    if (mode !== 'checking') return;
    (async () => {
      const [savedEmail, k] = await Promise.all([getBiometricEmail(), getBiometricKind()]);
      if (savedEmail && k) {
        setEmail(savedEmail);
        setKind(k);
        setMode('biometric');
        if (!autoPrompted.current) {
          autoPrompted.current = true;
          biometricLogin(k);
        }
      } else {
        setMode('form');
      }
    })();
    // Solo al abrir la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onNext() {
    const value = email.trim().toLowerCase();
    if (!isEmail(value)) {
      setError('Ingresá un email válido');
      return;
    }
    setError(null);
    router.push({ pathname: '/password', params: { email: value } });
  }

  const onBack = router.canGoBack() ? router.back : undefined;

  if (mode === 'checking') return <AuthScreen onBack={onBack}>{null}</AuthScreen>;

  if (mode === 'biometric' && kind) {
    return (
      <BiometricLogin
        email={email}
        kind={kind}
        loading={loading}
        error={error}
        onBack={onBack}
        onBiometric={() => biometricLogin(kind)}
        onUsePassword={() => {
          setError(null);
          setMode('form');
        }}
      />
    );
  }

  return (
    <AuthScreen
      onBack={onBack}
      footer={<PillButton title="Continuar" onPress={onNext} disabled={!email.trim()} />}>
      <AuthTitle title="Hola de nuevo" subtitle="Ingresá el email de tu cuenta nubapay." />
      <AuthField
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (error) setError(null);
        }}
        error={error}
        accessory="clear"
        placeholder="tu@email.com"
        autoFocus={!email}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={onNext}
      />
    </AuthScreen>
  );
}

function BiometricLogin({
  email,
  kind,
  loading,
  error,
  onBack,
  onBiometric,
  onUsePassword,
}: {
  email: string;
  kind: BiometricKind;
  loading: boolean;
  error: string | null;
  onBack?: () => void;
  onBiometric: () => void;
  onUsePassword: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <AuthScreen
      onBack={onBack}
      footer={
        <>
          <PillButton title={`Ingresar con ${kind.phrase}`} onPress={onBiometric} loading={loading} />
          <PillButton title="Usar contraseña" variant="ghost" onPress={onUsePassword} disabled={loading} />
        </>
      }>
      <AuthTitle title="Hola de nuevo" subtitle={`Ingresá con ${kind.phrase} a tu cuenta.`} />
      <View style={styles.account}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{email.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.email} numberOfLines={1}>
          {email}
        </Text>
        <Icon name={kind.icon} size={22} color={colors.brand} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AuthScreen>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    account: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 18,
      backgroundColor: c.hero.glass,
      borderWidth: 1,
      borderColor: c.hero.glassBorder,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: c.onBrand, fontSize: 16, fontWeight: '600' },
    email: { flex: 1, color: c.text, fontSize: 16, fontWeight: '500' },
    error: { color: c.danger, fontSize: 14 },
  }),
);
