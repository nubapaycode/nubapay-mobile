import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { MoodMascot } from '@/components/illustrations/mood-mascot';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { type SetupStep, useEventSetup } from '@/features/setup/event-setup';
import { makeStyles, useTheme } from '@/theme';

import { Icon } from './icon';

/**
 * Lo que se monta en el inicio: calcula los pasos del evento seleccionado y muestra el checklist.
 * Montarlo solo si el rol puede editar el evento (pide el catálogo y el detalle).
 */
export function EventSetupCard({ eventId }: { eventId: string }) {
  const setup = useEventSetup();
  if (!setup.ready || setup.ended) return null;
  // Salteado: no se muestra (completo sí, para festejar si se completó recién).
  if (!setup.pending && setup.doneCount !== setup.total) return null;
  return (
    <SetupChecklist
      eventId={eventId}
      steps={setup.steps}
      doneCount={setup.doneCount}
      total={setup.total}
      canSkip={setup.canSkip}
      onSkip={setup.skip}
      onShare={setup.share}
    />
  );
}

/** Para el punto azul de la pestaña Más: hay checklist pendiente (ni completo ni salteado). */
export function SetupDot({ style }: { style?: object }) {
  const setup = useEventSetup();
  const { colors } = useTheme();
  if (!setup.ready || !setup.pending) return null;
  return (
    <View
      accessibilityLabel="Hay pasos pendientes para preparar tu tienda"
      style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.surface }, style]}
    />
  );
}

/**
 * Checklist del evento (pestaña Más): aro con "2/5", la mascota y los pasos que faltan para vender.
 * Cada paso lleva a donde se resuelve y se tacha solo cuando está hecho. Los opcionales llevan su
 * etiqueta; cuando solo quedan opcionales se puede saltear. Al completarlo en esta sesión, la
 * mascota festeja y la card se puede cerrar; si ya estaba completo, no se muestra.
 */
export function SetupChecklist({
  eventId,
  steps,
  doneCount,
  total,
  canSkip,
  onSkip,
  onShare,
}: {
  eventId: string;
  steps: SetupStep[];
  doneCount: number;
  total: number;
  /** Ya no queda ningún paso obligatorio: se puede saltear lo que falta. */
  canSkip: boolean;
  onSkip: () => void;
  onShare: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const complete = doneCount === total;
  // Solo festeja si lo vio incompleto en esta sesión (un evento que ya vendía no muestra nada).
  const [sawIncomplete, setSawIncomplete] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  // Ajuste de estado durante el render (patrón de React): sin effect ni ref.
  if (!complete && sawIncomplete !== eventId) setSawIncomplete(eventId);

  if (complete && (sawIncomplete !== eventId || dismissed === eventId)) return null;

  if (complete) {
    return (
      <Animated.View entering={FadeInDown.duration(380)} exiting={FadeOut.duration(200)} style={[styles.card, styles.doneCard]}>
        <MoodMascot mood="hot" size={84} onLight={colors.scheme === 'light'} />
        <Text style={styles.title}>¡Tu tienda está lista!</Text>
        <Text style={styles.sub}>Ya podés vender. Compartí el link y mirá las ventas acá.</Text>
        <Pressable
          onPress={() => setDismissed(eventId)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.7 }]}>
          <Text style={styles.doneBtnText}>Listo</Text>
        </Pressable>
      </Animated.View>
    );
  }

  const left = total - doneCount;
  return (
    <Animated.View entering={FadeInDown.duration(380)} layout={LinearTransition.duration(220)} style={styles.card}>
      <View style={styles.head}>
        <ProgressRing done={doneCount} total={total} />
        <View style={styles.headText}>
          <Text style={styles.title}>Prepará tu tienda</Text>
          <Text style={styles.sub}>
            {left === 1 ? 'Te falta 1 paso para vender' : `Te faltan ${left} pasos para vender`}
          </Text>
        </View>
        <MoodMascot mood="waiting" size={46} onLight={colors.scheme === 'light'} />
      </View>
      <View style={styles.steps}>
        {steps.map((s) => (
          <StepRow
            key={s.key}
            step={s}
            onPress={() => {
              if (s.locked || s.done) return;
              Haptics.selectionAsync();
              if (s.href) router.push(s.href);
              else onShare();
            }}
          />
        ))}
      </View>
      {canSkip ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onSkip();
          }}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.skip, pressed && { opacity: 0.6 }]}>
          <Text style={styles.skipText}>Saltar lo que falta</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

function StepRow({ step, onPress }: { step: SetupStep; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const disabled = step.done || step.locked;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, checked: step.done }}
      accessibilityLabel={`${step.label}. ${step.done ? 'Hecho' : step.why}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }, step.locked && { opacity: 0.45 }]}>
      <View style={[styles.check, step.done && { backgroundColor: colors.primary, borderWidth: 0 }]}>
        {step.done ? <Icon name="check" size={11} color="#ffffff" /> : null}
      </View>
      <View style={styles.rowText}>
        <View style={styles.labelLine}>
          <Text style={[styles.rowLabel, step.done && styles.rowDone]}>{step.label}</Text>
          {!step.required && !step.done ? <Text style={styles.optional}>Opcional</Text> : null}
        </View>
        {!step.done ? <Text style={styles.rowWhy}>{step.why}</Text> : null}
      </View>
      {!step.done ? (
        <Icon name={step.locked ? 'lock' : 'chevronRight'} size={12} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const size = 48;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${done} de ${total} pasos listos`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.raised} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${(c * done) / total} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={styles.ringText}>
          {done}/{total}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      boxShadow: c.cardShadow,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 20,
      gap: Spacing.two,
    },
    doneCard: { alignItems: 'center', gap: 6 },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    headText: { flex: 1, gap: 2 },
    title: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold },
    sub: { color: c.textSecondary, fontSize: 13, textAlign: 'auto' },
    ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    ringText: { color: c.text, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
    // Cada paso en su propia mini-card (nunca filas con divisores).
    steps: { gap: 8, marginTop: Spacing.one },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      backgroundColor: c.background,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1, gap: 1 },
    labelLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    optional: {
      color: c.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      backgroundColor: c.raised,
      borderRadius: 6,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    skip: { alignSelf: 'center', paddingVertical: 6, marginTop: 2 },
    skipText: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    rowLabel: { color: c.text, fontSize: 15, fontWeight: '500' },
    rowDone: { color: c.textMuted, textDecorationLine: 'line-through' },
    rowWhy: { color: c.textSecondary, fontSize: 12.5 },
    doneBtn: {
      marginTop: Spacing.two,
      backgroundColor: c.primary,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 28,
    },
    doneBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  }),
);
