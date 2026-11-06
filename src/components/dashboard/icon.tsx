import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/theme';

/** Íconos semánticos → SF Symbols (iOS) / Material Symbols (Android). */
const ICONS = {
  chevronDown: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left' },
  chevronUpDown: { ios: 'chevron.up.chevron.down', android: 'unfold_more' },
  ticket: { ios: 'ticket', android: 'confirmation_number' },
  scan: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' },
  bar: { ios: 'wineglass', android: 'local_bar' },
  store: { ios: 'storefront', android: 'storefront' },
  cash: { ios: 'banknote', android: 'payments' },
  clock: { ios: 'clock', android: 'schedule' },
  people: { ios: 'person.2', android: 'group' },
  up: { ios: 'arrow.up.right', android: 'trending_up' },
  down: { ios: 'arrow.down.right', android: 'trending_down' },
  bolt: { ios: 'bolt.fill', android: 'bolt' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  cart: { ios: 'cart', android: 'shopping_cart' },
  receipt: { ios: 'receipt', android: 'receipt_long' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  sun: { ios: 'sun.max', android: 'light_mode' },
  moon: { ios: 'moon', android: 'dark_mode' },
  auto: { ios: 'circle.lefthalf.filled', android: 'contrast' },
  plus: { ios: 'plus', android: 'add' },
  minus: { ios: 'minus', android: 'remove' },
  trash: { ios: 'trash', android: 'delete' },
  checkmark: { ios: 'checkmark', android: 'check' },
  bank: { ios: 'building.columns', android: 'account_balance' },
  help: { ios: 'questionmark.circle', android: 'help' },
  external: { ios: 'arrow.up.right', android: 'arrow_outward' },
  pencil: { ios: 'pencil', android: 'edit' },
  calendar: { ios: 'calendar', android: 'calendar_today' },
  filter: { ios: 'slider.horizontal.3', android: 'tune' },
  card: { ios: 'creditcard', android: 'credit_card' },
  percent: { ios: 'percent', android: 'percent' },
  eye: { ios: 'eye', android: 'visibility' },
  home: { ios: 'house', android: 'home' },
  homeFill: { ios: 'house.fill', android: 'home' },
  operations: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' },
  team: { ios: 'person.2', android: 'group' },
  teamFill: { ios: 'person.2.fill', android: 'group' },
  more: { ios: 'square.grid.2x2', android: 'apps' },
  moreFill: { ios: 'square.grid.2x2.fill', android: 'apps' },
  qr: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner' },
  close: { ios: 'xmark', android: 'close' },
  flashlight: { ios: 'flashlight.off.fill', android: 'flashlight_off' },
  userPlus: { ios: 'person.badge.plus', android: 'person_add' },
  search: { ios: 'magnifyingglass', android: 'search' },
  clearCircle: { ios: 'xmark.circle.fill', android: 'cancel' },
  person: { ios: 'person.crop.circle', android: 'account_circle' },
  mail: { ios: 'envelope', android: 'mail' },
  copy: { ios: 'doc.on.doc', android: 'content_copy' },
  photo: { ios: 'photo', android: 'image' },
  camera: { ios: 'camera', android: 'photo_camera' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off' },
  combo: { ios: 'square.stack.3d.up', android: 'layers' },
  tag: { ios: 'tag', android: 'sell' },
  message: { ios: 'message', android: 'chat' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo' },
  flashlightOn: { ios: 'flashlight.on.fill', android: 'flashlight_on' },
  arrowUp: { ios: 'arrow.up', android: 'arrow_upward' },
  arrowDown: { ios: 'arrow.down', android: 'arrow_downward' },
  blocks: { ios: 'rectangle.stack', android: 'view_agenda' },
  lock: { ios: 'lock', android: 'lock' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
  back: { ios: 'arrow.left', android: 'arrow_back' },
  key: { ios: 'key', android: 'key' },
  alert: { ios: 'exclamationmark.circle', android: 'error' },
  faceid: { ios: 'faceid', android: 'face' },
  fingerprint: { ios: 'touchid', android: 'fingerprint' },
  shield: { ios: 'lock.shield', android: 'shield' },
  sound: { ios: 'speaker.wave.2', android: 'volume_up' },
  chevronsRight: { ios: 'chevron.right.2', android: 'keyboard_double_arrow_right' },
  wifiOff: { ios: 'wifi.slash', android: 'wifi_off' },
  wifi: { ios: 'wifi', android: 'wifi' },
  send: { ios: 'paperplane.fill', android: 'send' },
  grip: { ios: 'line.3.horizontal', android: 'drag_handle' },
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 16,
  color,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color ?? colors.textSecondary}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}
