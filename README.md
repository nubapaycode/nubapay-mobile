# Nubapay Business (mobile)

App móvil para organizadores de Nubapay. Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # ajustar EXPO_PUBLIC_API_URL
npm start                     # luego i (iOS), a (Android) o escanear el QR con Expo Go
```

El backend Flask (`nubapay-backend`) tiene que estar corriendo en el puerto 5001. En un
dispositivo físico, `EXPO_PUBLIC_API_URL` tiene que ser la IP LAN de tu máquina
(ej. `http://192.168.0.10:5001`); en el emulador de Android, `http://10.0.2.2:5001`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Dev server de Metro |
| `npm run ios` / `npm run android` | Abre en simulador/emulador |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npx expo install <pkg>` | Instala dependencias compatibles con el SDK (usar siempre en vez de `npm i`) |

## Estructura

```
src/
  app/                 # rutas (Expo Router)
    _layout.tsx        # providers + Stack.Protected según haya sesión
    (auth)/login.tsx   # login contra POST /api/auth/login
    (app)/index.tsx    # inicio (requiere sesión)
  components/ui/       # primitivos (Button, TextField)
  constants/theme.ts   # colores, espaciados (alineados con el panel web)
  lib/api.ts           # apiUrl() + apiFetch() → { ok, data } | { ok: false, error }
  lib/api/paths.ts     # rutas del backend centralizadas
  lib/authSession.ts   # token/usuario en SecureStore (Keychain/Keystore)
  providers/auth-provider.tsx  # useAuth(): signIn, signOut, user, token
```

La sesión se valida al abrir la app con `GET /api/auth/me`; si el backend devuelve un token
renovado (sesión deslizante) se guarda. Solo 401/404 cierran la sesión.
