import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, EventionReminder } from "@/src/api/client";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const POLL_MS = 60000;
const TYPE_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  interview: "account-tie", meeting: "account-group", flight: "airplane",
  appointment: "clock-outline", event: "calendar-star", birthday: "cake-variant",
};

/**
 * Global in-app "Smart Reminders" banner from Clarity (Evention Center's Timekeeper).
 * Polls for calendar items starting soon and slides a helpful pop-up in from the top,
 * no matter which screen the user is on. Each reminder is fired once (marked server-side).
 */
export default function SmartReminders() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<EventionReminder[]>([]);
  const [current, setCurrent] = useState<EventionReminder | null>(null);
  const shown = useRef<Set<string>>(new Set());
  const anim = useRef(new Animated.Value(0)).current;

  const poll = useCallback(async () => {
    try {
      const { reminders } = await api.eventionRemindersDue();
      const fresh = reminders.filter((r) => !shown.current.has(r.id));
      if (fresh.length) {
        fresh.forEach((r) => shown.current.add(r.id));
        setQueue((q) => [...q, ...fresh]);
      }
    } catch { /* silent — reminders are best-effort */ }
  }, []);

  // Poll on an interval + when the app returns to the foreground.
  useEffect(() => {
    const t = setTimeout(poll, 6000);
    const iv = setInterval(poll, POLL_MS);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") poll(); });
    return () => { clearTimeout(t); clearInterval(iv); sub.remove(); };
  }, [poll]);

  // Promote the next queued reminder when nothing is showing.
  useEffect(() => {
    if (!current && queue.length) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, current]);

  // Slide in / auto-dismiss.
  const dismiss = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      .start(() => setCurrent(null));
  }, [anim]);

  useEffect(() => {
    if (!current) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const auto = setTimeout(dismiss, 9000);
    return () => clearTimeout(auto);
  }, [current, anim, dismiss]);

  if (!current) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] });
  const open = () => { dismiss(); router.push("/evention"); };

  return (
    <Animated.View
      style={[styles.wrap, { paddingTop: insets.top + spacing.sm, transform: [{ translateY }], opacity: anim }]}
    >
      <Pressable
        onPress={open}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: current.color, shadowColor: "#000" }]}
        testID="smart-reminder"
      >
        <View style={[styles.avatar, { backgroundColor: `${current.color}22`, borderColor: current.color }]}>
          <MaterialCommunityIcons name="clock-alert-outline" size={20} color={current.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={[styles.name, { color: colors.onSurface }]}>Clarity</Text>
            <Text style={[styles.role, { color: colors.muted }]}>· Timekeeper</Text>
            <View style={{ flex: 1 }} />
            <MaterialCommunityIcons name={TYPE_ICON[current.type] || "calendar"} size={14} color={current.color} />
          </View>
          <Text style={[styles.msg, { color: colors.onSurface }]}>{current.message}</Text>
          <Text style={[styles.hint, { color: colors.muted }]}>Tap to open your calendar</Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={10} style={styles.close} testID="smart-reminder-dismiss">
          <MaterialCommunityIcons name="close" size={18} color={colors.muted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: spacing.md, zIndex: 9999, elevation: 9999, pointerEvents: "box-none" },
  card: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5,
    padding: spacing.md,
    ...Platform.select({
      ios: { shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
      default: {},
    }),
  },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  topRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { fontFamily: fonts.displaySemi, fontSize: 14 },
  role: { fontFamily: fonts.body, fontSize: 12 },
  msg: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, marginTop: 3 },
  hint: { fontFamily: fonts.body, fontSize: 11.5, marginTop: 4 },
  close: { padding: 2 },
});
