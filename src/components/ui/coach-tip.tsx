import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { Icon } from '@/components/dashboard/icon';
import { Radius } from '@/constants/theme';

const INK = '#0b0f17';
const LIME = '#c6ff00';

/**
 * Globo de tip de una sola vez: oscuro, con la parte importante en lima, una flechita hacia lo que
 * explica y una cruz para cerrarlo. No oscurece ni bloquea nada de la pantalla.
 */
export function CoachTip({
  strong,
  text,
  onClose,
  arrow = 'down',
  arrowAlign = 'left',
}: {
  /** Lo que hay que hacer, resaltado ("Mantené apretada"). */
  strong: string;
  /** El resto de la frase. */
  text: string;
  onClose: () => void;
  /** Hacia dónde apunta la flechita: arriba o abajo del globo. */
  arrow?: 'up' | 'down';
  arrowAlign?: 'left' | 'right';
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      exiting={FadeOut.duration(160)}
      style={styles.wrap}
      accessibilityRole="alert"
      accessibilityLabel={`${strong} ${text}`}>
      {arrow === 'up' ? <View style={[styles.arrow, styles.arrowUp, arrowAlign === 'right' ? styles.right : styles.left]} /> : null}
      <View style={styles.bubble}>
        <Text style={styles.text}>
          <Text style={styles.strong}>{strong}</Text> {text}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onClose();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cerrar consejo">
          <Icon name="close" size={12} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>
      {arrow === 'down' ? <View style={[styles.arrow, styles.arrowDown, arrowAlign === 'right' ? styles.right : styles.left]} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: INK,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  text: { flex: 1, color: '#ffffff', fontSize: 14, lineHeight: 19 },
  strong: { color: LIME, fontWeight: '700' },
  arrow: { width: 12, height: 12, backgroundColor: INK, transform: [{ rotate: '45deg' }], position: 'relative', zIndex: -1 },
  arrowDown: { marginTop: -6 },
  arrowUp: { marginBottom: -6 },
  left: { marginLeft: 24 },
  right: { alignSelf: 'flex-end', marginRight: 24 },
});
