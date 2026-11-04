import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius } from '@/constants/theme';
import { initials } from '@/features/dashboard/format';
import { type Member, OWNER_ROLE, PERMISSION_SHORT, PERMISSIONS } from '@/features/team/team';
import { makeStyles, useTheme } from '@/theme';

const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };
const MAX_PERMS = 3;

/** Avatar con iniciales (el administrador va en oscuro). */
export function MemberAvatar({ member, size = 42 }: { member: Member; size?: number }) {
  const styles = useStyles();
  const admin = (member.isOwner || member.roleId === OWNER_ROLE);
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
  const admin = (member.isOwner || member.roleId === OWNER_ROLE);
  return (
    <View style={[styles.role, admin && styles.roleAdmin]}>
      <Text style={[styles.roleText, admin && styles.roleTextAdmin]}>{member.roleId}</Text>
    </View>
  );
}

/** Persona del equipo en su propia tarjeta: nombre, email, rol y permisos (sin estadísticas). */
export function MemberCard({ member, onPress }: { member: Member; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const perms = member.permissions;
  const all = perms.length === PERMISSIONS.length;
  const shown = all ? [] : perms.slice(0, MAX_PERMS);
  const extra = all ? 0 : perms.length - shown.length;

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
        accessibilityLabel={`${member.name}, ${member.roleId}. Ver detalle`}
        style={styles.card}>
        <View style={styles.top}>
          <MemberAvatar member={member} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name} numberOfLines={1}>
              {member.name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {member.email}
            </Text>
          </View>
          <Icon name="chevronRight" size={12} color={colors.textMuted} />
        </View>

        <View style={styles.bottom}>
          <RoleChip member={member} />
          {member.isOwner ? <Text style={styles.you}>Vos</Text> : null}
          <View style={styles.dividerV} />
          {all ? (
            <Text style={styles.perm}>Todos los permisos</Text>
          ) : perms.length === 0 ? (
            <Text style={styles.perm}>Sin permisos</Text>
          ) : (
            <Text style={styles.perm} numberOfLines={1}>
              {shown.map((p) => PERMISSION_SHORT[p]).join(' · ')}
              {extra > 0 ? ` +${extra}` : ''}
            </Text>
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
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.raised },
    avatarAdmin: { backgroundColor: c.text },
    avatarInvited: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border, backgroundColor: '#ffffff' },
    avatarText: { color: c.textSecondary, fontWeight: '700' },
    avatarTextAdmin: { color: c.surface },
    name: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    email: { color: c.textMuted, fontSize: 13 },
    bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    role: {
      paddingHorizontal: 8,
      height: 22,
      justifyContent: 'center',
      borderRadius: 7,
      backgroundColor: c.raised,
    },
    roleAdmin: { backgroundColor: c.text },
    roleText: { color: '#000000', fontSize: 11, fontWeight: '700' },
    roleTextAdmin: { color: c.surface },
    you: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    invited: {
      paddingHorizontal: 8,
      height: 22,
      justifyContent: 'center',
      borderRadius: 7,
      backgroundColor: c.brandMuted,
    },
    invitedText: { color: c.brandText, fontSize: 11, fontWeight: '700' },
    dividerV: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: c.border },
    perm: { flex: 1, color: c.textMuted, fontSize: 12, fontWeight: '600' },
  }),
);
