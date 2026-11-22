import * as Haptics from 'expo-haptics';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/dashboard/icon';
import { hasLinkPreview, PreviewLink } from '@/components/motion/preview-link';
import { SwipeActions } from '@/components/motion/swipe-actions';
import { Radius, uiFont } from '@/constants/theme';
import {
  type Member,
  OWNER_ROLE,
  type PermissionId,
  PERMISSION_SHORT,
  PERMISSIONS,
} from '@/features/team/team';
import { makeStyles, useTheme } from '@/theme';
import { Text } from '@/components/ui/text';
import { FaceAvatar } from '@/components/ui/face-avatar';

const PRESS = { duration: 120, easing: Easing.out(Easing.quad) };
const LIFT = { duration: 180, easing: Easing.out(Easing.cubic) };
const MAX_PERMS = 2;
const CARD_RADIUS = 28;

/** Ícono de cada permiso (cards del equipo y grilla del detalle). */
export const PERMISSION_ICON: Record<PermissionId, IconName> = {
  dashboard: 'up',
  products: 'tag',
  scanner: 'qr',
  orders: 'receipt',
  pickup_points: 'store',
  regrets: 'undo',
  payments: 'card',
};

export const isAdmin = (m: Member) => m.isOwner || m.roleId === OWNER_ROLE;

/** Carita de la persona (siempre la misma para el mismo nombre; ver FaceAvatar). */
export function MemberAvatar({ member, size = 44 }: { member: Member; size?: number }) {
  return <FaceAvatar seed={member.name || member.email} size={size} />;
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
 * Persona del equipo en su propia card (mismo estilo que Operaciones, referencia Fuse): avatar a la
 * izquierda; el nombre y debajo sus permisos como chips con ícono; chevron al costado. El rol va en
 * el título del grupo; el email y los escaneos, en el detalle.
 */
export function MemberCard({
  member,
  onPress,
  onChangeRole,
  href,
}: {
  member: Member;
  onPress: () => void;
  /** Ruta del detalle: en iOS, mantener apretado muestra la vista previa con acciones. */
  href?: Href;
  /** Si se le puede cambiar el rol: deslizar a la derecha (o mantener apretado) lo hace. */
  onChangeRole?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const perms = member.permissions;
  const all = perms.length === PERMISSIONS.length;
  const shown = all ? [] : perms.slice(0, MAX_PERMS);
  const extra = all ? 0 : perms.length - shown.length;
  const permsLine = all
    ? 'Todos los permisos'
    : perms.length === 0
      ? 'Sin permisos'
      : [...shown.map((p) => PERMISSION_SHORT[p]), ...(extra > 0 ? [`+${extra}`] : [])].join(' · ');
  const preview = !!href && hasLinkPreview;

  return (
    <SwipeActions
      radius={CARD_RADIUS}
      start={
        onChangeRole
          ? {
              label: 'Cambiar rol',
              icon: 'key',
              onTrigger: onChangeRole,
              tone: { soft: colors.brandMuted, strong: colors.brand, fg: colors.brandText, onStrong: colors.onBrand },
            }
          : undefined
      }
      end={{
        label: 'Ver detalle',
        icon: 'person',
        onTrigger: onPress,
        tone: { soft: colors.raised, strong: colors.ink, fg: colors.textSecondary, onStrong: colors.onInk },
      }}>
    <Animated.View style={press}>
      <PreviewLink
        href={href ?? '/'}
        disabled={!href}
        zoom
        actions={[
          ...(onChangeRole ? [{ title: 'Cambiar rol', icon: 'key' as const, onPress: onChangeRole }] : []),
          { title: 'Ver detalle', icon: 'person.crop.circle' as const, onPress },
        ]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          // Con vista previa navega el Link; acá solo el toque.
          if (!preview) onPress();
        }}
        onLongPress={
          // En iOS el mantener apretado es la vista previa nativa (con "Cambiar rol" en el menú).
          onChangeRole && !preview
            ? () => {
                // Se "levanta" un instante antes de abrir el cambio de rol.
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                scale.set(withTiming(1.03, LIFT));
                onChangeRole();
              }
            : undefined
        }
        delayLongPress={380}
        onPressIn={() => scale.set(withTiming(0.98, PRESS))}
        onPressOut={() => scale.set(withTiming(1, PRESS))}
        accessibilityActions={onChangeRole ? [{ name: 'changeRole', label: 'Cambiar rol' }] : undefined}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'changeRole' && onChangeRole?.()}
        accessibilityRole="button"
        accessibilityLabel={`${member.name}, ${member.roleId}, ${permsLine}. Ver detalle`}
        style={styles.card}>
        <MemberAvatar member={member} size={48} />
        <View style={styles.grow}>
          <View style={styles.line}>
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
        </View>
        <Icon name="chevronRight" size={13} color={colors.textMuted} />
      </Pressable>
      </PreviewLink>
    </Animated.View>
    </SwipeActions>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    // Igual que OperationCard: blanco y sombra difusa.
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 24,
      paddingLeft: 20,
      paddingRight: 18,
      borderRadius: CARD_RADIUS,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.borderSubtle,
      backgroundColor: c.surface,
      boxShadow: c.cardShadowSmooth,
    },
    grow: { flex: 1, gap: 8 },
    line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { flexShrink: 1, color: c.text, fontSize: 18, letterSpacing: -0.2, ...uiFont('500') },
    you: {
      paddingHorizontal: 7,
      height: 20,
      justifyContent: 'center',
      borderRadius: Radius.pill,
      backgroundColor: c.brandMuted,
    },
    youText: { color: c.brandText, fontSize: 11, ...uiFont('600') },

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
