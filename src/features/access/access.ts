import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { useEvents } from '@/features/dashboard/use-event-dashboard';
import { useSelectedEventDetail } from '@/features/payouts/payment-methods';
import type { StaffTools } from '@/lib/api/organizer';
import { useAuth } from '@/providers/auth-provider';

/**
 * Permisos sobre el evento seleccionado, con las mismas reglas que el backend
 * (routes/workspace_access.py `staff_tools_payload`):
 * - dashboard → métricas del home        - orders → pedidos y arrepentimientos
 * - products → catálogo, entradas, bloques - scanner → escanear y cobrar efectivo
 * - storefront → editar datos del evento   - payments → pagos y comisión
 * El dueño puede todo; el equipo, los métodos de pago y borrar el evento son solo del dueño.
 */
export type Tool = keyof StaffTools;

export function useEventAccess() {
  const { user } = useAuth();
  const eventId = useSelectedEventId();
  const { events } = useEvents();
  const { data: detail } = useSelectedEventDetail();
  const event = events?.find((e) => e.id === eventId) ?? null;

  const isStaff = event?.membership === 'staff' || detail?.membership === 'staff';
  const tools: StaffTools | null =
    (detail?.id === eventId ? detail?.tools : undefined) ??
    user?.staff_memberships?.find((m) => m.event_id === eventId)?.tools ??
    null;

  /** Mientras no se sabe (cargando) se permite: el backend igual valida cada acción. */
  const can = (tool: Tool) => !isStaff || !tools || !!tools[tool];

  return {
    eventId,
    isOwner: !!event && !isStaff,
    isStaff,
    can,
    /** Las cuentas de staff no pueden crear eventos (POST /events responde 403). */
    canCreateEvents: user?.role !== 'ORGANIZER_STAFF',
  };
}
