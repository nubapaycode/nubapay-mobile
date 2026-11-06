import { useMemo } from 'react';

import { useDashboardSnapshot } from '@/features/dashboard/dashboard-store';
import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { listStaff, type StaffRow } from '@/lib/api/organizer';
import { useQuery } from '@/lib/query';
import { useAuth } from '@/providers/auth-provider';

import { type Member, memberFromStaff, OWNER_ROLE, PERMISSIONS, type Role, ROLE_TEMPLATES } from './team';

/**
 * Equipo del evento actual: el organizador (sesión) + el staff del backend, con los escaneos de
 * cada uno (dashboard/insights). `members` es null mientras carga.
 */
export function useTeam(): {
  members: Member[] | null;
  error: string | null;
  eventId: string | null;
  refresh: () => Promise<void>;
} {
  const eventId = useSelectedEventId();
  const snapshot = useDashboardSnapshot();
  const { user } = useAuth();
  const staff = useQuery<StaffRow[]>(eventId ? `staff:${eventId}` : null, () => listStaff(eventId!));
  const scans = snapshot?.eventId === eventId ? snapshot?.data.insights.staff_scans : undefined;

  const members = useMemo(() => {
    if (!staff.data) return null;
    const byUser = new Map((scans ?? []).map((s) => [s.user_id, s.units_redeemed]));
    const owner: Member | null = user
      ? {
          id: 'owner',
          userId: user.id,
          name: user.name,
          email: user.email,
          roleId: OWNER_ROLE,
          permissions: [...PERMISSIONS],
          isOwner: true,
          storefront: true,
          stats: { scans: byUser.get(user.id) ?? 0, checkins: 0, pickups: 0, sales: 0 },
        }
      : null;
    const rows = staff.data.map((r) => memberFromStaff(r, byUser.get(r.user_id) ?? 0));
    return owner ? [owner, ...rows] : rows;
  }, [staff.data, scans, user]);

  return { members, error: staff.data ? null : staff.error, eventId, refresh: staff.refresh };
}

/** Roles para sugerir: las plantillas de la web + los que ya usa el equipo. */
export function useRoles(): Role[] {
  const { members } = useTeam();
  return useMemo(() => {
    const extra = [...new Set((members ?? []).filter((m) => !m.isOwner).map((m) => m.roleId))]
      .filter((r) => !ROLE_TEMPLATES.some((t) => t.name.toLowerCase() === r.toLowerCase()))
      .map((r) => ({ id: r, name: r, permissions: [] as Role['permissions'] }));
    return [...ROLE_TEMPLATES, ...extra];
  }, [members]);
}
