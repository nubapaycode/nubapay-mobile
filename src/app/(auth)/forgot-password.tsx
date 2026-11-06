import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { AuthField, AuthScreen, AuthTitle, isEmail, PillButton } from '@/components/auth';
import { Icon } from '@/components/dashboard/icon';
import { apiFetch, authPaths } from '@/lib/api';
import { makeStyles, useTheme } from '@/theme';

const RESEND_SECONDS = 30;

/**
 * Recuperar contraseña (POST /api/auth/forgot-password). El backend responde igual exista o no la
 * cuenta y manda un mail con el link para elegir una nueva clave en la web; el texto de
 * confirmación tampoco dice si la cuenta existe.
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function send(value: string) {
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
    setSentTo(value);
    setLeft(RESEND_SECONDS);
  }

  function onSubmit() {
    const value = email.trim().toLowerCase();
    if (!isEmail(value)) {
      setError('Ingresá un email válido');
      return;
    }
    send(value);
  }

  if (sentTo) {
    return (
      <SentState
        email={sentTo}
        secondsLeft={left}
        resending={loading}
        error={error}
        onResend={() => send(sentTo)}
      />
    );
  }

  return (
    <FormState
      email={email}
      onChangeEmail={(v) => {
        setEmail(v);
        if (error) setError(null);
      }}
      error={error}
      loading={loading}
      onSubmit={onSubmit}
    />
  );
}

function FormState({
  email,
  onChangeEmail,
  error,
  loading,
  onSubmit,
}: {
  email: string;
  onChangeEmail: (v: string) => void;
  error: string | null;
  loading: boolean;
  onSubmit: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <AuthScreen
      onBack={router.back}
      footer={<PillButton title="Enviar link" onPress={onSubmit} loading={loading} disabled={!email.trim()} />}>
      <View style={styles.header}>
        <View style={styles.tile}>
          <Icon name="key" size={24} color={colors.brand} />
        </View>
        <AuthTitle
          title="Recuperar contraseña"
          subtitle="Te mandamos un link por email para que elijas una nueva."
        />
      </View>
      <AuthField
        label="Email"
        value={email}
        onChangeText={onChangeEmail}
        error={error}
        accessory="clear"
        placeholder="tu@email.com"
        autoFocus={!email}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={onSubmit}
      />
    </AuthScreen>
  );
}

function SentState({
  email,
  secondsLeft,
  resending,
  error,
  onResend,
}: {
  email: string;
  secondsLeft: number;
  resending: boolean;
  error: string | null;
  onResend: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const waiting = secondsLeft > 0;
  const resendLabel = waiting
    ? `Reenviar en 0:${String(secondsLeft).padStart(2, '0')}`
    : 'Reenviar email';

  return (
    <AuthScreen
      onClose={router.back}
      footer={
        <>
          {Platform.OS === 'ios' ? (
            <PillButton
              title="Abrir app de email"
              onPress={() => Linking.openURL('message://').catch(() => {})}
            />
          ) : (
            <PillButton title="Volver al ingreso" onPress={() => router.back()} />
          )}
          <PillButton
            title={resendLabel}
            variant="ghost"
            onPress={onResend}
            loading={resending}
            disabled={waiting}
          />
        </>
      }>
      <View style={styles.sentHero}>
        <View style={styles.mailTile}>
          <Icon name="mail" size={52} color={colors.text} />
          <View style={styles.badge}>
            <Icon name="checkmark" size={18} color={colors.onBrand} />
          </View>
        </View>
        <AuthTitle
          center
          title="Revisá tu email"
          subtitle={
            <>
              Si hay una cuenta con <Text style={styles.strong}>{email}</Text>, te llega un link para
              elegir una contraseña nueva.
            </>
          }
        />
      </View>
      <View style={styles.notice}>
        <Icon name="alert" size={18} color={colors.warning} />
        <Text style={styles.noticeText}>¿No lo ves? Fijate en la carpeta de spam o promociones.</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AuthScreen>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    header: { gap: 18 },
    tile: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: c.brandMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sentHero: { alignItems: 'center', gap: 28, paddingTop: 12 },
    mailTile: {
      width: 128,
      height: 128,
      borderRadius: 36,
      backgroundColor: c.hero.glass,
      borderWidth: 1,
      borderColor: c.hero.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      right: -10,
      bottom: -10,
      width: 44,
      height: 44,
      borderRadius: 999,
      backgroundColor: c.brand,
      borderWidth: 4,
      borderColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    strong: { color: c.text, fontWeight: '600' },
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      borderRadius: 18,
      backgroundColor: c.warningMuted,
      borderWidth: 1,
      borderColor: c.warningMuted,
    },
    noticeText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20 },
    error: { color: c.danger, fontSize: 14, textAlign: 'center' },
  }),
);
