import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { formatInt, initials } from '@/features/dashboard/format';
import {
  type Member,
  OWNER_ROLE,
  type PermissionId,
  PERMISSION_SHORT,
  PERMISSIONS,
} from '@/features/team/team';
import { makeStyles, useTheme } from '@/theme';

const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };
const MAX_PERMS = 3;

/** Ícono de cada permiso (cards del equipo y grilla del detalle). */
export const PERMISSION_ICON: Record<PermissionId, IconName> = {
  dashboard: 'up',
  products: 'tag',
  scanner: 'qr',
  orders: 'receipt',
  pickup_points: 'store',
  payments: 'card',
};

export const isAdmin = (m: Member) => m.isOwner || m.roleId === OWNER_ROLE;

/** Avatar con iniciales (administración va en tinta fuerte). */
export function MemberAvatar({ member, size = 44 }: { member: Member; size?: number }) {
  const styles = useStyles();
  const admin = isAdmin(member);
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        admin && styles.avatarAdmin,
      ]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }, admin && styles.avatarTextAdmin]}>
        {initials(member.name) || '?'}
      </Text>
    </View>
  );
}

export function RoleChip({ member }: { member: Member }) {
  const styles = useStyles();
  const admin = isAdmin(member);
  return (
    <View style={[styles.role, admin && styles.roleAdmin]}>
      <Text style={[styles.roleText, admin && styles.roleTextAdmin]}>{member.roleId}</Text>
    </View>
  );
}

/**
 * Persona del equipo en su propia card: avatar, nombre y email; escaneos a la derecha; abajo sus
 * permisos como chips con ícono. El rol va en el título del grupo.
 */
export function MemberCard({ member, onPress }: { member: Member; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const perms = member.permissions;
  const all = perms.length === PERMISSIONS.length;
  const shown = all ? [] : perms.slice(0, MAX_PERMS);
  const extra = all ? 0 : perms.length - shown.length;
  const { scans } = member.stats;

  return (
    <Animated.View style={press}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPress();
        }}
        onPressIn={() => scale.set(withTiming(0.98, PRESS))}
        onPressOut={() => scale.set(withTiming(1, PRESS))}
        accessibilityRole="button"
        accessibilityLabel={`${member.name}, ${member.roleId}${
          scans ? `, ${scans} escaneos` : ''
        }. Ver detalle`}
        style={styles.card}>
        <View style={styles.top}>
          <MemberAvatar member={member} />
          <View style={styles.grow}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {member.name}
              </Text>
              {member.isOwner ? (
                <View style={styles.you}>
                  <Text style={styles.youText}>Vos</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.email} numberOfLines={1}>
              {member.email}
            </Text>
          </View>
          {scans > 0 ? (
            <View style={styles.scans}>
              <Text style={styles.scansValue}>{formatInt(scans)}</Text>
              <Text style={styles.scansLabel}>escaneos</Text>
            </View>
          ) : (
            <Icon name="chevronRight" size={12} color={colors.textMuted} />
          )}
        </View>

        <View style={styles.perms}>
          {all ? (
            <View style={[styles.perm, styles.permAll]}>
              <Icon name="checkmark" size={10} color={colors.onInk} />
              <Text style={[styles.permText, { color: colors.onInk }]}>Todos los permisos</Text>
            </View>
          ) : perms.length === 0 ? (
            <View style={styles.perm}>
              <Text style={styles.permText}>Sin permisos</Text>
            </View>
          ) : (
            <>
              {shown.map((p) => (
                <View key={p} style={styles.perm}>
                  <Icon name={PERMISSION_ICON[p]} size={10} color={colors.textSecondary} />
                  <Text style={styles.permText}>{PERMISSION_SHORT[p]}</Text>
                </View>
              ))}
              {extra > 0 ? (
                <View style={styles.perm}>
                  <Text style={styles.permText}>+{extra}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      gap: 12,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.surface,
      boxShadow: c.cardShadowSubtle,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    grow: { flex: 1, gap: 2 },
    avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.raised },
    avatarAdmin: { backgroundColor: c.ink },
    avatarText: { color: c.textSecondary, fontWeight: '700' },
    avatarTextAdmin: { color: c.onInk },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { flexShrink: 1, color: c.text, fontSize: 15, fontFamily: DisplayFont.semibold },
    email: { color: c.textMuted, fontSize: 12 },
    you: {
      paddingHorizontal: 6,
      height: 18,
      justifyContent: 'center',
      borderRadius: Radius.pill,
      backgroundColor: c.brandMuted,
    },
    youText: { color: c.brandText, fontSize: 10, fontWeight: '700' },
    scans: { alignItems: 'flex-end' },
    scansValue: { color: c.text, fontSize: 16, fontFamily: DisplayFont.bold, fontVariant: ['tabular-nums'] },
    scansLabel: { color: c.textMuted, fontSize: 11 },

    perms: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    perm: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    permAll: { backgroundColor: c.ink },
    permText: { color: c.textSecondary, fontSize: 11, fontWeight: '600' },

    role: {
      paddingHorizontal: 9,
      height: 24,
      justifyContent: 'center',
      borderRadius: Radius.pill,
      backgroundColor: c.raised,
    },
    roleAdmin: { backgroundColor: c.ink },
    roleText: { color: c.text, fontSize: 12, fontWeight: '700' },
    roleTextAdmin: { color: c.onInk },
  }),
);
