import { requireOptionalNativeModule } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * Sonidos del escáner (éxito, aviso y error), para el personal que valida en la puerta sin mirar la
 * pantalla. `expo-audio` tiene código nativo: se carga solo si el build lo trae; si no, no suena
 * (el resto del feedback sigue igual). Respeta el modo silencio del teléfono y se mezcla con la
 * música que esté sonando. Se puede apagar desde el perfil.
 */
type AudioModule = typeof import('expo-audio');
type Player = ReturnType<AudioModule['createAudioPlayer']>;

const Audio: AudioModule | null =
  Platform.OS !== 'web' && requireOptionalNativeModule('ExpoAudio')
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-audio') as AudioModule)
    : null;

const SOURCES = {
  success: require('../../assets/sounds/scan-success.wav') as number,
  warning: require('../../assets/sounds/scan-warning.wav') as number,
  error: require('../../assets/sounds/scan-error.wav') as number,
};
export type ScanSound = keyof typeof SOURCES;

const players: Partial<Record<ScanSound, Player>> = {};
let modeReady = false;

function playerFor(kind: ScanSound): Player | null {
  if (!Audio) return null;
  if (!modeReady) {
    modeReady = true;
    Audio.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }
  try {
    players[kind] ??= Audio.createAudioPlayer(SOURCES[kind]);
    return players[kind] ?? null;
  } catch {
    return null;
  }
}

/** Crea los reproductores antes del primer escaneo, así el primer sonido no llega tarde. */
export function preloadScanSounds() {
  if (!enabled) return;
  (Object.keys(SOURCES) as ScanSound[]).forEach(playerFor);
}

export function playScanSound(kind: ScanSound) {
  if (!enabled) return;
  const p = playerFor(kind);
  if (!p) return;
  p.seekTo(0)
    .then(() => p.play())
    .catch(() => {});
}

/* ── Preferencia (prendido por defecto) ── */

const KEY = 'nubapay.scanSound';
const canStore = Platform.OS !== 'web';
let enabled = true;
const listeners = new Set<() => void>();

if (canStore) {
  SecureStore.getItemAsync(KEY)
    .then((v) => {
      if (v === 'off') {
        enabled = false;
        listeners.forEach((l) => l());
      }
    })
    .catch(() => {});
}

export const hasScanSounds = Audio != null;

export function setScanSoundEnabled(on: boolean) {
  enabled = on;
  listeners.forEach((l) => l());
  if (canStore) SecureStore.setItemAsync(KEY, on ? 'on' : 'off').catch(() => {});
  if (on) playScanSound('success');
}

/* ── Sonido de caja: cuando entra una venta en vivo (apagado por defecto) ── */

const SALE_KEY = 'nubapay.saleSound';
const SALE_SOURCE = require('../../assets/sounds/sale.wav') as number;
let saleOn = false;
let salePlayer: Player | null = null;
const saleListeners = new Set<() => void>();

if (canStore) {
  SecureStore.getItemAsync(SALE_KEY)
    .then((v) => {
      if (v === 'on') {
        saleOn = true;
        saleListeners.forEach((l) => l());
      }
    })
    .catch(() => {});
}

/** "Ka-ching" al entrar una venta con el inicio abierto. Respeta el modo silencio. */
export function playSaleSound() {
  if (!saleOn || !Audio) return;
  try {
    if (!modeReady) playerFor('success');
    salePlayer ??= Audio.createAudioPlayer(SALE_SOURCE);
    const p = salePlayer;
    p.seekTo(0)
      .then(() => p.play())
      .catch(() => {});
  } catch {
    // Sin audio no pasa nada: la moneda y el háptico ya avisan.
  }
}

export function setSaleSoundEnabled(on: boolean) {
  saleOn = on;
  saleListeners.forEach((l) => l());
  if (canStore) SecureStore.setItemAsync(SALE_KEY, on ? 'on' : 'off').catch(() => {});
  if (on) playSaleSound();
}

export function useSaleSoundEnabled(): boolean {
  return useSyncExternalStore(
    (l) => {
      saleListeners.add(l);
      return () => saleListeners.delete(l);
    },
    () => saleOn,
  );
}

export function useScanSoundEnabled(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => enabled,
  );
}
