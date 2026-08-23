import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { api } from "@/src/api/client";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type Props = {
  category: string; // district name, e.g. "Bazaar" or "Waypoint"
  title: string; // the item's title
  context?: string; // optional first-post body
};

/** Routes a specific item into the Roundtable — creating or joining a thread about it. */
export function DiscussItemButton({ category, title, context }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const discuss = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.rtDiscuss(category, `Discuss: ${title}`, context);
      if (res.thread_id) router.push(`/roundtable/thread/${res.thread_id}`);
      else router.push(`/roundtable/discuss?category=${encodeURIComponent(category)}`);
    } catch {
      router.push(`/roundtable/discuss?category=${encodeURIComponent(category)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable onPress={discuss} disabled={busy} testID="discuss-item" style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.brand }]}>
      <MaterialCommunityIcons name="forum-outline" size={18} color={colors.brand} />
      <Text style={[styles.label, { color: colors.brand }]}>{busy ? "Opening…" : "Discuss"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14 },
});
