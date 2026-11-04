import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DetailHero, enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { ProgressBar } from '@/components/dashboard/progress-bar';
import { MemberAvatar, RoleChip } from '@/components/team/member-card';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { formatInt, formatPercent } from '@/features/dashboard/format';
import { PERMISSION_LABEL, PERMISSIONS, removeMember, resendAccess } from '@/features/team/team';
import { useTeam } from '@/features/team/use-team';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles, useTheme } from '@/theme';

/**
 * Detalle de una persona del equipo (routes/event_staff.py): datos y rol, escaneos en el evento
 * (y su parte del equipo), permisos y acciones: cambiar rol, reenviar el acceso y quitar.
 */
export default function MemberScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { members: team, eventId } = useTeam();
  const [busy, setBusy] = useState<null | 'resend' | 'remove'>(null);
  useFocusStatusBar('dark');

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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('No se pudo quitar', res.error);
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
      <Stack.Screen options={{ title: member.name }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        {/* Quién es */}
        <Animated.View entering={enter(0)} style={styles.profile}>
          <MemberAvatar member={member} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name} numberOfLines={2}>
              {member.name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {member.email}
            </Text>
            <View style={styles.chips}>
              <RoleChip member={member} />
              {member.isOwner ? <Text style={styles.you}>Sos vos · organizador</Text> : null}
            </View>
          </View>
        </Animated.View>

        {/* Escaneos en el evento (ingresos + retiros) */}
        {scans === 0 ? (
          <Note>Todavía no escaneó en este evento.</Note>
        ) : (
          <DetailHero
            caption="Escaneos en el evento"
            value={scans}
            format={formatInt}
            suffix={teamScans ? `· ${formatPercent(scans / teamScans)} del equipo` : undefined}
            meta="Entradas y pedidos validados con el escáner">
            <ProgressBar
              height={10}
              total={Math.max(1, teamScans)}
              delay={160}
              segments={[{ value: scans, color: colors.chart.ramp[0] }]}
            />
          </DetailHero>
        )}

        {/* Permisos */}
        <Section title={`Permisos · ${member.roleId}`} index={3}>
          {PERMISSIONS.map((p, i) => {
            const has = member.permissions.includes(p);
            return (
              <View key={p} style={[styles.perm, i > 0 && styles.divider]}>
                <Text style={[styles.permText, !has && styles.permOff]}>{PERMISSION_LABEL[p]}</Text>
                <View style={[styles.permIcon, has && styles.permIconOn]}>
                  <Icon
                    name={has ? 'checkmark' : 'close'}
                    size={10}
                    color={has ? '#ffffff' : colors.textMuted}
                  />
                </View>
              </View>
            );
          })}
        </Section>

        {/* Acciones (no sobre uno mismo) */}
        {!member.isOwner ? (
          <Animated.View entering={enter(4)} style={styles.actions}>
            <ActionButton
              label="Cambiar rol"
              onPress={() => {
                Haptics.selectionAsync();
                router.push({ pathname: '/change-role/[id]', params: { id: member.id } });
              }}
            />
            <ActionButton label="Reenviar acceso por email" loading={busy === 'resend'} onPress={resend} />
            <ActionButton
              label="Quitar del equipo"
              danger
              loading={busy === 'remove'}
              onPress={confirmRemove}
            />
          </Animated.View>
        ) : null}
      </ScrollView>
    </>
  );
}

function Section({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Animated.View entering={enter(index)} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </Animated.View>
  );
}

function Note({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <Animated.View entering={enter(1)} style={styles.note}>
      <Text style={styles.noteText}>{children}</Text>
    </Animated.View>
  );
}

function ActionButton({
  label,
  danger,
  loading,
  onPress,
}: {
  label: string;
  danger?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
      {loading ? (
        <ActivityIndicator color="#000000" />
      ) : (
        <Text style={[styles.actionText, danger && styles.actionDanger]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#ffffff' },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: 28 },

    profile: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 },
    name: { color: c.text, fontSize: 22, fontFamily: DisplayFont.bold, letterSpacing: -0.5 },
    email: { color: c.textMuted, fontSize: 13 },
    chips: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    invited: {
      paddingHorizontal: 8,
      height: 22,
      justifyContent: 'center',
      borderRadius: 7,
      backgroundColor: c.brandMuted,
    },
    invitedText: { color: c.brandText, fontSize: 11, fontWeight: '700' },
    you: { color: c.textMuted, fontSize: 12, fontWeight: '600' },

    note: {
      padding: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.canvas,
    },
    noteText: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },

    section: { gap: 8 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    card: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
    },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },
    perm: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    permText: { flex: 1, color: c.text, fontSize: 15 },
    permOff: { color: c.textMuted },
    permIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    permIconOn: { backgroundColor: '#000000' },

    actions: { gap: 10 },
    action: {
      height: 52,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    actionText: { color: '#000000', fontSize: 16, fontFamily: DisplayFont.semibold },
    actionDanger: { color: c.danger },

    missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
    missingText: { color: c.textSecondary, fontSize: 15 },
  }),
);
