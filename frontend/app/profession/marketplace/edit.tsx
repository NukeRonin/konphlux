import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ExperienceItem, Freelancer, uploadImage } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function EditResume() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [category, setCategory] = useState("Engineering");
  const [hourly, setHourly] = useState("");
  const [location, setLocation] = useState("");
  const [available, setAvailable] = useState(true);
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [uploading, setUploading] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [experience, setExperience] = useState<ExperienceItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [meta, me] = await Promise.all([api.jobMeta(), api.freelancerMe()]);
      setCategories(meta.categories);
      const p = me as Freelancer;
      if (p && p.id) {
        setName(p.name); setHeadline(p.headline); setCategory(p.category || meta.categories[0]);
        setHourly(p.hourly_rate ? String(p.hourly_rate) : ""); setLocation(p.location);
        setAvailable(p.available); setBio(p.bio); setAvatar(p.avatar_url);
        setSkills(p.skills || []); setLinks(p.links || []); setExperience(p.experience || []);
      } else {
        setCategory(meta.categories[0]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pickAvatar = async () => {
    if (uploading) return;
    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo access is needed. Enable it in Settings."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets?.length) return;
    setUploading(true);
    try {
      setAvatar(await uploadImage(res.assets[0].uri, Platform.OS === "web"));
    } catch {
      setError("Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  };

  const addSkill = () => { const s = skillInput.trim(); if (s && !skills.includes(s)) setSkills((p) => [...p, s]); setSkillInput(""); };
  const addLink = () => { const l = linkInput.trim(); if (l && !links.includes(l)) setLinks((p) => [...p, l]); setLinkInput(""); };
  const addExp = () => setExperience((p) => [...p, { role: "", org: "", detail: "" }]);
  const updateExp = (i: number, key: keyof ExperienceItem, val: string) => setExperience((p) => p.map((e, idx) => (idx === i ? { ...e, [key]: val } : e)));
  const removeExp = (i: number) => setExperience((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (name.trim().length < 1) return setError("Add your name.");
    setBusy(true);
    setError("");
    try {
      await api.freelancerSave({
        name: name.trim(), headline: headline.trim(), bio: bio.trim(), category,
        skills, hourly_rate: parseInt(hourly, 10) || 0, location: location.trim(),
        avatar_url: avatar, links, experience: experience.filter((e) => e.role || e.org || e.detail), available,
      });
      router.back();
    } catch {
      setError("Couldn't save your résumé. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="er-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>My Résumé</Text>
          <Eyebrow>Freelancer profile</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <Pressable testID="er-avatar" onPress={pickAvatar} style={styles.avatarWrap}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name={uploading ? "progress-upload" : "camera-plus"} size={26} color={colors.muted} />
            </View>
          )}
          <Text style={[styles.avatarHint, { color: colors.brand }]}>{avatar ? "Change photo" : "Add photo"}</Text>
        </Pressable>

        <Label text="Name *" />
        <Field value={name} onChangeText={setName} placeholder="Your name" testID="er-name" />
        <Label text="Headline" />
        <Field value={headline} onChangeText={setHeadline} placeholder="e.g. Freelance Airship Mechanic" testID="er-headline" />
        <Label text="Category" />
        <Chips options={categories} value={category} onSelect={setCategory} />
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Label text="Hourly rate ($)" />
            <Field value={hourly} onChangeText={setHourly} placeholder="e.g. 60" keyboardType="number-pad" testID="er-rate" />
          </View>
          <View style={{ flex: 1 }}>
            <Label text="Location" />
            <Field value={location} onChangeText={setLocation} placeholder="e.g. New Babbage" testID="er-loc" />
          </View>
        </View>
        <View style={[styles.switchRow, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          <MaterialCommunityIcons name="check-decagram" size={18} color={colors.brand} />
          <Text style={[styles.switchLabel, { color: colors.onSurface }]}>Available for work</Text>
          <Switch value={available} onValueChange={setAvailable} trackColor={{ true: colors.brand }} testID="er-available" />
        </View>
        <Label text="About" />
        <Field value={bio} onChangeText={setBio} placeholder="Summarise your experience and what you offer…" multiline testID="er-bio" />

        <Label text="Skills" />
        <AddRow value={skillInput} onChangeText={setSkillInput} onAdd={addSkill} placeholder="Add a skill" testID="er-skill" />
        {skills.length > 0 ? (
          <View style={styles.chipWrap}>
            {skills.map((s) => (
              <Pressable key={s} onPress={() => setSkills((p) => p.filter((x) => x !== s))} style={[styles.chip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.onSurface }]}>{s}</Text>
                <MaterialCommunityIcons name="close" size={13} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <Label text="Links" />
        <AddRow value={linkInput} onChangeText={setLinkInput} onAdd={addLink} placeholder="Portfolio / LinkedIn URL" testID="er-link" />
        {links.length > 0 ? (
          <View style={styles.chipWrap}>
            {links.map((l) => (
              <Pressable key={l} onPress={() => setLinks((p) => p.filter((x) => x !== l))} style={[styles.chip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.onSurface }]} numberOfLines={1}>{l}</Text>
                <MaterialCommunityIcons name="close" size={13} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.expHeader}>
          <Text style={[styles.label, { color: colors.onSurface, marginTop: 0 }]}>Experience</Text>
          <Pressable testID="er-add-exp" onPress={addExp} style={styles.addExpBtn}>
            <MaterialCommunityIcons name="plus" size={15} color={colors.brand} />
            <Text style={[styles.addExpText, { color: colors.brand }]}>Add</Text>
          </Pressable>
        </View>
        {experience.map((e, i) => (
          <View key={i} style={[styles.expCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={styles.expTop}>
              <Text style={[styles.expNum, { color: colors.muted }]}>#{i + 1}</Text>
              <Pressable onPress={() => removeExp(i)} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} /></Pressable>
            </View>
            <Field value={e.role} onChangeText={(v) => updateExp(i, "role", v)} placeholder="Role / title" style={{ marginTop: 0 }} />
            <Field value={e.org} onChangeText={(v) => updateExp(i, "org", v)} placeholder="Company / client" style={{ marginTop: spacing.sm }} />
            <Field value={e.detail} onChangeText={(v) => updateExp(i, "detail", v)} placeholder="What you did" multiline style={{ marginTop: spacing.sm }} />
          </View>
        ))}

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <ForgeButton label="Save résumé" fullWidth loading={busy} onPress={save} testID="er-save" style={{ marginTop: spacing.lg }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

function Label({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.label, { color: colors.onSurface }]}>{text}</Text>;
}

function Field(props: React.ComponentProps<typeof TextInput> & { style?: any }) {
  const { colors } = useTheme();
  return <TextInput {...props} placeholderTextColor={colors.muted} style={[styles.input, props.multiline && styles.multiline, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }, props.style]} />;
}

function AddRow({ value, onChangeText, onAdd, placeholder, testID }: { value: string; onChangeText: (v: string) => void; onAdd: () => void; placeholder: string; testID: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.addRow}>
      <TextInput testID={testID} value={value} onChangeText={onChangeText} onSubmitEditing={onAdd} returnKeyType="done" placeholder={placeholder} placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.input, { flex: 1, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />
      <Pressable testID={`${testID}-add`} onPress={onAdd} style={[styles.addBtn, { backgroundColor: colors.brand }]}>
        <MaterialCommunityIcons name="plus" size={20} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

function Chips({ options, value, onSelect }: { options: string[]; value: string; onSelect: (v: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.chipWrap}>
      {options.map((o) => {
        const active = value === o;
        return (
          <Pressable key={o} onPress={() => onSelect(o)} style={[styles.chip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
            <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  avatarWrap: { alignItems: "center", gap: 6 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  avatarHint: { fontFamily: fonts.bodyBold, fontSize: 13 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15 },
  multiline: { minHeight: 84, textAlignVertical: "top" },
  twoCol: { flexDirection: "row", gap: spacing.md },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, height: 50, marginTop: spacing.lg },
  switchLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1, maxWidth: "100%" },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  addRow: { flexDirection: "row", gap: spacing.sm },
  addBtn: { width: 46, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  expHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg },
  addExpBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addExpText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  expCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.sm },
  expTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  expNum: { fontFamily: fonts.bodyBold, fontSize: 12 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
});
