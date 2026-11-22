import { useMemo } from 'react';

import { useSelectedEventId } from '@/features/dashboard/selected-event';
import { listProducts, type Product } from '@/lib/api/organizer';
import { useQuery } from '@/lib/query';

/**
 * Foto de cada producto por id. Los pedidos no las traen: salen del catálogo del evento (misma
 * caché que la pantalla Productos, así no se pide dos veces). Si el rol no puede ver productos o
 * falla, queda vacío y se muestra el estado sin foto.
 */
export function useProductPhotos(enabled = true): Map<string, string | null> {
  const eventId = useSelectedEventId();
  const q = useQuery<Product[]>(eventId && enabled ? `products:${eventId}` : null, () => listProducts(eventId!));
  return useMemo(() => new Map((q.data ?? []).map((p) => [p.id, p.image_url])), [q.data]);
}
