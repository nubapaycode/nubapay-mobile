import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoodMascot, type MascotPose } from '@/components/illustrations/mood-mascot';
import { DisplayFont, Spacing } from '@/constants/theme';
import { markOnboardingSeen } from '@/features/onboarding/onboarding-seen';
import { useAuth } from '@/providers/auth-provider';

const INK = '#080b11';
const LIME = '#c6ff00';
const BLUE = '#0069ff';
const WHITE = '#ffffff';

type Page = { bg: string; fg: string; pose: MascotPose; title: string; text: string; cta: string; ctaBg: string; ctaFg: string };

const PAGES: Page[] = [
  {
    bg: INK,
    fg: WHITE,
    pose: 'selling',
    title: '¡Hola! Bienvenido a Nubapay',
    text: 'Te ayudo a vender las entradas y la barra de tu evento.',
    cta: 'Siguiente',
    ctaBg: LIME,
    ctaFg: INK,
  },
  {
    bg: BLUE,
    fg: WHITE,
    pose: 'hot',
    title: 'Vendé desde un link',
    text: 'Tus clientes compran y pagan desde el celular. Vos ves cada venta al instante.',
    cta: 'Siguiente',
    ctaBg: WHITE,
    ctaFg: BLUE,
  },
  {
    bg: LIME,
    fg: INK,
    pose: 'waiting',
    title: 'Armemos tu primer evento',
    text: 'Te lleva dos minutos. Después te guío paso a paso hasta que tu tienda esté lista.',
    cta: 'Crear mi primer evento',
    ctaBg: INK,
    ctaFg: WHITE,
  },
];

/**
 * Bienvenida para una cuenta nueva (se abre sola una vez, ver `onboarding-seen`): tres páginas que
 * se deslizan, con la mascota, y termina creando el primer evento. "Saltar" la cierra.
 */
export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const page = PAGES[index];
  const last = index === PAGES.length - 1;

  // Vista (aunque se salte): no vuelve a abrirse sola.
  useEffect(() => {
    if (user?.id) markOnboardingSeen(user.id);
  }, [user?.id]);

  const goTo = (i: number) => {
    Haptics.selectionAsync();
    scroller.current?.scrollTo({ x: i * width, animated: !reduceMotion });
    setIndex(i);
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const next = () => {
    if (!last) return goTo(index + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/new-event');
  };

  return (
    <View style={[styles.screen, { backgroundColor: page.bg }]}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {PAGES.map((p, i) => (
          <View
            key={p.title}
            style={[styles.page, { width, backgroundColor: p.bg, paddingTop: insets.top + 80, paddingBottom: insets.bottom + 150 }]}>
            {/* Sobre lima la mascota (que es lima) se perdería: va sobre un círculo oscuro. */}
            <View style={p.bg === LIME ? styles.badge : undefined}>
              <MoodMascot mood={p.pose} size={p.bg === LIME ? 150 : 180} />
            </View>
            {i === index ? (
              <Animated.View
                key={`text-${i}`}
                entering={reduceMotion ? undefined : FadeInDown.duration(380)}
                style={styles.texts}>
                <Text style={[styles.title, { color: p.fg }]}>{p.title}</Text>
                <Text style={[styles.text, { color: p.fg }]}>{p.text}</Text>
              </Animated.View>
            ) : (
              <View style={styles.texts}>
                <Text style={[styles.title, { color: p.fg }]}>{p.title}</Text>
                <Text style={[styles.text, { color: p.fg }]}>{p.text}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <Pressable
        onPress={close}
        hitSlop={12}
        accessibilityRole="button"
        style={[styles.skip, { top: insets.top + 12 }]}>
        <Text style={[styles.skipText, { color: page.fg }]}>Saltar</Text>
      </Pressable>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.dots} accessibilityLabel={`Paso ${index + 1} de ${PAGES.length}`}>
          {PAGES.map((p, i) => (
            <Pressable key={p.title} onPress={() => goTo(i)} hitSlop={6}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: page.fg, opacity: i === index ? 1 : 0.3, width: i === index ? 18 : 7 },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={next}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, { backgroundColor: page.ctaBg }, pressed && { opacity: 0.85 }]}>
          <Text style={[styles.ctaText, { color: page.ctaFg }]}>{page.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four, gap: Spacing.four },
  badge: { backgroundColor: INK, borderRadius: 999, padding: 22 },
  texts: { alignItems: 'center', gap: Spacing.two },
  title: { fontFamily: DisplayFont.extrabold, fontSize: 32, lineHeight: 36, textAlign: 'center' },
  text: { fontSize: 17, lineHeight: 24, textAlign: 'center', opacity: 0.85, maxWidth: 320 },
  skip: { position: 'absolute', right: Spacing.four, padding: 4 },
  skipText: { fontSize: 15, fontWeight: '600', opacity: 0.8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.four, gap: Spacing.four },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { height: 7, borderRadius: 4 },
  cta: { borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 17, fontWeight: '700' },
});
