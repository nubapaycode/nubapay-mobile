import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

type Props = TextInputProps & { label: string };

export function TextField({ label, style, ...rest }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        keyboardAppearance={colors.scheme}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrapper: { gap: Spacing.two },
    label: { color: c.textSecondary, fontSize: 14, fontWeight: '500' },
    input: {
      height: 52,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.raised,
      color: c.text,
      paddingHorizontal: Spacing.three,
      fontSize: 16,
    },
  }),
);
