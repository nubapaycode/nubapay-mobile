import { type Href, Link } from 'expo-router';
import type { ComponentProps, ReactElement } from 'react';
import { Platform } from 'react-native';

export type PreviewAction = {
  title: string;
  icon?: ComponentProps<typeof Link.MenuAction>['icon'];
  destructive?: boolean;
  onPress: () => void;
};

/** La vista previa nativa (mantener apretado) solo existe en iOS. */
export const hasLinkPreview = Platform.OS === 'ios';

/**
 * Mantener apretado una card muestra el detalle flotando (la pantalla real, ya cargándose) con
 * acciones rápidas abajo, como en Mail o Fotos; tocar la vista previa la abre. Un toque normal
 * navega a `href`. En Android devuelve la card tal cual (su `onPress` sigue navegando).
 *
 * Con esto activo, el `onPress` del hijo NO debe navegar (lo hace el Link): solo feedback.
 */
export function PreviewLink({
  href,
  actions,
  disabled = false,
  zoom = false,
  children,
}: {
  href: Href;
  actions: PreviewAction[];
  /** Sin vista previa (la card se comporta como siempre). */
  disabled?: boolean;
  /**
   * Abre el destino con el zoom nativo (iOS 18+): la card crece hasta ser la pantalla. Con zoom no
   * hay vista previa flotante (Expo la permite solo hacia modales): mantener apretado levanta la
   * card con el menú de acciones. El destino no debe tener la barra de navegación nativa.
   */
  zoom?: boolean;
  children: ReactElement;
}) {
  if (!hasLinkPreview || disabled) return children;
  return (
    <Link href={href} asChild>
      <Link.Trigger withAppleZoom={zoom}>{children}</Link.Trigger>
      {zoom ? null : <Link.Preview />}
      {actions.length ? (
        <Link.Menu>
          {actions.map((a) => (
            <Link.MenuAction
              key={a.title}
              title={a.title}
              icon={a.icon}
              destructive={a.destructive}
              onPress={a.onPress}
            />
          ))}
        </Link.Menu>
      ) : null}
    </Link>
  );
}
