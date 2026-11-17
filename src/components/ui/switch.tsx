import * as Haptics from 'expo-haptics';
import { Platform, Switch as RNSwitch, type SwitchProps } from 'react-native';

/**
 * `Switch` de la app. En iOS el interruptor nativo ya vibra al cambiar; en Android no, así que ahí
 * se agrega un toque suave para que se sienta igual en las dos plataformas.
 */
export function Switch({ onValueChange, ...rest }: SwitchProps) {
  return (
    <RNSwitch
      {...rest}
      onValueChange={
        onValueChange
          ? (v) => {
              if (Platform.OS === 'android') Haptics.selectionAsync();
              onValueChange(v);
            }
          : undefined
      }
    />
  );
}
