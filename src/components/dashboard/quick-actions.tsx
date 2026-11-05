import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEventAccess } from '@/features/access/access';
import { makeStyles, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';

const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };

type Action = { key: string; label: string; icon: IconName; href: Href };

/**
 * Accesos rápidos bajo el hero, a lo que no está en la barra de pestañas (escanear, operaciones
 * y equipo ya tienen la suya). Solo se muestran los que el rol permite.
 */
export function QuickActions() {
  const styles = useStyles();
  const { can, isStaff } = useEventAccess();

  const actions: Action[] = [
    ...(can('products')
      ? [
          { key: 'catalog', label: 'Catálogo', icon: 'cart', href: '/manage/products' },
          { key: 'tickets', label: 'Entradas', icon: 'ticket', href: '/manage/tickets' },
        ] satisfies Action[]
      : []),
    ...(!isStaff || can('payments') || can('storefront')
      ? [{ key: 'payouts', label: 'Cobros', icon: 'bank', href: '/payouts' }] satisfies Action[]
      : []),
    { key: 'events', label: 'Eventos', icon: 'calendar', href: '/events' },
  ];

  return (
    <View style={styles.row}>
      {actions.map((a, i) => (
        <QuickAction key={a.key} action={a} index={i} />
      ))}
    </View>
  );
}

function QuickAction({ action, index }: { action: Action; index: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={styles.slot}
      entering={FadeInDown.delay(60 + index * 45)
        .duration(380)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })}>
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(action.href);
      }}
      onPressIn={() => scale.set(withTiming(0.92, PRESS))}
      onPressOut={() => scale.set(withTiming(1, PRESS))}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={styles.action}>
      <Animated.View style={[styles.circle, pressStyle]}>
        <Icon name={action.icon} size={19} color={colors.text} />
      </Animated.View>
      <Text style={styles.label} numberOfLines={1}>
        {action.label}
      </Text>
    </Pressable>
    </Animated.View>
  );
}

const SIZE = 52;

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-around' },
    slot: { flex: 1 },
    action: { alignItems: 'center', gap: 7 },
    circle: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.hero.glass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hero.glassBorder,
    },
    label: { color: c.textSecondary, fontSize: 12, fontWeight: '500' },
  }),
);
