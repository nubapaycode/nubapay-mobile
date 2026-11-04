import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { enter } from '@/components/dashboard/detail-kit';
import { Icon } from '@/components/dashboard/icon';
import { DisplayFont, Radius, Spacing } from '@/constants/theme';
import { setRegretStatus, useRegrets } from '@/features/manage/manage';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { loadClipboard } from '@/lib/native-modules';
import { makeStyles, useTheme } from '@/theme';

const dateFmt = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Detalle de un arrepentimiento: qué pide el comprador, sus datos de contacto y el alias para
 * devolver el pago. Se marca como resuelta cuando ya se gestionó la devolución.
 * (Cancelar el QR del pedido se hace desde Operaciones → detalle del pedido.)
 */
export default function RegretScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { regrets, eventId } = useRegrets();
  const regret = regrets?.find((r) => r.id === id);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  useFocusStatusBar('dark');

  if (!regret) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>No encontramos esta solicitud.</Text>
      </View>
    );
  }
  const pending = regret.status === 'pending';

  const copyAlias = async () => {
    const Clipboard = await loadClipboard();
    if (!Clipboard) return;
    await Clipboard.setStringAsync(regret.bankAlias);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
  };

  const toggleStatus = () =>
    Alert.alert(
      pending ? 'Marcar como resuelta' : 'Volver a pendiente',
      pending
        ? '¿Ya devolviste el pago y cancelaste el pedido?'
        : 'La solicitud vuelve a la lista de pendientes.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: pending ? 'Marcar resuelta' : 'Volver a pendiente',
          onPress: async () => {
            if (!eventId) return;
            const res = await setRegretStatus(eventId, regret.id, pending ? 'resolved' : 'pending');
            if (!res.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('No se pudo actualizar', res.error);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );

  const whatsappNumber = regret.whatsapp.replace(/[^\d]/g, '');

  return (
    <>
      <Stack.Screen options={{ title: regret.fullName }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <Animated.View entering={enter(0)} style={styles.hero}>
          <Text style={styles.caption}>Solicitud del {dateFmt.format(new Date(regret.createdAt))}</Text>
          <Text style={styles.detail}>{regret.purchaseDetail}</Text>
          <Animated.View
            layout={LinearTransition.duration(260)}
            style={[styles.chip, pending ? styles.chipPending : styles.chipDone]}>
            <View style={[styles.dot, { backgroundColor: pending ? colors.brand : colors.textMuted }]} />
            <Text style={[styles.chipText, pending && { color: colors.brandText }]}>
              {pending ? 'Pendiente' : 'Resuelta'}
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Devolución: alias para copiar */}
        <Animated.View entering={enter(1)} style={styles.section}>
          <Text style={styles.sectionTitle}>Devolución</Text>
          <Pressable
            onPress={copyAlias}
            accessibilityRole="button"
            accessibilityLabel={`Alias ${regret.bankAlias}. Copiar`}
            style={({ pressed }) => [styles.alias, pressed && { opacity: 0.8 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.fieldLabel}>Alias o CBU</Text>
              <Text style={styles.aliasValue} selectable>
                {regret.bankAlias}
              </Text>
            </View>
            <Animated.View key={String(copied)} entering={FadeIn.duration(200)} style={styles.copyBtn}>
              <Icon name={copied ? 'checkmark' : 'copy'} size={13} color="#000000" />
              <Text style={styles.copyText}>{copied ? 'Copiado' : 'Copiar'}</Text>
            </Animated.View>
          </Pressable>
        </Animated.View>

        {/* Contacto */}
        <Animated.View entering={enter(2)} style={styles.section}>
          <Text style={styles.sectionTitle}>Contacto</Text>
          <View style={styles.card}>
            <ContactRow
              icon="mail"
              label="Email"
              value={regret.email}
              onPress={() => Linking.openURL(`mailto:${regret.email}`)}
            />
            <ContactRow
              icon="people"
              label="WhatsApp"
              value={regret.whatsapp}
              divider
              onPress={() => Linking.openURL(`https://wa.me/${whatsappNumber}`)}
            />
          </View>
        </Animated.View>

        {/* Comprobante */}
        <Animated.View entering={enter(3)} style={styles.section}>
          <Text style={styles.sectionTitle}>Comprobante</Text>
          <View style={styles.receipt}>
            <Icon name="receipt" size={18} color={colors.textMuted} />
            <Text style={styles.receiptText}>
              {regret.screenshotUrl ? 'Ver captura adjunta' : 'La captura se ve con el backend conectado'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={enter(4)}>
          <Pressable
            onPress={toggleStatus}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.action,
              pending ? styles.actionPrimary : styles.actionSecondary,
              pressed && { opacity: 0.85 },
            ]}>
            <Text style={[styles.actionText, !pending && styles.actionTextSecondary]}>
              {pending ? 'Marcar como resuelta' : 'Volver a pendiente'}
            </Text>
          </Pressable>
          <Text style={styles.note}>
            Para anular el QR, abrí el pedido desde Operaciones y cancelalo.
          </Text>
        </Animated.View>
      </ScrollView>
    </>
  );
}

function ContactRow({
  icon,
  label,
  value,
  divider,
  onPress,
}: {
  icon: 'mail' | 'people';
  label: string;
  value: string;
  divider?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="link"
      style={[styles.row, divider && styles.divider]}>
      <Icon name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
      <Icon name="external" size={12} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#ffffff' },
    content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: 28 },
    hero: { gap: 10, paddingHorizontal: 4 },
    caption: { color: c.textMuted, fontSize: 13 },
    detail: { color: c.text, fontSize: 19, lineHeight: 26, fontFamily: DisplayFont.semibold },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      paddingHorizontal: 8,
      height: 22,
      borderRadius: 7,
    },
    chipPending: { backgroundColor: c.brandMuted },
    chipDone: { backgroundColor: c.raised },
    dot: { width: 5, height: 5, borderRadius: 3 },
    chipText: { color: c.textSecondary, fontSize: 11, fontWeight: '700' },

    section: { gap: 8 },
    sectionTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: 4 },
    alias: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      backgroundColor: c.canvas,
    },
    fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    aliasValue: { color: c.text, fontSize: 18, fontFamily: DisplayFont.semibold },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 34,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      backgroundColor: '#ffffff',
    },
    copyText: { color: '#000000', fontSize: 13, fontFamily: DisplayFont.semibold },
    card: {
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle },
    rowLabel: { color: c.textSecondary, fontSize: 14 },
    rowValue: { flex: 1, textAlign: 'right', color: c.text, fontSize: 15, fontWeight: '500' },
    receipt: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 16,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: 'dashed',
    },
    receiptText: { color: c.textMuted, fontSize: 14 },
    action: {
      height: 54,
      borderRadius: Radius.xl,
      borderCurve: 'continuous',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionPrimary: { backgroundColor: '#000000' },
    actionSecondary: { backgroundColor: c.raised },
    actionText: { color: '#ffffff', fontSize: 16, fontFamily: DisplayFont.semibold },
    actionTextSecondary: { color: '#000000' },
    note: { color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 10 },
    missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
    missingText: { color: c.textSecondary, fontSize: 15 },
  }),
);
