import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/dashboard/icon';
import { Aurora } from '@/components/fx/aurora';
import { DisplayFont, Spacing } from '@/constants/theme';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';

type Props = {
  /** Botón redondo arriba a la izquierda (volver). */
  onBack?: () => void;
  /** Botón redondo arriba a la derecha (cerrar). */
  onClose?: () => void;
  children: ReactNode;
  /** Acciones abajo: suben junto con el teclado. */
  footer?: ReactNode;
};

/** Esqueleto de las pantallas de acceso: fondo de luces tenue, barra de arriba, contenido y acciones. */
export function AuthScreen({ onBack, onClose, children, footer }: Props) {
  const styles = useStyles();
  useFocusStatusBar();

  return (
    <View style={styles.root}>
      <Aurora strength={0.6} lime={0} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.bar, !onBack && onClose && styles.barEnd]}>
            {onBack ? <RoundButton icon="back" label="Volver" onPress={onBack} /> : null}
            {onClose ? <RoundButton icon="close" label="Cerrar" onPress={onClose} /> : null}
          </View>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            bounces={false}>
            <Animated.View entering={rise(80)} style={styles.body}>
              {children}
            </Animated.View>
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** Título grande + bajada de cada paso. */
export function AuthTitle({ title, subtitle, center }: { title: string; subtitle?: ReactNode; center?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.titleBlock, center && styles.center]}>
      <Text style={[styles.title, center && styles.textCenter]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, center && styles.textCenter]}>{subtitle}</Text> : null}
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: 'back' | 'close';
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      // Sin pasar el evento: `router.back` lo tomaría como opciones de transición.
      onPress={() => onPress()}
      style={({ pressed }) => [styles.round, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={icon === 'back' ? 18 : 15} color={colors.text} />
    </Pressable>
  );
}

const rise = (delay: number) =>
  FadeInDown.delay(delay)
    .duration(600)
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] });

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    safe: { flex: 1 },
    flex: { flex: 1 },
    bar: {
      height: 60,
      paddingHorizontal: Spacing.four,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    barEnd: { justifyContent: 'flex-end' },
    round: {
      width: 44,
      height: 44,
      borderRadius: 999,
      backgroundColor: c.hero.glass,
      borderWidth: 1,
      borderColor: c.hero.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { flexGrow: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
    body: { gap: 28 },
    footer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two },
    titleBlock: { gap: 10 },
    center: { alignItems: 'center' },
    title: { color: c.text, fontSize: 34, lineHeight: 37, fontFamily: DisplayFont.bold, letterSpacing: -0.8 },
    subtitle: { color: c.textSecondary, fontSize: 16, lineHeight: 23 },
    textCenter: { textAlign: 'center' },
  }),
);
