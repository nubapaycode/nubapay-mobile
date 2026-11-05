import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/dashboard/icon";
import { DisplayFont, Radius } from "@/constants/theme";
import { formatTime } from "@/features/manage/promo";
import { makeStyles, useTheme } from "@/theme";

/**
 * Solo hora, con su etiqueta arriba ("Desde" / "Hasta"). En iOS, el picker compacto nativo; en
 * Android, un botón que abre el diálogo nativo de hora (24 h).
 */
export function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === "ios" ? (
        <View style={styles.iosRow}>
          <DateTimePicker
            value={value}
            mode="time"
            display="compact"
            accentColor={colors.primary}
            locale="es_AR"
            onValueChange={(_, d) => onChange(d)}
          />
        </View>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${formatTime(value)}. Cambiar`}
            onPress={() => setOpen(true)}
            style={({ pressed }) => [
              styles.chip,
              pressed && { backgroundColor: colors.border },
            ]}
          >
            <Icon name="clock" size={15} color={colors.ink} />
            <Text style={styles.chipText}>{formatTime(value)}</Text>
          </Pressable>
          {open ? (
            <DateTimePicker
              value={value}
              mode="time"
              is24Hour
              accentColor={colors.primary}
              onValueChange={(_, d) => {
                setOpen(false);
                onChange(d);
              }}
              onDismiss={() => setOpen(false)}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { flex: 1, gap: 6 },
    label: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    iosRow: { flexDirection: "row", alignItems: "center", minHeight: 40 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: Radius.md,
      backgroundColor: c.raised,
    },
    chipText: {
      color: c.ink,
      fontSize: 17,
      fontFamily: DisplayFont.semibold,
      fontVariant: ["tabular-nums"],
    },
  }),
);
