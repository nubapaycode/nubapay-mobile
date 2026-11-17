import * as Haptics from 'expo-haptics';
import { ActivityIndicator, type PressableProps, StyleSheet } from 'react-native';

import { ScalePressable } from '@/components/motion/scale-pressable';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';
import { Text } from '@/components/ui/text';

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'ghost';
};

export function Button({ title, loading, variant = 'primary', disabled, style, onPress, ...rest }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  return (
    <ScalePressable
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={(state) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.ghost,
        state.pressed && variant === 'primary' && { backgroundColor: colors.primaryPressed },
        state.pressed && variant === 'ghost' && { opacity: 0.6 },
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.text} />
      ) : (
        <Text style={[styles.label, variant === 'ghost' && { color: colors.accent }]}>{title}</Text>
      )}
    </ScalePressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    base: {
      height: 52,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.four,
    },
    primary: { backgroundColor: c.primary },
    ghost: { backgroundColor: 'transparent' },
    disabled: { opacity: 0.6 },
    label: { color: c.onPrimary, fontSize: 16, fontWeight: '600' },
  }),
);
