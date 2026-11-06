import { useCallback, useState } from 'react';

/**
 * Estado de "tirar para actualizar" propio del gesto: el indicador se muestra solo mientras dura la
 * recarga que pidió el usuario, no en cada recarga en segundo plano de la misma consulta.
 */
export function usePullRefresh(refresh: () => Promise<unknown> | void) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);
  return { refreshing, onRefresh };
}
