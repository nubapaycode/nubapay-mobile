import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enter } from '@/components/dashboard/detail-kit';
import { hiddenNativeSpinner, PulseRefresh } from '@/components/dashboard/pulse-refresh';
import { Icon } from '@/components/dashboard/icon';
import { BlurView } from '@/components/fx/blur';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';

/** Scroll en el que el título grande ya se fue y aparece la barra compacta (y en cuántos px). */
const COMPACT_AT = 34;
const COMPACT_RANGE = 26;
const BAR_H = 44;

/**
 * Página de una pestaña sobre el fondo del tema, con título grande propio (las pestañas no tienen
 * header nativo) y una acción opcional a la derecha del título.
 *
 * Al scrollear el título grande se achica y se desvanece, y arriba aparece una barra de vidrio con
 * el título chico (como el large title de iOS). Con `onRefresh`, tirar hacia abajo actualiza con el
 * pulso de marca (en Android, el indicador nativo).
 */
export function TabPage({
  title,
  subtitle,
  onSubtitlePress,
  right,
  refreshing = false,
  onRefresh,
  children,
}: {
  title: string;
  subtitle?: string;
  /** El subtítulo se vuelve un selector (p. ej. el evento): chip con flechita que llama a esto. */
  onSubtitlePress?: () => void;
  right?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useFocusStatusBar();

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const headStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [0, COMPACT_AT + 10], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: y > 0 ? y * 0.3 : 0 },
        { scale: interpolate(y, [0, COMPACT_AT + 10], [1, 0.94], Extrapolation.CLAMP) },
      ],
    };
  });
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COMPACT_AT, COMPACT_AT + COMPACT_RANGE], [0, 1], Extrapolation.CLAMP),
  }));
  const barTitleStyle = useAnimatedStyle(() => {
    const p = interpolate(scrollY.value, [COMPACT_AT, COMPACT_AT + COMPACT_RANGE], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ translateY: (1 - p) * 8 }] };
  });

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.three }]}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSecondary}
              {...hiddenNativeSpinner}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          ) : undefined
        }>
        <Animated.View entering={enter(0)}>
          <Animated.View style={[styles.head, headStyle]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              {subtitle && onSubtitlePress ? (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSubtitlePress();
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Evento: ${subtitle}. Cambiar evento`}
                  style={({ pressed }) => [styles.picker, pressed && styles.pickerPressed]}>
                  <Text style={styles.pickerText} numberOfLines={1}>
                    {subtitle}
                  </Text>
                  <Icon name="chevronDown" size={10} color={colors.textSecondary} />
                </Pressable>
              ) : subtitle ? (
                <Text style={styles.subtitle}>{subtitle}</Text>
              ) : null}
            </View>
            {right}
          </Animated.View>
        </Animated.View>
        {children}
      </Animated.ScrollView>

      {onRefresh && Platform.OS === 'ios' ? <PulseRefresh scrollY={scrollY} refreshing={refreshing} /> : null}

      {/* Barra compacta: vidrio bajo la barra de estado con el título chico. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.bar, { height: insets.top + BAR_H, paddingTop: insets.top }, barStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {BlurView ? (
          <BlurView
            intensity={40}
            tint={colors.scheme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: BlurView ? colors.surfaceGlass : colors.backgroundTranslucent },
          ]}
        />
        <Animated.Text style={[styles.barTitle, barTitleStyle]} numberOfLines={1}>
          {title}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.four },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, transformOrigin: 'left center' },
    title: { color: c.text, fontSize: 28, fontFamily: DisplayFont.bold, letterSpacing: -0.8 },
    subtitle: { color: c.textMuted, fontSize: 13 },
    picker: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: '100%',
      height: 28,
      marginTop: 4,
      paddingHorizontal: 11,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    pickerPressed: { backgroundColor: c.border },
    pickerText: { flexShrink: 1, color: c.text, fontSize: 13, fontWeight: '600' },
    bar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      overflow: 'hidden',
    },
    barTitle: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
  }),
);
