import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enter } from '@/components/dashboard/detail-kit';
import { DisplayFont, Spacing } from '@/constants/theme';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { makeStyles } from '@/theme';

/**
 * Página de una pestaña sobre el fondo del tema, con título grande propio (las pestañas no tienen header nativo)
 * y una acción opcional a la derecha del título.
 */
export function TabPage({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <TabPageContent title={title} subtitle={subtitle} right={right}>
      {children}
    </TabPageContent>
  );
}

function TabPageContent({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  useFocusStatusBar();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.three }]}
      contentInsetAdjustmentBehavior="never">
      <Animated.View entering={enter(0)} style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </Animated.View>
      {children}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.four },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
    title: { color: c.text, fontSize: 28, fontFamily: DisplayFont.bold, letterSpacing: -0.8 },
    subtitle: { color: c.textMuted, fontSize: 13 },
  }),
);
