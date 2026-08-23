import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, WPBooking } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

function Stepper({ label, display, onDec, onInc, canDec, colors }: any) {
  return (
    <View style={styles.stepRow}>
      <Text style={[styles.stepLabel, { color: colors.onSurface }]}>{label}</Text>
      <View style={styles.stepControls}>
        <Pressable onPress={onDec} disabled={canDec === false} style={[styles.stepBtn, { borderColor: colors.border, opacity: canDec === false ? 0.4 : 1 }]} testID={`trip-dec-${label}`}><MaterialCommunityIcons name="minus" size={18} color={colors.onSurface} /></Pressable>
        <Text style={[styles.stepVal, { color: colors.onSurface }]}>{display}</Text>
        <Pressable onPress={onInc} style={[styles.stepBtn, { borderColor: colors.border }]} testID={`trip-inc-${label}`}><MaterialCommunityIcons name="plus" size={18} color={colors.onSurface} /></Pressable>
      </View>
    </View>
  );
}

export default function TripPlanner() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState(dayjs().add(7, "day").startOf("day"));
  const [nights, setNights] = useState(3);
  const [notes, setNotes] = useState("");
  const [bookings, setBookings] = useState<WPBooking[]>([]);
  const [stayId, setStayId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { api.wpBookings().then(setBookings).catch(() => {}); }, []);

  const canSave = destination.trim().length >= 2;

  const pickBooking = (b: WPBooking) => {
    setStayId(b.stay_id);
    setDestination(b.location || b.stay_title);
    setStart(dayjs(b.check_in));
    setNights(b.nights);
  };

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await api.wpCreateTrip({ destination: destination.trim(), start_date: start.format("YYYY-MM-DD"), nights, notes: notes.trim(), stay_id: stayId });
      setDone(true);
    } catch { setSaving(false); }
  };

  if (done) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top, alignItems: "center", justifyContent: "center", padding: spacing.xl }]}>
        <View style={[styles.doneIcon, { backgroundColor: colors.brand }]}><MaterialCommunityIcons name="calendar-check" size={38} color={colors.onBrandPrimary} /></View>
        <Text style={[styles.doneTitle, { color: colors.onSurface }]}>Trip Planned</Text>
        <Text style={[styles.doneBody, { color: colors.muted }]}>Your trip to {destination.trim()} was added to your Upcoming Trips in the Evention Center.</Text>
        <View style={{ height: spacing.xl }} />
        <ForgeButton label="Open my calendar" fullWidth size="lg" testID="trip-open-cal" onPress={() => router.replace("/evention")} />
        <Pressable onPress={() => router.replace("/waypoint")} style={{ marginTop: spacing.md }}><Text style={[styles.link, { color: colors.brand }]}>Back to Waypoint</Text></Pressable>
      </View>
    );
  }

  const inputStyle = [styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }];

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="trip-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Trip Planner</Text>
          <Eyebrow>Plans land in your Evention calendar</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {bookings.length > 0 ? (
          <>
            <Text style={[styles.label, { color: colors.onSurface }]}>Plan from a booking</Text>
            {bookings.map((b) => (
              <Pressable key={b.id} testID={`trip-booking-${b.id}`} onPress={() => pickBooking(b)} style={[styles.bookingRow, { backgroundColor: stayId === b.stay_id ? colors.surfaceTertiary : colors.surfaceSecondary, borderColor: stayId === b.stay_id ? colors.brand : colors.border }]}>
                <MaterialCommunityIcons name="home-city-outline" size={18} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.bookingTitle, { color: colors.onSurface }]}>{b.stay_title}</Text>
                  <Text style={[styles.bookingMeta, { color: colors.muted }]}>{b.location} · {dayjs(b.check_in).format("MMM D")}</Text>
                </View>
                {stayId === b.stay_id ? <MaterialCommunityIcons name="check-circle" size={18} color={colors.brand} /> : null}
              </Pressable>
            ))}
          </>
        ) : null}

        <Text style={[styles.label, { color: colors.onSurface }]}>Destination</Text>
        <TextInput value={destination} onChangeText={setDestination} placeholder="Where are you headed?" placeholderTextColor={colors.muted} style={inputStyle} testID="trip-destination" />

        <View style={[styles.planBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Stepper label="Start" colors={colors} display={start.format("ddd, MMM D")}
            canDec={start.isAfter(dayjs().startOf("day"))}
            onDec={() => setStart((d) => d.subtract(1, "day").isBefore(dayjs().startOf("day")) ? d : d.subtract(1, "day"))}
            onInc={() => setStart((d) => d.add(1, "day"))} />
          <Stepper label="Nights" colors={colors} display={String(nights)}
            canDec={nights > 1}
            onDec={() => setNights((n) => Math.max(1, n - 1))}
            onInc={() => setNights((n) => Math.min(90, n + 1))} />
        </View>

        <Text style={[styles.label, { color: colors.onSurface }]}>Plan &amp; notes</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Activities, packing list, things to remember…" placeholderTextColor={colors.muted} multiline style={[inputStyle, { minHeight: 130, textAlignVertical: "top", paddingTop: spacing.md, lineHeight: 22 }]} testID="trip-notes" />
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <ForgeButton label={saving ? "Saving…" : "Add to my trips"} fullWidth size="lg" disabled={!canSave || saving} testID="trip-save" onPress={save} icon={<MaterialCommunityIcons name="calendar-plus" size={18} color={colors.onBrandPrimary} />} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13.5, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  bookingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  bookingTitle: { fontFamily: fonts.bodyBold, fontSize: 14 },
  bookingMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  planBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  stepLabel: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  stepControls: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepVal: { fontFamily: fonts.bodyBold, fontSize: 14.5, minWidth: 108, textAlign: "center" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
  doneIcon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontFamily: fonts.display, fontSize: 26, marginTop: spacing.lg },
  doneBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: spacing.sm },
  link: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
});
