import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * La bienvenida (`/onboarding`) se muestra una sola vez por cuenta, la primera vez que entra sin
 * eventos. Queda guardado en el teléfono; en web no se muestra.
 */
const canStore = Platform.OS !== 'web';
const key = (userId: string) => `nubapay.onboardingSeen.${userId}`;

export async function hasSeenOnboarding(userId: string): Promise<boolean> {
  if (!canStore) return true;
  try {
    return (await SecureStore.getItemAsync(key(userId))) === '1';
  } catch {
    return true;
  }
}

export async function markOnboardingSeen(userId: string): Promise<void> {
  if (!canStore) return;
  await SecureStore.setItemAsync(key(userId), '1').catch(() => {});
}
