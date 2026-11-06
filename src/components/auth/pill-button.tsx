import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, Text } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

type Variant = 'brand' | 'ink' | 'ghost';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  loading?: boolean;
  /** `brand`: lima (acción principal) · `ink`: blanco · `ghost`: solo texto. */
  variant?: Variant;
};

/** Botón en píldora de las pantallas de acceso. */
export function PillButton({ title, loading, variant = 'brand', disabled, style, ...rest }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const labelColor =
    variant === 'brand' ? colors.onBrand : variant === 'ink' ? colors.onInk : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        styles[variant],
        state.pressed && styles.pressed,
        disabled && !loading && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text style={[styles.label, { color: labelColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    base: {
      height: 56,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    brand: { backgroundColor: c.brand },
    ink: { backgroundColor: c.ink },
    ghost: { height: 52, backgroundColor: 'transparent' },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    disabled: { opacity: 0.4 },
    label: { fontSize: 17, fontWeight: '600' },
  }),
);
