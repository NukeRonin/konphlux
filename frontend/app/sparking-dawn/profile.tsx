import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, uploadImage } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const GENDERS = [
  { key: "man", label: "Man" },
  { key: "woman", label: "Woman" },
  { key: "nonbinary", label: "Non-binary" },
];
const SEEK = [
  { key: "man", label: "Men" },
  { key: "woman", label: "Women" },
];

export default function DatingProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [gender, setGender] = useState("man");
  const [seeking, setSeeking] = useState<string[]>(["woman"]);
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState("");
  const [photo, setPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.datingMe().then((p) => {
      if (p) {
        setGender(p.gender);
        setSeeking(p.seeking?.length ? p.seeking : ["woman"]);
        setTagline(p.tagline ?? "");
        setBio(p.bio ?? "");
        setAge(p.age ? String(p.age) : "");
        setPhoto(p.photo ?? "");
      }
    }).catch(() => {});
  }, []);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadImage(res.assets[0].uri, Platform.OS === "web");
      setPhoto(url);
    } catch {
      setError("Couldn't upload that photo. Try another.");
    } finally {
      setUploading(false);
    }
  };

  const toggleSeek = (k: string) =>
    setSeeking((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const save = async () => {
    setError("");
    if (seeking.length === 0) return setError("Pick who you'd like to meet.");
    setBusy(true);
    try {
      await api.datingSaveProfile({
        gender,
        seeking,
        tagline: tagline.trim(),
        bio: bio.trim(),
        photo,
        age: age ? parseInt(age, 10) : null,
      });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save your profile.");
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="dp-close">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Your Spark Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <Pressable testID="dp-photo" onPress={pickPhoto} style={[styles.photoBox, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialCommunityIcons name={uploading ? "progress-upload" : "camera-plus"} size={34} color={colors.muted} />
              <Text style={[styles.photoHint, { color: colors.muted }]}>{uploading ? "Uploading…" : "Add a photo"}</Text>
            </View>
          )}
        </Pressable>

        <Eyebrow style={{ marginTop: spacing.lg }}>I am a</Eyebrow>
        <View style={styles.chipRow}>
          {GENDERS.map((g) => (
            <Pressable key={g.key} testID={`dp-gender-${g.key}`} onPress={() => setGender(g.key)} style={[styles.chip, { backgroundColor: gender === g.key ? colors.brand : colors.surfaceSecondary, borderColor: gender === g.key ? colors.brand : colors.border }]}>
              <Text style={[styles.chipText, { color: gender === g.key ? colors.onBrandPrimary : colors.onSurface }]}>{g.label}</Text>
            </Pressable>
          ))}
        </View>

        <Eyebrow style={{ marginTop: spacing.lg }}>Looking for</Eyebrow>
        <View style={styles.chipRow}>
          {SEEK.map((s) => (
            <Pressable key={s.key} testID={`dp-seek-${s.key}`} onPress={() => toggleSeek(s.key)} style={[styles.chip, { backgroundColor: seeking.includes(s.key) ? colors.brand : colors.surfaceSecondary, borderColor: seeking.includes(s.key) ? colors.brand : colors.border }]}>
              <Text style={[styles.chipText, { color: seeking.includes(s.key) ? colors.onBrandPrimary : colors.onSurface }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <Eyebrow style={{ marginTop: spacing.lg }}>Age (optional)</Eyebrow>
        <TextInput testID="dp-age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="e.g. 29" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} maxLength={3} />

        <Eyebrow style={{ marginTop: spacing.lg }}>Tagline</Eyebrow>
        <TextInput testID="dp-tagline" value={tagline} onChangeText={setTagline} placeholder="A short line that's very you" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} maxLength={120} />

        <Eyebrow style={{ marginTop: spacing.lg }}>About you</Eyebrow>
        <TextInput testID="dp-bio" value={bio} onChangeText={setBio} placeholder="Tell potential sparks about yourself…" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} />

        {error ? <Text testID="dp-error" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <ForgeButton label="Save profile" fullWidth size="lg" loading={busy} onPress={save} testID="dp-save" style={{ marginTop: spacing.xl }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 17 },
  body: { padding: spacing.lg },
  photoBox: { alignSelf: "center", width: 160, height: 160, borderRadius: 80, borderWidth: 1, overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  photoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  photoHint: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  chipRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  chip: { height: 42, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    marginTop: spacing.sm,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
});
