import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { api } from "@/src/api/client";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type Props = {
  source: "bazaar" | "frankenstein" | "bluepaint" | "other";
  refId: string;
  title: string;
  imageUrl?: string;
  subtitle?: string;
  route?: string;
  compact?: boolean; // icon-only pill
};

/** Reusable "Save to Vault" control. Reflects saved state and toggles it. */
export function SaveToVaultButton({ source, refId, title, imageUrl = "", subtitle = "", route = "", compact = false }: Props) {
  const { colors } = useTheme();
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.vaultSavedCheck(source, refId).then((r) => { if (alive) { setSaved(r.saved); setSavedId(r.id); } }).catch(() => {});
    return () => { alive = false; };
  }, [source, refId]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (saved && savedId) {
        await api.vaultDeleteItem(savedId);
        setSaved(false); setSavedId(null);
      } else {
        const res = await api.vaultSave({ source, ref_id: refId, title, image_url: imageUrl, subtitle, route });
        setSaved(true); setSavedId(res.item.id);
      }
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  if (compact) {
    return (
      <Pressable onPress={toggle} hitSlop={8} testID="save-to-vault" style={[styles.compact, { backgroundColor: colors.surface }]}>
        <MaterialCommunityIcons name={saved ? "bookmark" : "bookmark-outline"} size={18} color={saved ? colors.brand : colors.onSurface} />
      </Pressable>
    );
  }
  return (
    <Pressable onPress={toggle} testID="save-to-vault" style={[styles.btn, { backgroundColor: saved ? colors.surfaceSecondary : colors.surface, borderColor: colors.brand }]}>
      <MaterialCommunityIcons name={saved ? "bookmark-check" : "bookmark-plus-outline"} size={18} color={colors.brand} />
      <Text style={[styles.label, { color: colors.brand }]}>{saved ? "Saved to Vault" : "Save to Vault"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14 },
  compact: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 5, elevation: 3 },
});
