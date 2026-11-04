import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { TabPage } from '@/components/navigation/tab-page';
import { MemberCard } from '@/components/team/member-card';
import { Radius } from '@/constants/theme';
import {
  activeTeamFilters,
  matchesMemberQuery,
  matchesTeamFilters,
  PERMISSION_SHORT,
  useTeamFilters,
} from '@/features/team/team';
import { useTeam } from '@/features/team/use-team';
import { makeStyles, useTheme } from '@/theme';

/**
 * Equipo del evento: buscador con filtros (por rol y/o permiso) y una tarjeta por persona con su
 * rol y permisos. Las estadísticas de cada uno están en su detalle.
 */
export default function TeamScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { members: team, error } = useTeam();
  const filters = useTeamFilters();
  const [query, setQuery] = useState('');

  const active = activeTeamFilters(filters);
  const members = (team ?? []).filter(
    (m) => matchesTeamFilters(m, filters) && matchesMemberQuery(m, query),
  );
  const activeLabels = [
    ...filters.roles,
    ...filters.permissions.map((p) => PERMISSION_SHORT[p]),
  ];

  return (
    <TabPage
      title="Equipo"
      subtitle={team ? `${team.length} personas` : undefined}
      right={
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/invite-member');
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Agregar al equipo"
          style={({ pressed }) => [styles.invite, pressed && { backgroundColor: colors.border }]}>
          <Icon name="userPlus" size={17} color="#000000" />
        </Pressable>
      }>
      <Animated.View entering={enter(1)} style={{ gap: 10 }}>
        <View style={styles.searchRow}>
          <View style={styles.search}>
            <Icon name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nombre, email o rol"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={styles.input}
              accessibilityLabel="Buscar en el equipo"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Borrar búsqueda">
                <Icon name="clearCircle" size={17} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/team-filters');
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Filtros${active ? `, ${active} activos` : ''}`}
            style={({ pressed }) => [styles.filterBtn, pressed && { backgroundColor: colors.border }]}>
            <Icon name="filter" size={17} color="#000000" />
            {active > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{active}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        {activeLabels.length ? (
          <Animated.Text entering={FadeIn.duration(260)} style={styles.activeFilters} numberOfLines={2}>
            Filtrando: {activeLabels.join(' · ')}
          </Animated.Text>
        ) : null}
      </Animated.View>

      {!team ? (
        <Text style={styles.empty}>{error ?? 'Cargando equipo…'}</Text>
      ) : members.length === 0 ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptyText}>
            {query ? `Nadie coincide con “${query.trim()}”.` : 'Nadie tiene ese rol o permiso.'}
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.list}>
          {members.map((m) => (
            <Animated.View
              key={m.id}
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition.duration(260)}>
              <MemberCard
                member={m}
                onPress={() => router.push({ pathname: '/member/[id]', params: { id: m.id } })}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </TabPage>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    invite: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    search: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 46,
      paddingHorizontal: 14,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      backgroundColor: c.raised,
    },
    input: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 0 },
    filterBtn: {
      width: 46,
      height: 46,
      borderRadius: Radius.lg,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      borderWidth: 2,
      borderColor: '#ffffff',
    },
    badgeText: { color: c.onPrimary, fontSize: 10, fontWeight: '700' },
    activeFilters: { color: c.textSecondary, fontSize: 13, paddingHorizontal: 4 },
    list: { gap: 10 },
    empty: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
    emptyBox: {
      gap: 6,
      padding: 20,
      alignItems: 'center',
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '600' },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  }),
);
