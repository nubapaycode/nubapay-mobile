import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppearancePicker } from '@/components/ui/appearance-picker';
import { LogoutButton } from '@/components/ui/logout-button';
import { NavCard } from '@/components/ui/nav-card';
import { Sheet, useSheet } from '@/components/ui/sheet';
import { DisplayFont, Spacing } from '@/constants/theme';
import { initials } from '@/features/dashboard/format';
import { useAuth } from '@/providers/auth-provider';
import { makeStyles, useTheme } from '@/theme';

const HELP_URL = 'https://www.nubapay.app/ayuda';


/** Hoja de perfil (botón de arriba a la izquierda): cuenta, apariencia, accesos a Cobros y Ayuda, y cerrar sesión. */
export default function ProfileSheet() {
  return (
    <Sheet>
      <ProfileContent />
    </Sheet>
  );
}

function ProfileContent() {
  const styles = useStyles();
  const { dismiss } = useSheet();
  const { colors, preference, setPreference } = useTheme();
  const { user } = useAuth();
  const name = user?.name ?? 'Organizador';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.account}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(name) || '·'}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {user?.email ? (
            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.appearance}>
        <Text style={styles.sectionTitle}>Apariencia</Text>
        <AppearancePicker value={preference} onChange={setPreference} />
        {preference === 'system' ? (
          <Text style={styles.hint}>Automático sigue el modo claro u oscuro de tu teléfono.</Text>
        ) : null}
      </View>

      <View style={styles.menu}>
        <NavCard
          icon="bank"
          title="Cobros"
          subtitle="Métodos de pago y comisión"
          onPress={() => dismiss(() => router.push('/payouts'))}
        />
        <NavCard
          icon="help"
          title="Ayuda"
          subtitle="Preguntas frecuentes y soporte"
          external
          onPress={() =>
            WebBrowser.openBrowserAsync(HELP_URL, {
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
              controlsColor: colors.primary,
            })
          }
        />
      </View>

      <LogoutButton onPress={(signOut) => dismiss(signOut)} />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flexGrow: 0 },
    content: { padding: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },

    account: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.text,
    },
    avatarText: { color: c.surface, fontSize: 18, fontFamily: DisplayFont.bold },
    name: { color: c.text, fontSize: 20, fontFamily: DisplayFont.bold, letterSpacing: -0.4 },
    email: { color: c.textMuted, fontSize: 13 },

    appearance: { gap: 12 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
    hint: { color: c.textMuted, fontSize: 12 },
    menu: { gap: 10 },
  }),
);
