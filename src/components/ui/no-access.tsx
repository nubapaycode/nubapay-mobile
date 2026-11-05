import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

/** Tarjeta para cuando el rol de la persona en el evento no incluye esta herramienta. */
export function NoAccess({ title = 'Sin permiso', text }: { title?: string; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.card}>
      <View style={styles.icon}>
        <Icon name="lock" size={22} color={colors.ink} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      gap: 8,
      padding: 24,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
    },
    icon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
      marginBottom: 4,
    },
    title: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold },
    text: { color: c.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  }),
);
