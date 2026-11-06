export { AuthField } from './auth-field';
export { AuthScreen, AuthTitle } from './auth-screen';
export { PillButton } from './pill-button';

/** Validación mínima de email para avanzar de paso (el backend valida en serio). */
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
