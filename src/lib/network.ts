import { requireOptionalNativeModule } from 'expo';

/** `expo-network` es nativo: sin él en el build no hay detección de red (y nada se rompe). */
type NetworkModule = typeof import('expo-network');
export const Network: NetworkModule | null = requireOptionalNativeModule('ExpoNetwork')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-network') as NetworkModule)
  : null;

/** Avisa cada vez que vuelve la conexión. Devuelve la función para dejar de escuchar. */
export function onReconnect(callback: () => void): () => void {
  if (!Network) return () => {};
  const sub = Network.addNetworkStateListener((s) => {
    if (s.isConnected) callback();
  });
  return () => sub.remove();
}
