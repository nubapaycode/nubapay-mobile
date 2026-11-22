import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Font, Radius, Spacing } from '@/constants/theme';
import { makeStyles } from '@/theme';
import { Text } from '@/components/ui/text';

type Props = {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  /** Posición en la cascada de entrada (escalonado de 60 ms). */
  index?: number;
  style?: ViewStyle;
};

export function Card({ title, subtitle, right, children, index = 0, style }: Props) {
  const styles = useStyles();
  return (
    <Animated.View
      entering={FadeInDown.delay(60 + index * 60).duration(400)}
      style={[styles.card, style]}>
      {title ? (
        <View style={styles.header}>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: c.scheme === 'dark' ? StyleSheet.hairlineWidth : 0,
      borderColor: c.border,
      padding: Spacing.three,
      gap: Spacing.three,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.two,
    },
    title: { color: c.text, fontSize: 17, fontFamily: Font.medium, letterSpacing: -0.2 },
    subtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  }),
);
