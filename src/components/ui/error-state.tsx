import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Ticky } from '@/components/illustrations/ticky';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DisplayFont, Spacing } from '@/constants/theme';
import { isConnectionError } from '@/lib/api';
import { onReconnect } from '@/lib/network';
import { makeStyles, useTheme } from '@/theme';

type Props = {
  /** Qué no se pudo cargar ("No pudimos cargar el equipo"). Si no hay conexión, se reemplaza por "Sin conexión". */
  title?: string;
  /** El error tal cual vino de la consulta. */
  message?: string | null;
  /** Vuelve a pedir lo que falló. Si el problema es de conexión, también se corre solo al volver internet. */
  onRetry?: () => void | Promise<unknown>;
  /** Más chico, para dentro de una card o una hoja. */
  compact?: boolean;
};

/**
 * Estado de error único de la app: Ticky triste, qué falló, por qué y cómo seguir. Distingue la falta
 * de conexión (mensaje y reintento automático al volver internet) de un error del servidor.
 */
export function ErrorState({ title = 'No pudimos cargar esto', message, onRetry, compact }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const offline = isConnectionError(message);

  // Siempre la última versión de `onRetry`, sin volver a suscribirse en cada render.
  const retryRef = useRef(onRetry);
  useEffect(() => {
    retryRef.current = onRetry;
  });

  useEffect(() => {
    if (!offline) return;
    return onReconnect(() => void retryRef.current?.());
  }, [offline]);

  const retry = async () => {
    if (!onRetry || busy) return;
    Haptics.selectionAsync();
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      style={[styles.wrap, compact && styles.compact]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite">
      <Ticky size={compact ? 84 : 120} pose="sad" confetti={false} onLight={colors.scheme === 'light'} />
      <View style={styles.texts}>
        <Text style={styles.title}>{offline ? 'Sin conexión' : title}</Text>
        <Text style={styles.message}>
          {offline
            ? onRetry
              ? 'Revisá tu internet. Apenas vuelva, lo cargamos solos.'
              : 'Revisá tu internet y probá de nuevo.'
            : (message ?? 'Probá de nuevo en un momento.')}
        </Text>
      </View>
      {onRetry ? <Button title="Reintentar" variant="ghost" loading={busy} onPress={retry} /> : null}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five, paddingHorizontal: Spacing.three },
    compact: { paddingVertical: Spacing.three },
    texts: { alignItems: 'center', gap: 4 },
    title: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold, textAlign: 'center' },
    message: { color: c.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  }),
);
