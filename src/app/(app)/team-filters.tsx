import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/dashboard/icon';
import { Sheet, useSheet } from '@/components/ui/sheet';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import {
  PERMISSION_LABEL,
  PERMISSIONS,
  type PermissionId,
  setTeamFilters,
  useTeamFilters,
} from '@/features/team/team';
import { useRoles } from '@/features/team/use-team';
import { makeStyles } from '@/theme';

/**
 * Hoja de filtros del equipo: por roles creados y/o por permisos (se puede elegir más de uno).
 * Un rol elegido muestra a quienes lo tienen; un permiso elegido, a quienes lo tienen por su rol.
 */
export default function TeamFiltersSheet() {
  return (
    <Sheet>
      <FiltersContent />
    </Sheet>
  );
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function FiltersContent() {
  const styles = useStyles();
  const { dismiss } = useSheet();
  const current = useTeamFilters();
  const roleList = useRoles();
  const [roles, setRoles] = useState<string[]>(current.roles);
  const [permissions, setPermissions] = useState<PermissionId[]>(current.permissions);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text style={styles.title}>Filtros</Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setRoles([]);
            setPermissions([]);
          }}
          hitSlop={10}
          accessibilityRole="button">
          <Text style={styles.reset}>Restablecer</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Roles</Text>
        <View style={styles.chips}>
          {roleList.map((r) => {
            const on = roles.includes(r.id);
            return (
              <Pressable
                key={r.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setRoles((l) => toggle(l, r.id));
                }}
                style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{r.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permisos</Text>
        <View style={styles.card}>
          {PERMISSIONS.map((p, i) => {
            const on = permissions.includes(p);
            return (
              <Pressable
                key={p}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPermissions((l) => toggle(l, p));
                }}
                style={[styles.row, i > 0 && styles.divider]}>
                <Text style={styles.rowText}>{PERMISSION_LABEL[p]}</Text>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Icon name="checkmark" size={11} color="#ffffff" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          dismiss(() => setTeamFilters({ roles, permissions }));
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.apply, pressed && { opacity: 0.85 }]}>
        <Text style={styles.applyText}>Aplicar</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flexGrow: 0 },
    content: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },
    head: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    title: { color: c.text, fontSize: 22, fontFamily: DisplayFont.bold, letterSpacing: -0.5 },
    reset: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    section: { gap: 10 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      height: 38,
      paddingHorizontal: 14,
      borderRadius: Radius.pill,
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    chipOn: { backgroundColor: '#000000' },
    chipText: { color: '#000000', fontSize: 14, fontWeight: '600' },
    chipTextOn: { color: '#ffffff' },
    card: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },
    rowText: { flex: 1, color: c.text, fontSize: 15 },
    check: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: '#000000', borderColor: '#000000' },
    apply: {
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
    },
    applyText: { color: '#ffffff', fontSize: 16, fontFamily: DisplayFont.semibold },
  }),
);
