import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/dashboard/icon';
import { Radius } from '@/constants/theme';
import { type AppearancePreference, dark, light, makeStyles, type Palette, useTheme } from '@/theme';

const OPTIONS: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

const EASE = { duration: 220, easing: Easing.out(Easing.cubic) };

/**
 * Elegir apariencia con una mini vista del inicio en cada modo (Automático: mitad clara, mitad
 * oscura). Cada opción es su propia card; la elegida lleva borde de tinta y un check.
 */
export function AppearancePicker({
  value,
  onChange,
}: {
  value: AppearancePreference;
  onChange: (v: AppearancePreference) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {OPTIONS.map((o) => (
        <Option
          key={o.value}
          value={o.value}
          label={o.label}
          selected={o.value === value}
          onPress={() => {
            if (o.value === value) return;
            Haptics.selectionAsync();
            onChange(o.value);
          }}
        />
      ))}
    </View>
  );
}

function Option({
  value,
  label,
  selected,
  onPress,
}: {
  value: AppearancePreference;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const on = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, EASE));
  }, [on, selected]);

  const frame = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [colors.border, colors.ink]),
    transform: [{ scale: press.value }],
  }));
  const check = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scale: 0.6 + on.value * 0.4 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => press.set(withTiming(0.96, { duration: 110 }))}
      onPressOut={() => press.set(withTiming(1, { duration: 140 }))}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Apariencia ${label}`}
      style={styles.option}>
      <Animated.View style={[styles.card, frame]}>
        <View style={styles.preview}>
          {value === 'system' ? (
            <>
              <MiniScreen palette={light} />
              {/* La mitad derecha muestra la misma pantalla en oscuro, recortada. */}
              <View style={styles.rightHalf}>
                <View style={styles.rightFull}>
                  <MiniScreen palette={dark} />
                </View>
              </View>
            </>
          ) : (
            <MiniScreen palette={value === 'dark' ? dark : light} />
          )}
        </View>
        <Animated.View style={[styles.check, check]}>
          <Icon name="checkmark" size={10} color={colors.onInk} />
        </Animated.View>
      </Animated.View>
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
    </Pressable>
  );
}

/** Inicio en miniatura: degradé del hero, la cifra, la curva, los accesos y una card. */
function MiniScreen({ palette: p }: { palette: Palette }) {
  return (
    <View style={[mini.screen, { backgroundColor: p.background }]}>
      <View style={[mini.hero, { backgroundColor: p.hero.top }]}>
        <View style={[mini.pill, { backgroundColor: p.hero.glass, borderColor: p.hero.glassBorder }]} />
        <View style={[mini.amount, { backgroundColor: p.text }]} />
        <View style={[mini.line, { backgroundColor: p.hero.line }]} />
      </View>
      <View style={mini.dots}>
        <View style={[mini.dot, { backgroundColor: p.hero.accent }]} />
        <View style={[mini.dot, { backgroundColor: p.raised }]} />
        <View style={[mini.dot, { backgroundColor: p.raised }]} />
      </View>
      <View style={[mini.card, { backgroundColor: p.surface, borderColor: p.border }]}>
        <View style={[mini.bar, { backgroundColor: p.textMuted, width: '60%' }]} />
        <View style={[mini.bar, { backgroundColor: p.raised, width: '85%' }]} />
      </View>
    </View>
  );
}

const mini = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 6, gap: 6 },
  hero: { height: 54, alignItems: 'center', paddingTop: 8, gap: 6 },
  pill: { width: 30, height: 7, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth },
  amount: { width: 34, height: 8, borderRadius: 3 },
  line: { width: '82%', height: 2, borderRadius: 1, transform: [{ rotate: '-8deg' }], marginTop: 4 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 11, height: 11, borderRadius: 6 },
  card: {
    marginHorizontal: 7,
    padding: 6,
    gap: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bar: { height: 4, borderRadius: 2 },
});

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 10 },
    option: { flex: 1, alignItems: 'center', gap: 8 },
    card: {
      width: '100%',
      padding: 6,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      borderWidth: 2,
      backgroundColor: c.raised,
    },
    preview: {
      height: 118,
      borderRadius: 10,
      borderCurve: 'continuous',
      overflow: 'hidden',
      backgroundColor: c.raised,
    },
    rightHalf: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', overflow: 'hidden' },
    rightFull: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '200%' },
    check: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.ink,
      borderWidth: 2,
      borderColor: c.raised,
    },
    label: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },
    labelOn: { color: c.text, fontWeight: '700' },
  }),
);
