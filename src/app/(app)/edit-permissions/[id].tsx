import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/dashboard/icon';
import { Sheet, useSheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  PERMISSION_LABEL,
  PERMISSIONS,
  type PermissionId,
  samePermissions,
  setMemberPermissions,
  sortPermissions,
} from '@/features/team/team';
import { useTeam } from '@/features/team/use-team';
import { makeStyles, useTheme } from '@/theme';

/** Hoja para editar los permisos (herramientas) de una persona: PATCH …/staff/<id> con `tools`. */
export default function EditPermissionsSheet() {
  return (
    <Sheet>
      <EditPermissionsContent />
    </Sheet>
  );
}

function EditPermissionsContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { dismiss } = useSheet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { members, eventId } = useTeam();
  const member = members?.find((m) => m.id === id);
  const [perms, setPerms] = useState<PermissionId[]>(member?.permissions ?? []);
  const [saving, setSaving] = useState(false);

  if (!member) {
    return (
      <View style={styles.content}>
        <Text style={styles.note}>No encontramos a esta persona.</Text>
      </View>
    );
  }

  const changed = !samePermissions(perms, member.permissions);
  const empty = perms.length === 0;
  const all = perms.length === PERMISSIONS.length;
  const canSave = changed && !empty && !saving;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.title}>Permisos</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {member.name} · {member.roleId}
          </Text>
        </View>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          onPress={() => {
            Haptics.selectionAsync();
            setPerms(all ? [] : [...PERMISSIONS]);
          }}>
          <Text style={styles.link}>{all ? 'Quitar todos' : 'Todos'}</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {PERMISSIONS.map((p) => {
          const on = perms.includes(p);
          return (
            <Pressable
              key={p}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => {
                Haptics.selectionAsync();
                setPerms((l) => (l.includes(p) ? l.filter((x) => x !== p) : sortPermissions([...l, p])));
              }}
              style={[styles.option, on && styles.optionOn]}>
              <Text style={styles.optionText}>{PERMISSION_LABEL[p]}</Text>
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Icon name="checkmark" size={11} color={colors.onInk} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {empty ? <Text style={styles.note}>Elegí al menos un permiso.</Text> : null}

      <Pressable
        onPress={async () => {
          if (!canSave || !eventId) return;
          setSaving(true);
          const res = await setMemberPermissions(eventId, member, perms);
          setSaving(false);
          if (!res.ok) {
            toast.error('No se pudieron guardar los permisos', res.error);
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          dismiss();
        }}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
        style={({ pressed }) => [
          styles.save,
          !canSave && { backgroundColor: colors.raised },
          pressed && { opacity: 0.85 },
        ]}>
        {saving ? (
          <ActivityIndicator color={colors.onInk} />
        ) : (
          <Text style={[styles.saveText, !canSave && { color: colors.textMuted }]}>
            {changed ? 'Guardar permisos' : 'Sin cambios'}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flexGrow: 0 },
    content: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 4 },
    title: { color: c.text, fontSize: 22, fontFamily: DisplayFont.bold, letterSpacing: -0.5 },
    subtitle: { color: c.textMuted, fontSize: 13 },
    link: { color: c.textSecondary, fontSize: 14, fontWeight: '600', paddingTop: 4 },
    list: { gap: 10 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
    },
    optionOn: { borderColor: c.ink },
    optionText: { flex: 1, color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    check: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: c.ink, borderColor: c.ink },
    note: { color: c.textSecondary, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
    save: {
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.ink,
    },
    saveText: { color: c.onInk, fontSize: 16, fontFamily: DisplayFont.semibold },
  }),
);
