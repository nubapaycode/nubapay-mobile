import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/dashboard/icon';
import { Radius } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

const dateFmt = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

/**
 * Fecha + hora en una fila. En iOS usa los pickers compactos nativos (abren su propio popover);
 * en Android cada parte es un botón que abre el diálogo nativo de fecha u hora.
 */
export function DateTimeField({
  value,
  onChange,
  minimumDate,
}: {
  value: Date;
  onChange: (d: Date) => void;
  minimumDate?: Date;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [androidPicker, setAndroidPicker] = useState<'date' | 'time' | null>(null);

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosRow}>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          minimumDate={minimumDate}
          accentColor={colors.primary}
          locale="es_AR"
          onValueChange={(_, d) => onChange(d)}
        />
        <DateTimePicker
          value={value}
          mode="time"
          display="compact"
          accentColor={colors.primary}
          locale="es_AR"
          onValueChange={(_, d) => onChange(d)}
        />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Fecha: ${dateFmt.format(value)}. Cambiar`}
        onPress={() => setAndroidPicker('date')}
        style={({ pressed }) => [styles.chip, styles.dateChip, pressed && styles.pressed]}>
        <Icon name="calendar" size={15} color={colors.ink} />
        <Text style={styles.chipText}>{dateFmt.format(value)}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Hora: ${timeFmt.format(value)}. Cambiar`}
        onPress={() => setAndroidPicker('time')}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
        <Icon name="clock" size={15} color={colors.ink} />
        <Text style={styles.chipText}>{timeFmt.format(value)}</Text>
      </Pressable>

      {/* El diálogo de Android se abre al montar: se desmonta al confirmar o cancelar. */}
      {androidPicker ? (
        <DateTimePicker
          value={value}
          mode={androidPicker}
          is24Hour
          minimumDate={androidPicker === 'date' ? minimumDate : undefined}
          accentColor={colors.primary}
          onValueChange={(_, d) => {
            setAndroidPicker(null);
            onChange(d);
          }}
          onDismiss={() => setAndroidPicker(null)}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    iosRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    row: { flexDirection: 'row', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 46,
      paddingHorizontal: 14,
      borderRadius: Radius.md,
      backgroundColor: c.raised,
    },
    dateChip: { flex: 1 },
    pressed: { backgroundColor: c.border },
    chipText: { color: c.ink, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  }),
);
