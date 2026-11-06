import * as Haptics from 'expo-haptics';
import type { NativeStackHeaderProps } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

const BAR_H = 48;

/**
 * Header propio (en lugar de la barra nativa) para las pantallas que se abren con el zoom: la
 * transición nativa de iOS da saltos cuando el destino tiene barra de navegación. Botón de volver
 * redondo a la izquierda y el título centrado; deslizar desde el borde sigue volviendo.
 */
export function DetailHeader({ navigation, options, back }: NativeStackHeaderProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const title = typeof options.title === 'string' ? options.title : '';

  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: insets.top + BAR_H }]}>
      <View style={styles.side}>
        {back ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              navigation.goBack();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={back.title ? `Volver a ${back.title}` : 'Volver'}
            style={({ pressed }) => [styles.back, pressed && { backgroundColor: colors.border }]}>
            <Icon name="chevronLeft" size={16} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.side} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      backgroundColor: c.background,
    },
    side: { width: 48, alignItems: 'flex-start' },
    back: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    title: { flex: 1, textAlign: 'center', color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold },
  }),
);
