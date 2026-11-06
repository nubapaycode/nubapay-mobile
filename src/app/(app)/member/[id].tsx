import * as Haptics from 'expo-haptics';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon, type IconName } from '@/components/dashboard/icon';
import { ProgressBar } from '@/components/dashboard/progress-bar';
import { RollingNumber } from '@/components/dashboard/rolling-number';
import { MemberAvatar, PERMISSION_ICON, RoleChip } from '@/components/team/member-card';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatInt, formatPercent } from '@/features/dashboard/format';
import { PERMISSION_LABEL, PERMISSIONS, removeMember, resendAccess } from '@/features/team/team';
import { useTeam } from '@/features/team/use-team';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';
import { toast } from '@/components/ui/toast';

/**
 * Detalle de una persona del equipo (routes/event_staff.py), mismo lenguaje que el detalle de
 * pedido: cabecera centrada, acciones rápidas (email, cambiar rol, reenviar acceso), escaneos con
 * su puesto en el equipo, permisos en grilla y quitar del equipo.
 */
export default function MemberScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { members: team, eventId } = useTeam();
  const [busy, setBusy] = useState<null | 'resend' | 'remove'>(null);
  useFocusStatusBar();

  const member = team?.find((m) => m.id === id);
  if (!member || !team) {
    return (
      <View style={styles.missing}>
        {team ? (
          <Text style={styles.missingText}>No encontramos a esta persona.</Text>
        ) : (
          <ActivityIndicator color={colors.textMuted} />
        )}
      </View>
    );
  }

  const teamScans = team.reduce((a, m) => a + m.stats.scans, 0);
  const { scans } = member.stats;
  const rank =
    scans > 0 ? [...team].sort((x, y) => y.stats.scans - x.stats.scans).findIndex((m) => m.id === member.id) + 1 : 0;

  const confirmRemove = () =>
    Alert.alert('Quitar del equipo', `${member.name} deja de tener acceso al evento.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          if (!eventId) return;
          setBusy('remove');
          const res = await removeMember(eventId, member);
          setBusy(null);
          if (!res.ok) {
            toast.error('No se pudo quitar', res.error);
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.back();
        },
      },
    ]);

  const resend = async () => {
    if (!eventId) return;
    setBusy('resend');
    const res = await resendAccess(eventId, member);
    setBusy(null);
    Haptics.notificationAsync(
      res.ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );
    Alert.alert(
      res.ok ? 'Acceso reenviado' : 'No se pudo reenviar',
      res.ok ? `Le mandamos a ${member.email} el email para ingresar.` : res.error,
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        {/* Quién es: cabecera centrada como en el detalle de pedido. */}
        {/* Destino del zoom desde la card: la card se transforma en esta cabecera (iOS 18+). */}
        <Link.AppleZoomTarget>
          <Animated.View entering={enter(0)} style={styles.hero}>
            <MemberAvatar member={member} size={72} />
            <Text style={styles.name} numberOfLines={2}>
              {member.name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {member.email}
            </Text>
            <View style={styles.chips}>
              <RoleChip member={member} />
              {member.isOwner ? (
                <View style={styles.you}>
                  <Text style={styles.youText}>Sos vos · organizador</Text>
                </View>
              ) : null}
            </View>
          </Animated.View>
        </Link.AppleZoomTarget>

        {/* Acciones rápidas (estilo Revolut): círculos con ícono y etiqueta. */}
        <Animated.View entering={enter(1)} style={styles.quick}>
          <QuickAction
            icon="mail"
            label="Email"
            onPress={() => Linking.openURL(`mailto:${member.email}`)}
          />
          {!member.isOwner ? (
            <>
              <QuickAction
                icon="pencil"
                label="Cambiar rol"
                onPress={() => router.push({ pathname: '/change-role/[id]', params: { id: member.id } })}
              />
              <QuickAction
                icon="undo"
                label="Reenviar acceso"
                loading={busy === 'resend'}
                onPress={resend}
              />
            </>
          ) : null}
        </Animated.View>

        {/* Escaneos en el evento (ingresos + retiros) */}
        <Section title="Actividad" index={2}>
          {scans === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <View style={styles.emptyIcon}>
                <Icon name="qr" size={18} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyText}>Todavía no escaneó en este evento.</Text>
            </View>
          ) : (
            <View style={[styles.card, styles.stat]}>
              <View style={styles.statHead}>
                <Text style={styles.statCaption}>Escaneos en el evento</Text>
                {rank > 0 && team.length > 1 ? (
                  <View style={[styles.rank, rank === 1 && styles.rankFirst]}>
                    <Text style={[styles.rankText, rank === 1 && styles.rankTextFirst]}>
                      N.º {rank} del equipo
                    </Text>
                  </View>
                ) : null}
              </View>
              <RollingNumber value={scans} format={formatInt} style={styles.statValue} />
              <ProgressBar
                height={8}
                total={Math.max(1, teamScans)}
                delay={160}
                segments={[{ value: scans, color: colors.chart.ramp[0] }]}
              />
              <Text style={styles.statMeta}>
                {teamScans ? `${formatPercent(scans / teamScans)} de los escaneos del equipo` : ''}
                {' · '}entradas y pedidos validados
              </Text>
            </View>
          )}
        </Section>

        {/* Permisos: grilla, cada uno en su card. */}
        <Section
          title="Permisos"
          meta={`${member.permissions.length} de ${PERMISSIONS.length}`}
          index={3}>
          <View style={styles.grid}>
            {PERMISSIONS.map((p) => {
              const has = member.permissions.includes(p);
              return (
                <View key={p} style={[styles.card, styles.perm, !has && styles.permOff]}>
                  <View style={styles.permTop}>
                    <View style={[styles.permIcon, has && styles.permIconOn]}>
                      <Icon
                        name={PERMISSION_ICON[p]}
                        size={14}
                        color={has ? colors.onInk : colors.textMuted}
                      />
                    </View>
                    <Icon
                      name={has ? 'check' : 'minus'}
                      size={14}
                      color={has ? colors.success : colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.permText, !has && styles.permTextOff]} numberOfLines={2}>
                    {PERMISSION_LABEL[p]}
                  </Text>
                </View>
              );
            })}
          </View>
        </Section>

        {!member.isOwner ? (
          <Animated.View entering={enter(4)}>
            <Pressable
              accessibilityRole="button"
              disabled={busy === 'remove'}
              onPress={confirmRemove}
              style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
              {busy === 'remove' ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <>
                  <Icon name="trash" size={16} color={colors.danger} />
                  <Text style={styles.removeText}>Quitar del equipo</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        ) : null}
      </ScrollView>
    </>
  );
}

function Section({
  title,
  meta,
  index,
  children,
}: {
  title: string;
  meta?: string;
  index: number;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <Animated.View entering={enter(index)} style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>
      {children}
    </Animated.View>
  );
}

function QuickAction({
  icon,
  label,
  loading,
  onPress,
}: {
  icon: IconName;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={loading}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}>
      <View style={styles.quickCircle}>
        {loading ? (
          <ActivityIndicator color={colors.textSecondary} />
        ) : (
          <Icon name={icon} size={18} color={colors.text} />
        )}
      </View>
      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: 24 },
    pressed: { opacity: 0.7 },
    card: {
      backgroundColor: c.surface,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },

    hero: { alignItems: 'center', gap: 4 },
    name: {
      color: c.text,
      fontSize: 24,
      fontFamily: DisplayFont.bold,
      letterSpacing: -0.5,
      textAlign: 'center',
      marginTop: 10,
    },
    email: { color: c.textMuted, fontSize: 13 },
    chips: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    you: {
      paddingHorizontal: 9,
      height: 24,
      justifyContent: 'center',
      borderRadius: Radius.pill,
      backgroundColor: c.brandMuted,
    },
    youText: { color: c.brandText, fontSize: 12, fontWeight: '700' },

    quick: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
    quickItem: { alignItems: 'center', gap: 6, width: 84 },
    quickCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    quickLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },

    section: { gap: 8 },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    sectionMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },

    stat: { padding: Spacing.three, gap: 10 },
    statHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statCaption: { color: c.textSecondary, fontSize: 14, fontWeight: '500' },
    statValue: {
      color: c.text,
      fontSize: 34,
      lineHeight: 40,
      fontFamily: DisplayFont.bold,
      letterSpacing: -1,
    },
    statMeta: { color: c.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
    rank: {
      paddingHorizontal: 8,
      height: 22,
      justifyContent: 'center',
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    rankFirst: { backgroundColor: c.ink },
    rankText: { color: c.textSecondary, fontSize: 11, fontWeight: '700' },
    rankTextFirst: { color: c.onInk },
    emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    emptyIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    emptyText: { flex: 1, color: c.textSecondary, fontSize: 14 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    perm: { width: '48.8%', flexGrow: 1, padding: 12, gap: 10 },
    permOff: { boxShadow: 'none', backgroundColor: c.background },
    permTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    permIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    permIconOn: { backgroundColor: c.ink },
    permText: { color: c.text, fontSize: 14, fontWeight: '600' },
    permTextOff: { color: c.textMuted, fontWeight: '500' },

    remove: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.dangerMuted,
    },
    removeText: { color: c.danger, fontSize: 15, fontFamily: DisplayFont.semibold },

    missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    missingText: { color: c.textSecondary, fontSize: 15 },
  }),
);
