import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function PostJob() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = !!params.id;
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<string[]>([]);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [jobType, setJobType] = useState("Full-time");
  const [category, setCategory] = useState("Engineering");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [remote, setRemote] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadMeta = useCallback(async () => {
    try {
      const m = await api.jobMeta();
      setCategories(m.categories);
      setJobTypes(m.job_types);
      if (m.job_types.length) setJobType((jt) => jt || m.job_types[0]);
      if (m.categories.length) setCategory((c) => c || m.categories[0]);
    } catch {
      /* ignore */
    }
  }, []);

  const loadJob = useCallback(async (id: string) => {
    try {
      const j = await api.jobGet(id);
      setTitle(j.title); setCompany(j.company); setLocation(j.location);
      setJobType(j.job_type); setCategory(j.category);
      setSalaryMin(j.salary_min ? String(j.salary_min) : "");
      setSalaryMax(j.salary_max ? String(j.salary_max) : "");
      setRemote(j.remote); setDescription(j.description);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { loadMeta(); if (params.id) loadJob(params.id); }, [loadMeta, loadJob, params.id]);

  const submit = async () => {
    if (title.trim().length < 2) return setError("Give the role a title.");
    if (description.trim().length < 1) return setError("Add a short description.");
    setBusy(true);
    setError("");
    const body = {
      title: title.trim(), company: company.trim(), location: location.trim(),
      job_type: jobType, category, remote,
      salary_min: parseInt(salaryMin, 10) || 0, salary_max: parseInt(salaryMax, 10) || 0,
      description: description.trim(),
    };
    try {
      if (editing) await api.jobUpdate(params.id!, body);
      else await api.jobCreate(body);
      router.replace("/profession?tab=posted");
    } catch {
      setError("Couldn't save the listing. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="post-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>{editing ? "Edit Job" : "Post a Job"}</Text>
          <Eyebrow>Profession Plaza</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <Label text="Job title *" />
        <Field value={title} onChangeText={setTitle} placeholder="e.g. Senior Airship Engineer" testID="post-title" />

        <Label text="Company" />
        <Field value={company} onChangeText={setCompany} placeholder="e.g. Cogsworth Industries" testID="post-company" />

        <Label text="Location" />
        <Field value={location} onChangeText={setLocation} placeholder="e.g. New Babbage" testID="post-location" />

        <View style={[styles.switchRow, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          <MaterialCommunityIcons name="home-city-outline" size={18} color={colors.brand} />
          <Text style={[styles.switchLabel, { color: colors.onSurface }]}>Remote friendly</Text>
          <Switch value={remote} onValueChange={setRemote} trackColor={{ true: colors.brand }} testID="post-remote" />
        </View>

        <Label text="Job type" />
        <Chips options={jobTypes} value={jobType} onSelect={setJobType} />

        <Label text="Category" />
        <Chips options={categories} value={category} onSelect={setCategory} />

        <Label text="Salary range (annual, optional)" />
        <View style={styles.salaryRow}>
          <Field value={salaryMin} onChangeText={setSalaryMin} placeholder="Min" keyboardType="number-pad" style={{ flex: 1 }} testID="post-salmin" />
          <Text style={{ color: colors.muted }}>–</Text>
          <Field value={salaryMax} onChangeText={setSalaryMax} placeholder="Max" keyboardType="number-pad" style={{ flex: 1 }} testID="post-salmax" />
        </View>

        <Label text="Description *" />
        <Field value={description} onChangeText={setDescription} placeholder="Responsibilities, requirements, perks…" multiline testID="post-desc" />

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <ForgeButton label={editing ? "Save changes" : "Post job"} fullWidth loading={busy} onPress={submit} testID="post-submit" style={{ marginTop: spacing.lg }} />
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
  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.muted}
      style={[styles.input, props.multiline && styles.multiline, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }, props.style]}
    />
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
  label: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15 },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, height: 50, marginTop: spacing.lg },
  switchLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14 },
  salaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
});
