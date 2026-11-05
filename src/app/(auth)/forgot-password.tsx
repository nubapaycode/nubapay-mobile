import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, TextField } from '@/components/ui';
import { DisplayFont, Spacing } from '@/constants/theme';
import { apiFetch, authPaths } from '@/lib/api';
import { makeStyles } from '@/theme';

/**
 * Recuperar contraseña (POST /api/auth/forgot-password). El backend responde igual exista o no la
 * cuenta y manda un mail con el link para elegir una nueva clave en la web.
 */
export default function ForgotPasswordScreen() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function onSubmit() {
    const value = email.trim().toLowerCase();
    if (!value.includes('@')) {
      setError('Ingresá un email válido');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await apiFetch<{ ok: true; message?: string }>(authPaths.forgotPassword(), {
      method: 'POST',
      token: null,
      body: JSON.stringify({ email: value }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSent(res.data.message ?? 'Si hay una cuenta con ese email, te enviamos las instrucciones.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Recuperar contraseña</Text>
          <Text style={styles.text}>
            {sent ?? 'Te mandamos un mail con un link para elegir una contraseña nueva.'}
          </Text>
        </View>

        <View style={styles.form}>
          {sent ? null : (
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              onSubmitEditing={onSubmit}
            />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {sent ? null : <Button title="Enviar link" onPress={onSubmit} loading={loading} />}
          <Button title="Volver a ingresar" variant="ghost" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.canvas },
    container: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.five },
    header: { gap: Spacing.two },
    title: { color: c.text, fontSize: 28, fontFamily: DisplayFont.bold, letterSpacing: -0.8 },
    text: { color: c.textSecondary, fontSize: 15, lineHeight: 21 },
    form: { gap: Spacing.three },
    error: { color: c.danger, fontSize: 14 },
  }),
);
