import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { DisplayFont, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { makeStyles } from '@/theme';

export default function LoginScreen() {
  const styles = useStyles();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!email || !password) {
      setError('Completá email y contraseña');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await signIn(email, password);
    setLoading(false);
    if (!res.ok) setError(res.error ?? 'No se pudo iniciar sesión');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.brand}>nubapay</Text>
          <Text style={styles.subtitle}>Business</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextField
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={onSubmit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Ingresar" onPress={onSubmit} loading={loading} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.canvas },
    container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.five },
    header: { alignItems: 'center', gap: Spacing.one },
    brand: { color: c.text, fontSize: 42, fontFamily: DisplayFont.extrabold, letterSpacing: -1.2 },
    subtitle: {
      color: c.brandText,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    form: { gap: Spacing.three },
    error: { color: c.danger, fontSize: 14 },
  }),
);
