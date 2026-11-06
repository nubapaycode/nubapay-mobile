import { useSyncExternalStore } from 'react';

import {
  deleteStaff,
  inviteStaff,
  patchStaff,
  resendStaffInvite,
  type StaffRow,
  type StaffTools,
} from '@/lib/api/organizer';
import { invalidate } from '@/lib/query';

/**
 * Equipo del evento (routes/event_staff.py): cada persona tiene un rol (etiqueta libre) y sus
 * herramientas (`tools`). Las plantillas de rol son las mismas que sugiere el panel web.
 */

/** Permisos = herramientas del staff. Mismas claves y textos que el panel web (StaffView). */
export type PermissionId = 'dashboard' | 'products' | 'scanner' | 'orders' | 'pickup_points' | 'payments';

export const PERMISSION_LABEL: Record<PermissionId, string> = {
  dashboard: 'Dashboard / métricas',
  products: 'Catálogo y promos',
  scanner: 'Escáner QR',
  orders: 'Pedidos',
  pickup_points: 'Puntos de retiro',
  payments: 'Pagos',
};

/** Versión corta para las tarjetas. */
export const PERMISSION_SHORT: Record<PermissionId, string> = {
  dashboard: 'Dashboard',
  products: 'Catálogo',
  scanner: 'Escáner',
  orders: 'Pedidos',
  pickup_points: 'Retiro',
  payments: 'Pagos',
};

export const PERMISSIONS = (Object.keys(PERMISSION_LABEL) as PermissionId[])
  // Puntos de retiro deshabilitado por ahora: no se muestra ni se ofrece al invitar o cambiar de rol.
  .filter((p) => p !== 'pickup_points');
/** Herramientas que se marcan por defecto al invitar (igual que la web). */
export const DEFAULT_PERMISSIONS: PermissionId[] = ['orders', 'scanner'];

export const sortPermissions = (list: PermissionId[]) => PERMISSIONS.filter((p) => list.includes(p));
export const samePermissions = (a: PermissionId[], b: PermissionId[]) =>
  a.length === b.length && a.every((p) => b.includes(p));
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Rol: en el backend es una etiqueta libre. `id` es el mismo nombre. */
export type Role = { id: string; name: string; permissions: PermissionId[] };

/** Plantillas que sugiere el panel web, con sus herramientas típicas. */
export const ROLE_TEMPLATES: Role[] = [
  { id: 'Acreditación', name: 'Acreditación', permissions: ['scanner'] },
  { id: 'Barra', name: 'Barra', permissions: ['scanner', 'orders'] },
  { id: 'Producción', name: 'Producción', permissions: ['dashboard', 'scanner', 'orders'] },
  { id: 'Administración', name: 'Administración', permissions: [...PERMISSIONS] },
];
export const OWNER_ROLE = 'Administración';

export type Member = {
  /** Fila de staff (o "owner" para el organizador). */
  id: string;
  userId: string;
  name: string;
  email: string;
  /** Etiqueta del rol. */
  roleId: string;
  permissions: PermissionId[];
  isOwner: boolean;
  /** Herramienta que la app no edita (tienda): se conserva al guardar. */
  storefront: boolean;
  stats: { scans: number; checkins: number; pickups: number; sales: number };
};

export const toPermissions = (t: StaffTools): PermissionId[] => PERMISSIONS.filter((p) => t[p]);
export const toTools = (perms: PermissionId[], storefront = false): StaffTools => ({
  dashboard: perms.includes('dashboard'),
  storefront,
  products: perms.includes('products'),
  scanner: perms.includes('scanner'),
  orders: perms.includes('orders'),
  pickup_points: perms.includes('pickup_points'),
  payments: perms.includes('payments'),
});

export function memberFromStaff(row: StaffRow, scans: number): Member {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || row.email,
    email: row.email,
    roleId: row.role || 'Integrante',
    permissions: toPermissions(row.tools),
    isOwner: false,
    storefront: !!row.tools.storefront,
    // El backend cuenta escaneos (ingresos + retiros) por persona, sin separarlos.
    stats: { scans, checkins: 0, pickups: 0, sales: 0 },
  };
}

/** Rol por nombre: la plantilla si existe; si no, un rol sin permisos sugeridos. */
export const roleById = (id: string): Role =>
  ROLE_TEMPLATES.find((r) => r.id.toLowerCase() === id.toLowerCase()) ?? { id, name: id, permissions: [] };

export function matchesMemberQuery(m: Member, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [m.name, m.email, m.roleId].join(' ').toLowerCase().includes(q);
}

/* ── Acciones (API) ── */

type Result = { ok: true } | { ok: false; error: string };
const refresh = (eventId: string) => invalidate(`staff:${eventId}`);

/** Invita (crea la cuenta y le manda el acceso por email). */
export async function inviteMember(
  eventId: string,
  input: { name: string; email: string; roleName: string; permissions: PermissionId[] },
): Promise<Result & { emailSent?: boolean; emailError?: string }> {
  const res = await inviteStaff(eventId, {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.roleName.trim() || 'Integrante',
    tools: toTools(input.permissions),
  });
  if (!res.ok) return res;
  await refresh(eventId);
  return { ok: true, emailSent: res.data.email_sent !== false, emailError: res.data.email_error };
}

/** Cambia el rol; si es una plantilla, le asigna sus herramientas. */
export async function setMemberRole(eventId: string, m: Member, roleName: string): Promise<Result> {
  const template = ROLE_TEMPLATES.find((r) => r.name === roleName);
  const res = await patchStaff(eventId, m.id, {
    role: roleName,
    ...(template ? { tools: toTools(template.permissions, m.storefront) } : {}),
  });
  if (!res.ok) return res;
  await refresh(eventId);
  return { ok: true };
}

export async function removeMember(eventId: string, m: Member): Promise<Result> {
  const res = await deleteStaff(eventId, m.id);
  if (!res.ok) return res;
  await refresh(eventId);
  return { ok: true };
}

export async function resendAccess(eventId: string, m: Member): Promise<Result> {
  const res = await resendStaffInvite(eventId, m.id);
  if (!res.ok) return res;
  // El backend responde 200 aunque el proveedor de email lo rechace: eso también es un error.
  if (res.data.email_sent === false) {
    return { ok: false, error: mailError('No pudimos mandar el email.', res.data.email_error) };
  }
  return { ok: true };
}

/** En desarrollo suma el motivo que dio el proveedor de email (en producción, solo el texto amable). */
export const mailError = (text: string, detail?: string) =>
  __DEV__ && detail ? `${text}\n\n${detail}` : text;

/* ── Filtros (por rol y/o por permiso). Vacío = sin filtrar. ── */

export type TeamFilters = { roles: string[]; permissions: PermissionId[] };
export const DEFAULT_TEAM_FILTERS: TeamFilters = { roles: [], permissions: [] };

/** Pasa si su rol está entre los elegidos y si tiene todos los permisos elegidos. */
export function matchesTeamFilters(m: Member, f: TeamFilters): boolean {
  if (f.roles.length && !f.roles.includes(m.roleId)) return false;
  return f.permissions.every((p) => m.permissions.includes(p));
}

export const activeTeamFilters = (f: TeamFilters) => f.roles.length + f.permissions.length;

let filters: TeamFilters = DEFAULT_TEAM_FILTERS;
const listeners = new Set<() => void>();

export function setTeamFilters(next: TeamFilters) {
  filters = next;
  listeners.forEach((l) => l());
}

export function useTeamFilters(): TeamFilters {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => filters,
  );
}
