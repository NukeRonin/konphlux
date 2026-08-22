import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, RetroBusiness } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { catMeta } from "@/src/utils/retro";

export default function SubmitReview() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"pick" | "new">("pick");
  const [q, setQ] = useState("");
  const [list, setList] = useState<RetroBusiness[]>([]);
  const [cats, setCats] = useState<string[]>([]);

  // new place form
  const [name, setName] = useState("");
  const [cat, setCat] = useState("");
  const [addr, setAddr] = useState("");
  const [desc, setDesc] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const search = useCallback(async (query: string) => {
    try { setList(await api.retroBusinesses({ q: query })); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    api.retroMeta().then((m) => setCats(m.categories)).catch(() => {});
    search("");
  }, [search]);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      let ok = status === "granted";
      if (!ok && canAskAgain) {
        const req = await Location.requestForegroundPermissionsAsync();
        ok = req.status === "granted";
      }
      if (!ok) {
        Alert.alert("Location off", "Enable location to tag this place, or just add it without coordinates.", [
          { text: "OK" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch { Alert.alert("Couldn't locate", "Add the place without coordinates for now."); }
    finally { setLocating(false); }
  };

  const createPlace = async () => {
    if (!name.trim() || !cat || saving) return;
    setSaving(true);
    try {
      const b = await api.retroCreateBusiness({
        name: name.trim(), category: cat, address: addr.trim(), description: desc.trim(),
        lat: coords?.lat ?? null, lng: coords?.lng ?? null,
      });
      router.replace(`/retrospections/business/${b.id}`);
    } catch (e: any) { Alert.alert("Couldn't add", e?.message || "Try again."); }
    finally { setSaving(false); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="submit-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Submit a Review</Text>
          <Eyebrow>Retrospections</Eyebrow>
        </View>
      </View>

      <View style={styles.segment}>
        {(["pick", "new"] as const).map((mkey) => (
          <Pressable key={mkey} onPress={() => setMode(mkey)} style={[styles.segBtn, { backgroundColor: mode === mkey ? colors.brand : colors.surfaceSecondary, borderColor: mode === mkey ? colors.brand : colors.border }]} testID={`submit-mode-${mkey}`}>
            <Text style={[styles.segText, { color: mode === mkey ? colors.onBrandPrimary : colors.onSurface }]}>{mkey === "pick" ? "Find a place" : "Add a new place"}</Text>
          </Pressable>
        ))}
      </View>

      {mode === "pick" ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.searchRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
            <TextInput value={q} onChangeText={(t) => { setQ(t); search(t); }} placeholder="Search a business to review" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.onSurface }]} testID="submit-search" />
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.hint, { color: colors.muted }]}>Pick the place you visited to leave your rating and review.</Text>
            {list.map((b) => {
              const m = catMeta(b.category);
              return (
                <Pressable key={b.id} onPress={() => router.push(`/retrospections/business/${b.id}`)} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`submit-pick-${b.id}`}>
                  <View style={[styles.rowIcon, { backgroundColor: `${m.color}22` }]}>
                    <MaterialCommunityIcons name={m.icon} size={18} color={m.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.onSurface }]} numberOfLines={1}>{b.name}</Text>
                    <Text style={[styles.rowMeta, { color: colors.muted }]} numberOfLines={1}>{b.category}{b.address ? ` · ${b.address}` : ""}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              );
            })}
            {list.length === 0 ? <Text style={[styles.hint, { color: colors.muted, textAlign: "center", marginTop: spacing.lg }]}>No matches. Try &quot;Add a new place&quot;.</Text> : null}
          </ScrollView>
        </View>
      ) : (
        <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.label, { color: colors.onSurface }]}>Business name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. The Brass Kettle" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="new-name" />

          <Text style={[styles.label, { color: colors.onSurface }]}>Category</Text>
          <View style={styles.catWrap}>
            {cats.map((c) => {
              const m = catMeta(c); const active = cat === c;
              return (
                <Pressable key={c} onPress={() => setCat(c)} style={[styles.catPill, { backgroundColor: active ? m.color : colors.surfaceSecondary, borderColor: active ? m.color : colors.border }]} testID={`new-cat-${c}`}>
                  <MaterialCommunityIcons name={m.icon} size={13} color={active ? "#fff" : m.color} />
                  <Text style={[styles.catText, { color: active ? "#fff" : colors.onSurface }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.onSurface }]}>Address (optional)</Text>
          <TextInput value={addr} onChangeText={setAddr} placeholder="Street & area" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="new-addr" />

          <Text style={[styles.label, { color: colors.onSurface }]}>About (optional)</Text>
          <TextInput value={desc} onChangeText={setDesc} placeholder="A line about the place" placeholderTextColor={colors.muted} multiline style={[styles.input, { minHeight: 64, textAlignVertical: "top", backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="new-desc" />

          <Pressable onPress={useMyLocation} style={[styles.locBtn, { borderColor: coords ? colors.brand : colors.border, backgroundColor: colors.surfaceSecondary }]} testID="new-locate">
            <MaterialCommunityIcons name={coords ? "map-marker-check" : "crosshairs-gps"} size={18} color={coords ? colors.brand : colors.onSurface} />
            <Text style={[styles.locText, { color: coords ? colors.brand : colors.onSurface }]}>{locating ? "Locating…" : coords ? "Location tagged" : "Use my location (so it shows on the map)"}</Text>
          </Pressable>

          <Pressable onPress={createPlace} disabled={!name.trim() || !cat || saving} style={[styles.saveBtn, { backgroundColor: name.trim() && cat ? colors.brand : colors.surfaceTertiary }]} testID="new-create">
            <Text style={[styles.saveText, { color: name.trim() && cat ? colors.onBrandPrimary : colors.muted }]}>{saving ? "Adding…" : "Add place & write review"}</Text>
          </Pressable>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  segment: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  segBtn: { flex: 1, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  segText: { fontFamily: fonts.bodyBold, fontSize: 13.5 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, height: 46, borderRadius: radius.md, borderWidth: 1 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.sm, paddingRight: spacing.md, marginBottom: spacing.sm },
  rowIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  rowMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13.5, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15 },
  catWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  catPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1 },
  catText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  locBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, marginTop: spacing.lg },
  locText: { fontFamily: fonts.bodyMedium, fontSize: 13.5, flex: 1 },
  saveBtn: { height: 50, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
