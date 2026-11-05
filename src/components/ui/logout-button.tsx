import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { makeStyles, useTheme } from '@/theme';

/**
 * Botón de cerrar sesión (fondo rojo tenue). Por defecto cierra la sesión
 * directo; `onPress` permite envolverlo (p. ej. cerrar una hoja antes).
 */
export function LogoutButton({ onPress }: { onPress?: (signOut: () => void) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { signOut } = useAuth();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (onPress) onPress(signOut);
        else signOut();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
      <Icon name="logout" size={16} color={colors.danger} />
      <Text style={styles.text}>Cerrar sesión</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    logout: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.dangerMuted,
    },
    pressed: { opacity: 0.7 },
    text: { color: c.danger, fontSize: 15, fontFamily: DisplayFont.semibold },
  }),
);
