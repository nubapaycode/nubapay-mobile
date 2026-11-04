import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/dashboard/icon';
import { NavCard } from '@/components/ui/nav-card';
import { Sheet, useSheet } from '@/components/ui/sheet';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { initials } from '@/features/dashboard/format';
import { useAuth } from '@/providers/auth-provider';
import { makeStyles, useTheme } from '@/theme';

const HELP_URL = 'https://www.nubapay.app/ayuda';

/** Hoja de perfil (botón de arriba a la derecha): cuenta, accesos a Cobros y Ayuda, y cerrar sesión. */
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
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
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

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          dismiss(() => signOut());
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.logout, pressed && { backgroundColor: colors.dangerMuted }]}>
        <Icon name="logout" size={16} color={colors.danger} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
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

    menu: { gap: 10 },
    logout: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    logoutText: { color: c.danger, fontSize: 15, fontFamily: DisplayFont.semibold },
  }),
);
