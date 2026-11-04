import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
import { makeStyles } from '@/theme';

type Option<T extends string> = { value: T; label: string };

/** Control segmentado con indicador que se desliza suave. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const segW = width ? (width - 6) / options.length : 0;
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const indicator = useAnimatedStyle(() => ({
    width: segW,
    transform: [
      { translateX: withTiming(index * segW, { duration: 220, easing: Easing.out(Easing.cubic) }) },
    ],
  }));

  return (
    <View
      style={styles.wrap}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist">
      {segW > 0 && <Animated.View style={[styles.indicator, indicator]} />}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.option}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync();
              onChange(o.value);
            }}>
            <Text style={[styles.label, selected && styles.labelSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    indicator: {
      position: 'absolute',
      top: 3,
      bottom: 3,
      left: 3,
      borderRadius: Radius.pill,
      backgroundColor: c.surface,
      borderWidth: c.scheme === 'dark' ? StyleSheet.hairlineWidth : 0,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOpacity: c.scheme === 'light' ? 0.08 : 0,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    option: { flex: 1, height: 32, alignItems: 'center', justifyContent: 'center' },
    label: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    labelSelected: { color: c.text },
  }),
);
