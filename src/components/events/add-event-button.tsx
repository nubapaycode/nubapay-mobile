import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { useEventAccess } from '@/features/access/access';
import { openAddEvent } from '@/features/events/add-event';
import { makeStyles, useTheme } from '@/theme';

/** Botón gris para crear un evento. Texto e ícono en la tinta del tema. Las cuentas de staff no lo ven. */
export function AddEventButton({ onPress = openAddEvent }: { onPress?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { canCreateEvents } = useEventAccess();
  if (!canCreateEvents) return null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Agregar evento"
      style={({ pressed }) => [styles.add, pressed && { backgroundColor: colors.border }]}>
      <Icon name="plus" size={15} color={colors.ink} />
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
    text: { color: c.ink, fontSize: 15, fontFamily: DisplayFont.semibold },
  }),
);
