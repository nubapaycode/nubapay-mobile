import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatInt } from '@/features/dashboard/format';
import { makeStyles, useTheme } from '@/theme';

import { AnimatedNumber } from './animated-number';
import { RollingNumber } from './rolling-number';

/**
 * Piezas compartidas de las páginas de detalle (mismo lenguaje que el home): cifra protagonista,
 * desglose clave–valor, métricas en fila y secciones con lista de borde fino.
 */

/** Entrada: fundido puro y lento (1200 ms, curva suave), sin desplazamiento ni resorte. */
export const FADE_MS = 1200;
export const FADE_EASING = Easing.inOut(Easing.quad);

export const enter = (i: number) =>
  FadeIn.delay(60 + i * 70).duration(FADE_MS).easing(FADE_EASING);

export const enterRow = (i: number) =>
  FadeIn.delay(220 + i * 50).duration(FADE_MS).easing(FADE_EASING);

export function DetailHero({
  caption,
  value,
  format,
  suffix,
  meta,
  children,
}: {
  caption: string;
  value: number;
  format: (n: number) => string;
  /** Texto chico al lado de la cifra, p. ej. "/ 1.750 de aforo". */
  suffix?: string;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <Animated.View entering={enter(0)} style={styles.hero}>
      <Text style={styles.caption}>{caption}</Text>
      <View style={styles.heroRow}>
        <RollingNumber value={value} format={format} style={styles.heroValue} />
        {suffix ? <Text style={styles.heroSuffix}> {suffix}</Text> : null}
      </View>
      {meta ? <Text style={styles.heroMeta}>{meta}</Text> : null}
      {children ? <View style={styles.heroExtra}>{children}</View> : null}
    </Animated.View>
  );
}

export type BreakdownItem = {
  color: string;
  label: string;
  value: number;
  format?: (n: number) => string;
  /** Pendiente a atender: lima de marca (texto en `brandText` para que se lea sobre blanco). */
  tone?: 'attention';
};

/** Desglose clave–valor bajo una barra (estilo saldo de Stripe). */
export function Breakdown({ items }: { items: BreakdownItem[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View>
      {items.map((b, i) => (
        <View key={b.label} style={[styles.kv, i > 0 && styles.kvBorder]}>
          <Swatch color={b.color} />
          <Text style={styles.kvLabel}>{b.label}</Text>
          <AnimatedNumber
            value={b.value}
            format={b.format ?? formatInt}
            style={[styles.kvValue, b.tone === 'attention' && { color: colors.brandText }]}
          />
        </View>
      ))}
    </View>
  );
}

/** 3 métricas en fila entre líneas finas. */
export function StatsRow({
  stats,
  index = 1,
}: {
  stats: { label: string; value: string; tone?: 'attention' }[];
  index?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Animated.View entering={enter(index)} style={styles.stats}>
      {stats.map((s, i) => (
        <View key={s.label} style={[styles.stat, i > 0 && styles.statDivider]}>
          <Text style={styles.statLabel} numberOfLines={1}>
            {s.label}
          </Text>
          <Text
            style={[styles.statValue, s.tone === 'attention' && { color: colors.brandText }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {s.value}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
}

/** Título de sección + lista en tarjeta de borde fino. `footer` va debajo de la tarjeta. */
export function DetailSection({
  title,
  meta,
  index,
  footer,
  children,
}: {
  title: string;
  meta?: string;
  index: number;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <Animated.View entering={enter(index)} style={{ gap: 10 }}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.muted}>{meta}</Text> : null}
      </View>
      <View style={styles.list}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Animated.View>
  );
}

/** Fila de lista con entrada escalonada y separador fino. */
export function ListRow({ index, children }: { index: number; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Animated.View entering={enterRow(index)} style={[styles.row, index > 0 && styles.rowBorder]}>
      {children}
    </Animated.View>
  );
}

export function Swatch({ color }: { color: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 2.5, backgroundColor: color }} />;
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  const styles = useStyles();
  return (
    <View style={styles.legend}>
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          <Swatch color={it.color} />
          <Text style={styles.muted}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function Badge({ label, tone }: { label: string; tone?: 'strong' | 'attention' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const attention = tone === 'attention';
  const bg = tone === 'strong' ? colors.text : attention ? colors.brandMuted : colors.raised;
  const fg = tone === 'strong' ? colors.surface : attention ? colors.brandText : colors.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {attention ? <View style={[styles.badgeDot, { backgroundColor: colors.brand }]} /> : null}
      <Text style={[styles.badgeText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function DetailNote({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.note}>{children}</Text>;
}

/** Estilos de texto de fila, para que cada detalle arme sus filas con la misma tipografía. */
export const useRowStyles = makeStyles((c) =>
  StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold, flexShrink: 1 },
    value: {
      marginLeft: 'auto',
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    valueMuted: { color: c.textMuted, fontWeight: '400' },
    bottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    meta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  }),
);

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    hero: { gap: 6 },
    caption: { color: c.textSecondary, fontSize: 14, fontWeight: '500' },
    heroRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' },
    heroValue: {
      color: c.text,
      fontSize: 38,
      lineHeight: 44,
      fontFamily: DisplayFont.bold,
      letterSpacing: -1.2,
    },
    heroSuffix: {
      color: c.textMuted,
      fontSize: 15,
      fontWeight: '500',
      marginBottom: 7,
      fontVariant: ['tabular-nums'],
    },
    heroMeta: { color: c.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
    heroExtra: { gap: 14, marginTop: Spacing.three },

    kv: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
    kvBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },
    kvLabel: { flex: 1, color: c.textSecondary, fontSize: 14 },
    kvValue: { color: c.text, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },

    stats: {
      flexDirection: 'row',
      paddingVertical: Spacing.three,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    stat: { flex: 1, gap: 4 },
    statDivider: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: c.border,
      paddingLeft: 14,
    },
    statLabel: { color: c.textSecondary, fontSize: 12 },
    statValue: { color: c.text, fontSize: 20, fontFamily: DisplayFont.bold, letterSpacing: -0.4 },

    sectionHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    sectionTitle: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold },
    muted: { color: c.textMuted, fontSize: 12 },
    list: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: Spacing.three,
    },
    footer: { paddingHorizontal: 4 },
    row: { gap: 10, paddingVertical: 14 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },

    legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },

    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      height: 20,
      borderRadius: 6,
    },
    badgeDot: { width: 5, height: 5, borderRadius: 2.5 },
    badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

    note: { color: c.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: Spacing.three },
  }),
);
