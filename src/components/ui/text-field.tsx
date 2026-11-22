import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { Font, Radius, Spacing } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';
import { Text } from '@/components/ui/text';

type Props = TextInputProps & { label: string };

export function TextField({ label, style, ...rest }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        maxFontSizeMultiplier={1.3}
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
    label: { color: c.textSecondary, fontSize: 14, fontFamily: Font.medium },
    input: {
      fontFamily: Font.regular,
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
