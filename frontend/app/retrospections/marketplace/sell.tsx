import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { catMeta } from "@/src/utils/retro";

export default function SellBusiness() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cats, setCats] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [cat, setCat] = useState("");
  const [price, setPrice] = useState("");
  const [loc, setLoc] = useState("");
  const [revenue, setRevenue] = useState("");
  const [desc, setDesc] = useState("");
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.retroMeta().then((m) => setCats(m.categories)).catch(() => {}); }, []);

  const canSave = name.trim() && cat && price.trim() && contact.trim();

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const l = await api.retroCreateListing({
        name: name.trim(), category: cat, asking_price: price.trim(), location: loc.trim(),
        description: desc.trim(), reason: reason.trim(), revenue: revenue.trim(), contact: contact.trim(),
      });
      router.replace(`/retrospections/marketplace/${l.id}`);
    } catch (e: any) { Alert.alert("Couldn't list", e?.message || "Try again."); }
    finally { setSaving(false); }
  };

  const field = (label: string, value: string, setter: (t: string) => void, placeholder: string, opts: { multiline?: boolean; testID?: string } = {}) => (
    <>
      <Text style={[styles.label, { color: colors.onSurface }]}>{label}</Text>
      <TextInput value={value} onChangeText={setter} placeholder={placeholder} placeholderTextColor={colors.muted}
        multiline={opts.multiline} testID={opts.testID}
        style={[styles.input, opts.multiline && { minHeight: 84, textAlignVertical: "top" }, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="sell-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Put a Business Up for Sale</Text>
          <Eyebrow>Commercial Marketplace</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        {field("Business name *", name, setName, "e.g. The Copper Spoon Diner", { testID: "sell-name" })}

        <Text style={[styles.label, { color: colors.onSurface }]}>Category *</Text>
        <View style={styles.catWrap}>
          {cats.map((c) => {
            const m = catMeta(c); const active = cat === c;
            return (
              <Pressable key={c} onPress={() => setCat(c)} style={[styles.catPill, { backgroundColor: active ? m.color : colors.surfaceSecondary, borderColor: active ? m.color : colors.border }]} testID={`sell-cat-${c}`}>
                <MaterialCommunityIcons name={m.icon} size={13} color={active ? "#fff" : m.color} />
                <Text style={[styles.catText, { color: active ? "#fff" : colors.onSurface }]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        {field("Asking price *", price, setPrice, "e.g. £120,000", { testID: "sell-price" })}
        {field("Location", loc, setLoc, "Street & area", { testID: "sell-loc" })}
        {field("Annual revenue (optional)", revenue, setRevenue, "e.g. £180k / yr", { testID: "sell-rev" })}
        {field("Description", desc, setDesc, "What's included, footfall, lease terms…", { multiline: true, testID: "sell-desc" })}
        {field("Reason for selling", reason, setReason, "e.g. Retiring after 20 years", { testID: "sell-reason" })}
        {field("Contact *", contact, setContact, "Email or phone for buyers", { testID: "sell-contact" })}

        <Pressable onPress={submit} disabled={!canSave || saving} style={[styles.saveBtn, { backgroundColor: canSave ? colors.brand : colors.surfaceTertiary }]} testID="sell-submit">
          <Text style={[styles.saveText, { color: canSave ? colors.onBrandPrimary : colors.muted }]}>{saving ? "Listing…" : "List business for sale"}</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13.5, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15 },
  catWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  catPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1 },
  catText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  saveBtn: { height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
