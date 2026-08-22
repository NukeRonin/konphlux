import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Job, uploadResume } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { salaryText, statusColor, statusLabel, timeAgo } from "@/src/utils/jobs";

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [note, setNote] = useState("");
  const [resumeLink, setResumeLink] = useState("");
  const [resumePath, setResumePath] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [uploadingResume, setUploadingResume] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setJob(await api.jobGet(id));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleSave = async () => {
    if (!job) return;
    try {
      const res = await api.jobToggleSave(job.id);
      setJob({ ...job, saved: res.saved });
    } catch {
      /* ignore */
    }
  };

  const pickResume = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      setUploadingResume(true);
      const path = await uploadResume(asset.uri, Platform.OS === "web", asset.mimeType || "application/pdf", asset.name || `resume_${Date.now()}.pdf`);
      setResumePath(path);
      setResumeName(asset.name || "Resume");
    } catch {
      Alert.alert("Upload failed", "Couldn't attach that file. Try a PDF or Word doc.");
    } finally {
      setUploadingResume(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    try {
      await api.jobApply(id!, { cover_note: note.trim(), resume_link: resumeLink.trim(), resume_path: resumePath });
      setApplying(false);
      setNote("");
      await load();
      Alert.alert("Application sent", "The poster has been notified. Track its status under Applied.");
    } catch (e: any) {
      Alert.alert("Couldn't apply", e?.message || "Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><Loading label="Opening the listing…" /></View>;
  if (!job) return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><Text style={{ color: colors.muted, textAlign: "center", marginTop: spacing.xxl }}>Listing not found.</Text></View>;

  const sal = salaryText(job.salary_min, job.salary_max);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="jd-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>Job details</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={toggleSave} hitSlop={12} testID="jd-save">
          <MaterialCommunityIcons name={job.saved ? "bookmark" : "bookmark-outline"} size={24} color={job.saved ? colors.brand : colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.titleIcon, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="briefcase-variant" size={26} color={colors.brand} />
        </View>
        <Text style={[styles.title, { color: colors.onSurface }]}>{job.title}</Text>
        <Text style={[styles.company, { color: colors.brand }]}>{[job.company, job.location].filter(Boolean).join(" · ") || "—"}</Text>

        <View style={styles.badges}>
          <Badge text={job.job_type} />
          <Badge text={job.category} />
          {job.remote ? <Badge text="Remote" /> : null}
          {job.status !== "open" ? <Badge text="Closed" muted /> : null}
        </View>

        <View style={styles.metaRow}>
          {sal ? (
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="cash" size={16} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.onSurface }]}>{sal}/yr</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="account" size={16} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]}>{job.poster_name}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={colors.muted} />
            <Text style={[styles.metaText, { color: colors.muted }]}>{timeAgo(job.created_at)}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Description</Text>
        <Text style={[styles.body, { color: colors.onSurface }]}>{job.description}</Text>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md }]}>
        {job.is_owner ? (
          <ForgeButton label="Manage listing" fullWidth onPress={() => router.push(`/profession/manage/${job.id}`)} testID="jd-manage" />
        ) : job.has_applied ? (
          <View style={[styles.appliedBar, { backgroundColor: `${statusColor(job.my_application_status || "submitted")}18`, borderColor: statusColor(job.my_application_status || "submitted") }]}>
            <MaterialCommunityIcons name="check-circle" size={18} color={statusColor(job.my_application_status || "submitted")} />
            <Text style={[styles.appliedText, { color: statusColor(job.my_application_status || "submitted") }]}>Applied · {statusLabel(job.my_application_status || "submitted")}</Text>
          </View>
        ) : job.status !== "open" ? (
          <Text style={[styles.closedText, { color: colors.muted }]}>This listing is closed.</Text>
        ) : (
          <ForgeButton label="Apply now" fullWidth onPress={() => setApplying(true)} testID="jd-apply" />
        )}
      </View>

      {/* Apply sheet */}
      {applying ? (
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setApplying(false)} />
          <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg }]}>
              <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Apply to {job.title}</Text>
              <Text style={[styles.sheetSub, { color: colors.muted }]}>Add a short note to the poster (optional).</Text>
              <TextInput
                testID="jd-note"
                value={note}
                onChangeText={setNote}
                placeholder="Why you're a great fit…"
                placeholderTextColor={colors.muted}
                multiline
                style={[styles.noteInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]}
              />
              {resumePath ? (
                <View style={[styles.resumeRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="file-check" size={18} color={colors.brand} />
                  <Text numberOfLines={1} style={[styles.resumeName, { color: colors.onSurface }]}>{resumeName}</Text>
                  <Pressable onPress={() => { setResumePath(""); setResumeName(""); }} hitSlop={10}>
                    <MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} />
                  </Pressable>
                </View>
              ) : (
                <Pressable testID="jd-resume" onPress={pickResume} disabled={uploadingResume} style={[styles.resumeBtn, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                  <MaterialCommunityIcons name="paperclip" size={18} color={colors.brand} />
                  <Text style={[styles.resumeBtnText, { color: colors.onSurface }]}>{uploadingResume ? "Uploading…" : "Attach a resume (PDF / doc)"}</Text>
                </Pressable>
              )}
              <TextInput
                testID="jd-resume-link"
                value={resumeLink}
                onChangeText={setResumeLink}
                placeholder="…or paste a resume/portfolio link"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={[styles.linkInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]}
              />
              <ForgeButton label="Send application" fullWidth loading={busy} onPress={apply} testID="jd-send" style={{ marginTop: spacing.md }} />
            </View>
          </KeyboardAwareScrollView>
        </View>
      ) : null}
    </View>
  );
}

function Badge({ text, muted }: { text: string; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <Text style={[styles.badgeText, { color: muted ? colors.muted : colors.brand }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 18 },
  titleIcon: { width: 56, height: 56, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  company: { fontFamily: fonts.bodyBold, fontSize: 14, marginTop: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg, marginTop: spacing.lg },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 16, marginTop: spacing.xl, marginBottom: spacing.sm },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23 },
  actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: spacing.lg },
  appliedBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 50, borderRadius: radius.md, borderWidth: 1 },
  appliedText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  closedText: { fontFamily: fonts.bodyMedium, fontSize: 14, textAlign: "center", paddingVertical: spacing.md },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  sheetTitle: { fontFamily: fonts.display, fontSize: 18 },
  sheetSub: { fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  noteInput: { minHeight: 100, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md, fontFamily: fonts.body, fontSize: 15, textAlignVertical: "top" },
  resumeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  resumeBtnText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  resumeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  resumeName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14 },
  linkInput: { height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, marginTop: spacing.sm, fontFamily: fonts.body, fontSize: 14 },
});
