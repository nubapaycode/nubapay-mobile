import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthField, AuthScreen, AuthTitle, PillButton } from '@/components/auth';
import { setPendingBiometricOffer } from '@/lib/biometrics';
import { useAuth } from '@/providers/auth-provider';
import { makeStyles } from '@/theme';

/**
 * Ingreso, paso 2: la contraseña del email elegido. Al entrar, el layout raíz lleva solo a la app
 * (la ruta de acceso queda protegida sin sesión).
 */
export default function PasswordScreen() {
  const styles = useStyles();
  const { signIn } = useAuth();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!email) return <Redirect href="/login" />;

  async function onSubmit() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    // Si entra, la app ofrece activar Face ID con estas credenciales (solo en memoria).
    setPendingBiometricOffer({ email, password });
    const res = await signIn(email, password);
    setLoading(false);
    if (!res.ok) {
      setPendingBiometricOffer(null);
      setError(res.error ?? 'No se pudo iniciar sesión');
    }
  }

  return (
    <AuthScreen
      onBack={router.back}
      footer={<PillButton title="Ingresar" onPress={onSubmit} loading={loading} disabled={!password} />}>
      <View style={styles.header}>
        <AuthTitle title="Ingresá tu contraseña" />
        <View style={styles.chip}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{email.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.chipEmail} numberOfLines={1}>
            {email}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cambiar email"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.change, pressed && { opacity: 0.6 }]}>
            <Text style={styles.changeText}>Cambiar</Text>
          </Pressable>
        </View>
      </View>
      <AuthField
        label="Contraseña"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (error) setError(null);
        }}
        error={error}
        accessory="password"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <Pressable
        accessibilityRole="link"
        hitSlop={8}
        onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
        style={({ pressed }) => [styles.forgot, pressed && { opacity: 0.6 }]}>
        <Text style={styles.forgotText}>Olvidé mi contraseña</Text>
      </Pressable>
    </AuthScreen>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    header: { gap: 14 },
    chip: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 6,
      borderRadius: 999,
      backgroundColor: c.hero.glass,
      borderWidth: 1,
      borderColor: c.hero.glassBorder,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 999,
      backgroundColor: c.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: c.onBrand, fontSize: 13, fontWeight: '600' },
    chipEmail: { color: c.text, fontSize: 14, flexShrink: 1 },
    change: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: c.brandMuted },
    changeText: { color: c.brandText, fontSize: 13, fontWeight: '600' },
    forgot: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 4 },
    forgotText: { color: c.brandText, fontSize: 15, fontWeight: '600' },
  }),
);
