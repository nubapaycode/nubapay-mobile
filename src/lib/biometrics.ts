import { requireOptionalNativeModule } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Ingreso con biometría (Face ID, Touch ID, huella).
 *
 * El email y la contraseña se guardan en el llavero / Keystore con `requireAuthentication`: solo se
 * pueden leer después de pasar la biometría del teléfono, y el sistema los invalida si cambian las
 * caras o huellas registradas (ahí la lectura devuelve `null` y se desactiva solo). Con ellos se
 * llama al mismo login de siempre: no hace falta nada nuevo en el backend.
 *
 * expo-local-authentication tiene código nativo: si el build instalado no lo trae, todo esto
 * queda apagado (sin oferta ni botón) en vez de romper el acceso.
 */
type LocalAuthModule = typeof import('expo-local-authentication');

const LocalAuth: LocalAuthModule | null =
  Platform.OS !== 'web' && requireOptionalNativeModule('ExpoLocalAuthentication')
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('expo-local-authentication')
    : null;

const CREDENTIALS_KEY = 'nubapay.biometric.credentials';
/** Email con la biometría activa (sin protección: se lee sin pedir Face ID para mostrarlo). */
const EMAIL_KEY = 'nubapay.biometric.email';
/** Último email que respondió "Ahora no": no se le vuelve a ofrecer. */
const DECLINED_KEY = 'nubapay.biometric.declined';

export type BiometricKind = {
  /** Nombre del método: "Face ID", "Touch ID", "huella", "reconocimiento facial". */
  name: string;
  /** Para frases como "Ingresar con …": "Face ID", "tu huella". */
  phrase: string;
  icon: 'faceid' | 'fingerprint';
};

/** Qué biometría hay disponible y registrada en el teléfono (o `null` si ninguna sirve). */
export async function getBiometricKind(): Promise<BiometricKind | null> {
  if (!LocalAuth || !SecureStore.canUseBiometricAuthentication()) return null;
  try {
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuth.hasHardwareAsync(),
      LocalAuth.isEnrolledAsync(),
      LocalAuth.supportedAuthenticationTypesAsync(),
    ]);
    if (!hardware || !enrolled) return null;
    const face = types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION);
    if (Platform.OS === 'ios') {
      return face
        ? { name: 'Face ID', phrase: 'Face ID', icon: 'faceid' }
        : { name: 'Touch ID', phrase: 'Touch ID', icon: 'fingerprint' };
    }
    return types.includes(LocalAuth.AuthenticationType.FINGERPRINT)
      ? { name: 'huella', phrase: 'tu huella', icon: 'fingerprint' }
      : { name: 'reconocimiento facial', phrase: 'tu rostro', icon: 'faceid' };
  } catch {
    return null;
  }
}

/** Email con el que está activo el ingreso biométrico, si hay. */
export async function getBiometricEmail(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(EMAIL_KEY);
  } catch {
    return null;
  }
}

/**
 * Guarda las credenciales detrás de la biometría. En iOS crear la entrada no pide Face ID, así que
 * se confirma antes con el sensor; en Android guardarla ya lo pide. Devuelve si quedó activo.
 */
export async function enableBiometricLogin(email: string, password: string, kind: BiometricKind) {
  if (!LocalAuth) return false;
  try {
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
    if (Platform.OS === 'ios') {
      const check = await LocalAuth.authenticateAsync({
        promptMessage: `Activar ${kind.name}`,
        cancelLabel: 'Cancelar',
        fallbackLabel: '',
      });
      if (!check.success) return false;
    }
    await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ email, password }), {
      requireAuthentication: true,
      authenticationPrompt: `Activar ${kind.name}`,
    });
    await SecureStore.setItemAsync(EMAIL_KEY, email);
    await SecureStore.deleteItemAsync(DECLINED_KEY);
    return true;
  } catch {
    return false;
  }
}

export type BiometricRead =
  | { status: 'ok'; email: string; password: string }
  /** La persona canceló o falló el sensor: se puede reintentar. */
  | { status: 'cancelled' }
  /** Las credenciales ya no existen (cambió la biometría del teléfono): quedó desactivado. */
  | { status: 'invalid' };

/** Pide la biometría y devuelve las credenciales guardadas. */
export async function readBiometricCredentials(): Promise<BiometricRead> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, {
      requireAuthentication: true,
      authenticationPrompt: 'Ingresar a nubapay',
    });
  } catch {
    return { status: 'cancelled' };
  }
  try {
    const parsed = raw ? (JSON.parse(raw) as { email?: string; password?: string }) : null;
    if (parsed?.email && parsed.password) {
      return { status: 'ok', email: parsed.email, password: parsed.password };
    }
  } catch {
    // Valor ilegible: se trata como inválido.
  }
  await disableBiometricLogin();
  return { status: 'invalid' };
}

export async function disableBiometricLogin() {
  await Promise.all([
    SecureStore.deleteItemAsync(CREDENTIALS_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(EMAIL_KEY).catch(() => {}),
  ]);
}

export async function declineBiometricOffer(email: string) {
  await SecureStore.setItemAsync(DECLINED_KEY, email).catch(() => {});
}

/** Deshace un "Ahora no": en el próximo ingreso con contraseña se vuelve a ofrecer. */
export async function allowBiometricOffer() {
  await SecureStore.deleteItemAsync(DECLINED_KEY).catch(() => {});
}

/**
 * Oferta pendiente después de ingresar con contraseña. Vive solo en memoria (nunca se persiste):
 * la pantalla de login la deja y el layout de la app la levanta al montar.
 */
let pendingOffer: { email: string; password: string } | null = null;

export function setPendingBiometricOffer(offer: { email: string; password: string } | null) {
  pendingOffer = offer;
}

export function peekPendingBiometricOffer() {
  return pendingOffer;
}

/** Hay que ofrecer activar la biometría para este email (hay sensor, no está activa ni la rechazó). */
export async function shouldOfferBiometrics(email: string) {
  const kind = await getBiometricKind();
  if (!kind) return false;
  const [enabled, declined] = await Promise.all([
    getBiometricEmail(),
    SecureStore.getItemAsync(DECLINED_KEY).catch(() => null),
  ]);
  return enabled !== email && declined !== email;
}
