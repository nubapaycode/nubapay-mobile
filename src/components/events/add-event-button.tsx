import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { openAddEvent, WEB_URL } from '@/features/events/add-event';
import { makeStyles, useTheme } from '@/theme';

const INK = '#000000';

/** Botón gris para crear un evento (abre la web de Nubapay). Texto e ícono en negro. */
export function AddEventButton() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => openAddEvent(colors.primary)}
      disabled={!WEB_URL}
      accessibilityRole="button"
      accessibilityLabel="Agregar evento"
      accessibilityHint="Abre la web de Nubapay para crear un evento"
      style={({ pressed }) => [
        styles.add,
        pressed && { backgroundColor: colors.border },
        !WEB_URL && { opacity: 0.5 },
      ]}>
      <Icon name="plus" size={15} color={INK} />
      <Text style={styles.text}>Agregar evento</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    add: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.raised,
    },
    text: { color: INK, fontSize: 15, fontFamily: DisplayFont.semibold },
  }),
);
