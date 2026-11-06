import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { MoodMascot } from '@/components/illustrations/mood-mascot';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { makeStyles, useTheme } from '@/theme';

import { Icon } from './icon';

/** Con el evento terminado: invita a ver el resumen tipo historia (`/event-recap/[id]`). */
export function RecapCard({ eventId, eventName, soldOut }: { eventId: string; eventName: string; soldOut: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(80).duration(400)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver el resumen de ${eventName}`}
        onPress={() => {
          Haptics.selectionAsync();
          router.push({ pathname: '/event-recap/[id]', params: { id: eventId } });
        }}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
        <View style={styles.texts}>
          <Text style={styles.eyebrow}>Terminó el evento</Text>
          <Text style={styles.title} numberOfLines={2}>
            Así fue {eventName}
          </Text>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Ver el resumen</Text>
            <Icon name="chevronRight" size={12} color={colors.hero.accent} />
          </View>
        </View>
        <MoodMascot mood={soldOut ? 'soldout' : 'hot'} size={72} onLight={colors.scheme === 'light'} />
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      backgroundColor: c.hero.glass,
      boxShadow: c.cardShadow,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hero.glassBorder,
      padding: Spacing.three,
    },
    texts: { flex: 1, gap: 4 },
    eyebrow: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    title: { color: c.text, fontSize: 18, fontFamily: DisplayFont.semibold },
    cta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    ctaText: { color: c.hero.accent, fontSize: 14, fontWeight: '600' },
  }),
);
