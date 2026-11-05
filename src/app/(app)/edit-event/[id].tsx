import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { EventForm } from '@/components/events/event-form';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';
import { type EventDetail, getEvent } from '@/lib/api/organizer';
import { useQuery } from '@/lib/query';
import { makeStyles, useTheme } from '@/theme';

/** Editar evento: carga el evento (GET /api/events/<id>) y abre el formulario con sus datos. */
export default function EditEventScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useQuery<EventDetail>(id ? `event:${id}` : null, () => getEvent(id));
  useFocusStatusBar();

  if (!detail.data) {
    return (
      <View style={styles.missing}>
        {detail.error ? (
          <Text style={styles.missingText}>{detail.error}</Text>
        ) : (
          <ActivityIndicator color={colors.textMuted} />
        )}
      </View>
    );
  }
  // El formulario arranca con los datos ya cargados (y se reinicia si cambia el evento).
  return <EventForm key={detail.data.id} event={detail.data} />;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
    missingText: { color: c.textSecondary, fontSize: 15 },
  }),
);
