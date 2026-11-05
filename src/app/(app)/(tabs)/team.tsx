import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { TabPage } from '@/components/navigation/tab-page';
import { MemberCard } from '@/components/team/member-card';
import { NoAccess } from '@/components/ui/no-access';
import { useEventAccess } from '@/features/access/access';
import { DisplayFont, Radius } from '@/constants/theme';
import {
  activeTeamFilters,
  DEFAULT_TEAM_FILTERS,
  matchesMemberQuery,
  matchesTeamFilters,
  type Member,
  OWNER_ROLE,
  setTeamFilters,
  useTeamFilters,
} from '@/features/team/team';
import { useTeam } from '@/features/team/use-team';
import { makeStyles, useTheme } from '@/theme';

/**
 * Equipo del evento (mismo lenguaje que Operaciones): filtros e invitar arriba a la derecha,
 * buscador, y las personas agrupadas por rol, cada una en su card con permisos y escaneos.
 */
export default function TeamScreen() {
  const { isStaff } = useEventAccess();
  if (isStaff) {
    return (
      <TabPage title="Equipo">
        <NoAccess text="Solo el organizador del evento puede ver y administrar el equipo." />
      </TabPage>
    );
  }
  return <TeamContent />;
}

function TeamContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { members: team, error } = useTeam();
  const filters = useTeamFilters();
  const [query, setQuery] = useState('');

  const active = activeTeamFilters(filters);
  const members = (team ?? []).filter(
    (m) => matchesTeamFilters(m, filters) && matchesMemberQuery(m, query),
  );
  const groups = groupByRole(members);

  return (
    <TabPage
      title="Equipo"
      subtitle={team ? `${team.length} ${team.length === 1 ? 'persona' : 'personas'}` : undefined}
      right={
        <View style={styles.headActions}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/team-filters');
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Filtros${active ? `, ${active} activos` : ''}`}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
            <Icon name="filter" size={17} color={colors.text} />
            {active > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{active}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/invite-member');
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Agregar al equipo"
            style={({ pressed }) => [styles.round, styles.roundPrimary, pressed && styles.pressed]}>
            <Icon name="userPlus" size={17} color={colors.onInk} />
          </Pressable>
        </View>
      }>
      <Animated.View entering={enter(1)} style={{ gap: 12 }}>
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
        {team && (active > 0 || query.trim()) ? (
          <Animated.View entering={FadeIn.duration(260)} style={styles.resultRow}>
            <Text style={styles.resultText}>
              {members.length} de {team.length}
            </Text>
            {active > 0 ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setTeamFilters(DEFAULT_TEAM_FILTERS);
                }}
                hitSlop={8}
                accessibilityRole="button">
                <Text style={styles.clear}>Limpiar filtros</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </Animated.View>

      {!team ? (
        <Text style={styles.empty}>{error ?? 'Cargando equipo…'}</Text>
      ) : members.length === 0 ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <Icon name={query ? 'search' : 'people'} size={20} color={colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptyText}>
            {query ? `Nadie coincide con “${query.trim()}”.` : 'Nadie tiene ese rol o permiso.'}
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.groups}>
          {groups.map((g) => (
            <Animated.View key={g.role} layout={LinearTransition.duration(260)} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>{g.role}</Text>
                <Text style={styles.groupCount}>{g.members.length}</Text>
              </View>
              {g.members.map((m) => (
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
            </Animated.View>
          ))}
        </View>
      )}
    </TabPage>
  );
}

/** Agrupa por rol: Administración primero, después el resto por nombre; vos primero en tu grupo. */
function groupByRole(list: Member[]) {
  const map = new Map<string, Member[]>();
  for (const m of list) map.set(m.roleId, [...(map.get(m.roleId) ?? []), m]);
  return [...map.entries()]
    .sort(([a], [b]) => (a === OWNER_ROLE ? -1 : b === OWNER_ROLE ? 1 : a.localeCompare(b, 'es')))
    .map(([role, members]) => ({
      role,
      members: [...members].sort((x, y) => Number(y.isOwner) - Number(x.isOwner)),
    }));
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    pressed: { opacity: 0.7 },
    headActions: { flexDirection: 'row', gap: 8 },
    round: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    roundPrimary: { backgroundColor: c.ink, borderColor: c.ink },
    badge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      borderWidth: 2,
      borderColor: c.background,
    },
    badgeText: { color: c.onPrimary, fontSize: 10, fontWeight: '700' },
    search: {
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
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    resultText: { color: c.textSecondary, fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
    clear: { color: c.primary, fontSize: 13, fontWeight: '600' },

    groups: { gap: 22 },
    group: { gap: 8 },
    groupHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      paddingHorizontal: 4,
      marginBottom: 2,
    },
    groupTitle: { color: c.text, fontSize: 17, fontFamily: DisplayFont.semibold },
    groupCount: { color: c.textMuted, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },

    empty: { color: c.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
    emptyBox: {
      gap: 6,
      paddingVertical: 28,
      paddingHorizontal: 20,
      alignItems: 'center',
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      boxShadow: c.cardShadowSubtle,
    },
    emptyIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
      marginBottom: 6,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontFamily: DisplayFont.semibold },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  }),
);
