import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { Icon } from '@/components/dashboard/icon';
import { makeStyles, useTheme } from '@/theme';

type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string;
  error?: string | null;
  /** `clear`: botón para borrar · `password`: oculta el texto y muestra el ojo. */
  accessory?: 'clear' | 'password';
};

/** Campo de las pantallas de acceso: relleno, radio grande y borde que marca foco o error. */
export function AuthField({ label, error, accessory, onFocus, onBlur, ...rest }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const isPassword = accessory === 'password';
  const showClear = accessory === 'clear' && !!rest.value;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.focused, !!error && styles.errored]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          keyboardAppearance={colors.scheme}
          selectionColor={colors.brand}
          secureTextEntry={isPassword && !reveal}
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {showClear ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Borrar"
            hitSlop={8}
            onPress={() => rest.onChangeText?.('')}
            style={styles.clear}>
            <Icon name="close" size={12} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={8}
            onPress={() => setReveal((v) => !v)}
            style={styles.eye}>
            <Icon name={reveal ? 'eyeOff' : 'eye'} size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Icon name="alert" size={15} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrapper: { gap: 8 },
    label: { color: c.textSecondary, fontSize: 13, fontWeight: '500', paddingLeft: 4 },
    box: {
      height: 58,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.raised,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 18,
      paddingRight: 8,
      gap: 8,
    },
    focused: { borderColor: c.text },
    errored: { borderColor: c.danger },
    input: { flex: 1, height: '100%', color: c.text, fontSize: 17 },
    clear: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: c.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eye: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
    errorText: { color: c.danger, fontSize: 14, flexShrink: 1 },
  }),
);
