import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Icon } from '@/components/dashboard/icon';
import { Sheet, useSheet } from '@/components/ui/sheet';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { PERMISSION_SHORT, PERMISSIONS, roleById, setMemberRole } from '@/features/team/team';
import { useRoles, useTeam } from '@/features/team/use-team';
import { makeStyles, useTheme } from '@/theme';
import { toast } from '@/components/ui/toast';

/**
 * Hoja para cambiar el rol de una persona (PATCH /api/events/<id>/staff/<staff_id>). Con una
 * plantilla, se le asignan sus herramientas; con un rol propio, conserva las que tiene.
 */
export default function ChangeRoleSheet() {
  return (
    <Sheet>
      <ChangeRoleContent />
    </Sheet>
  );
}

function ChangeRoleContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { dismiss } = useSheet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { members, eventId } = useTeam();
  const member = members?.find((m) => m.id === id);
  const roles = useRoles();
  const [roleId, setRoleId] = useState(member?.roleId ?? roles[0].id);
  const [saving, setSaving] = useState(false);

  if (!member) {
    return (
      <View style={styles.content}>
        <Text style={styles.note}>No encontramos a esta persona.</Text>
      </View>
    );
  }

  const changed = roleId !== member.roleId;
  const next = roleById(roleId);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        <Text style={styles.title}>Cambiar rol</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {member.name} · hoy es {member.roleId}
        </Text>
      </View>

      <View style={styles.list}>
        {roles.map((r) => {
          const on = r.id === roleId;
          const current = r.id === member.roleId;
          const all = r.permissions.length === PERMISSIONS.length;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${r.name}${current ? ', rol actual' : ''}`}
              onPress={() => {
                if (on) return;
                Haptics.selectionAsync();
                setRoleId(r.id);
              }}
              style={[styles.option, on && styles.optionOn]}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.optionHead}>
                  <Text style={styles.optionName}>{r.name}</Text>
                  {current ? (
                    <View style={styles.current}>
                      <Text style={styles.currentText}>Actual</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.optionPerms} numberOfLines={2}>
                  {all
                    ? 'Todos los permisos'
                    : r.permissions.length
                      ? r.permissions.map((p) => PERMISSION_SHORT[p]).join(' · ')
                      : 'Conserva los permisos que tiene'}
                </Text>
              </View>
              <View style={[styles.radio, on && styles.radioOn]}>
                {on ? <Icon name="checkmark" size={11} color={colors.onInk} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {changed ? (
        <Animated.Text
          entering={FadeIn.duration(260)}
          layout={LinearTransition.duration(260)}
          style={styles.note}>
          {next.permissions.length
            ? `${member.name} va a poder: ${next.permissions.map((p) => PERMISSION_SHORT[p].toLowerCase()).join(', ')}.`
            : `${member.name} conserva los permisos que tiene.`}
        </Animated.Text>
      ) : null}

      <Animated.View layout={LinearTransition.duration(260)}>
        <Pressable
          onPress={async () => {
            if (!changed || !eventId) return;
            setSaving(true);
            const res = await setMemberRole(eventId, member, roleId);
            setSaving(false);
            if (!res.ok) {
              toast.error('No se pudo cambiar el rol', res.error);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            dismiss();
          }}
          disabled={!changed || saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: !changed }}
          style={({ pressed }) => [
            styles.save,
            !changed && { backgroundColor: colors.raised },
            pressed && { opacity: 0.85 },
          ]}>
          {saving ? (
            <ActivityIndicator color={colors.onInk} />
          ) : (
            <Text style={[styles.saveText, !changed && { color: colors.textMuted }]}>
              {changed ? `Cambiar a ${next.name}` : 'Elegí un rol'}
            </Text>
          )}
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flexGrow: 0 },
    content: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },
    title: { color: c.text, fontSize: 22, fontFamily: DisplayFont.bold, letterSpacing: -0.5 },
    subtitle: { color: c.textMuted, fontSize: 13 },
    list: { gap: 10 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
    },
    optionOn: { borderColor: c.ink },
    optionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    optionName: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    optionPerms: { color: c.textMuted, fontSize: 13 },
    current: {
      paddingHorizontal: 7,
      height: 20,
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: c.raised,
    },
    currentText: { color: c.textSecondary, fontSize: 10, fontWeight: '700' },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { backgroundColor: c.ink, borderColor: c.ink },
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
