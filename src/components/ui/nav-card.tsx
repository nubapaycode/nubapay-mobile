import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

/**
 * Botón de navegación en tarjeta propia: ícono en cuadradito gris, título, subtítulo y chevron
 * (o flecha de sitio externo). `right` reemplaza el chevron (p. ej. un estado).
 */
export function NavCard({
  icon,
  title,
  subtitle,
  external,
  right,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  /** Abre un sitio externo: flecha de enlace externo en lugar del chevron. */
  external?: boolean;
  right?: ReactNode;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={`${title}. ${subtitle}${external ? '. Abre el navegador' : ''}`}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.canvas }]}>
      <View style={styles.icon}>
        <Icon name={icon} size={17} color="#000000" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {right ??
        (external ? (
          <Icon name="external" size={13} color={colors.textMuted} />
        ) : (
          <Icon name="chevronRight" size={12} color={colors.textMuted} />
        ))}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 15,
      paddingLeft: 14,
      paddingRight: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    title: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    subtitle: { color: c.textMuted, fontSize: 12 },
  }),
);
