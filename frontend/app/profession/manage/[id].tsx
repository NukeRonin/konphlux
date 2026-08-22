import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Applicant, fileUrl, Job } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { APP_STATUSES, statusColor, statusLabel, timeAgo } from "@/src/utils/jobs";

export default function ManageJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [job, setJob] = useState<Job | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.jobApplicants(id);
      setJob(res.job);
      setApplicants(res.applicants);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleClose = async () => {
    try {
      const res = await api.jobToggleClose(id!);
      setJob((j) => (j ? { ...j, status: res.status } : j));
    } catch {
      Alert.alert("Couldn't update", "Try again.");
    }
  };

  const remove = () => {
    Alert.alert("Delete listing", "This removes the job and all its applications. Continue?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.jobDelete(id!); router.replace("/profession?tab=posted"); } },
    ]);
  };

  const message = async (a: Applicant) => {
    try {
      const conv = await api.cbStartDm(a.applicant_id);
      router.push(`/chatterbox/conversation/${conv.id}`);
    } catch {
      Alert.alert("Couldn't open chat", "Try again.");
    }
  };

  const openResume = (a: Applicant) => {
    const url = a.resume_link || (a.resume_path ? fileUrl(a.resume_path) : "");
    if (url) Linking.openURL(url).catch(() => Alert.alert("Couldn't open", "The resume link isn't available."));
  };

  const setStatus = (a: Applicant) => {
    Alert.alert(a.applicant_name, "Set application status", [
      ...APP_STATUSES.map((s) => ({
        text: statusLabel(s),
        onPress: async () => {
          try {
            await api.jobSetStatus(a.id, s);
            setApplicants((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: s } : x)));
          } catch {
            Alert.alert("Couldn't update", "Try again.");
          }
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  if (loading) return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><Loading label="Loading applicants…" /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="mj-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>{job?.title || "Manage"}</Text>
          <Eyebrow>{applicants.length} applicant{applicants.length === 1 ? "" : "s"}</Eyebrow>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        {/* Owner actions */}
        <View style={styles.actions}>
          <ActionBtn icon="pencil" label="Edit" onPress={() => router.push(`/profession/post?id=${id}`)} testID="mj-edit" />
          <ActionBtn icon={job?.status === "open" ? "lock" : "lock-open-variant"} label={job?.status === "open" ? "Close" : "Reopen"} onPress={toggleClose} testID="mj-toggle" />
          <ActionBtn icon="trash-can-outline" label="Delete" onPress={remove} danger testID="mj-delete" />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Applicants</Text>
        {applicants.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>No applications yet. Share your listing to attract candidates.</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {applicants.map((a) => (
              <View key={a.id} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.onSurface }]}>{a.applicant_name}</Text>
                    {a.applicant_handle ? <Text style={[styles.handle, { color: colors.muted }]}>{a.applicant_handle}</Text> : null}
                  </View>
                  <Pressable onPress={() => setStatus(a)} testID={`mj-status-${a.id}`} style={[styles.pill, { backgroundColor: `${statusColor(a.status)}22`, borderColor: statusColor(a.status) }]}>
                    <Text style={[styles.pillText, { color: statusColor(a.status) }]}>{statusLabel(a.status)}</Text>
                    <MaterialCommunityIcons name="chevron-down" size={14} color={statusColor(a.status)} />
                  </Pressable>
                </View>
                {a.cover_note ? <Text style={[styles.note, { color: colors.onSurface }]}>{a.cover_note}</Text> : null}
                <View style={styles.applicantActions}>
                  {(a.resume_link || a.resume_path) ? (
                    <Pressable onPress={() => openResume(a)} style={[styles.smallBtn, { borderColor: colors.border }]} testID={`mj-resume-${a.id}`}>
                      <MaterialCommunityIcons name="file-account-outline" size={15} color={colors.brand} />
                      <Text style={[styles.smallBtnText, { color: colors.brand }]}>Resume</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => message(a)} style={[styles.smallBtn, { borderColor: colors.border }]} testID={`mj-msg-${a.id}`}>
                    <MaterialCommunityIcons name="message-text-outline" size={15} color={colors.brand} />
                    <Text style={[styles.smallBtnText, { color: colors.brand }]}>Message</Text>
                  </Pressable>
                  <View style={{ flex: 1 }} />
                  <Text style={[styles.time, { color: colors.muted }]}>Applied {timeAgo(a.created_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, danger, testID }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; danger?: boolean; testID?: string }) {
  const { colors } = useTheme();
  const tint = danger ? colors.error : colors.brand;
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <MaterialCommunityIcons name={icon} size={20} color={tint} />
      <Text style={[styles.actionText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 19 },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, height: 64, borderRadius: radius.md, borderWidth: 1 },
  actionText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { fontFamily: fonts.bodyBold, fontSize: 15 },
  handle: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 1 },
  pill: { flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: spacing.md, paddingRight: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  note: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, marginTop: spacing.sm },
  applicantActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, borderWidth: 1 },
  smallBtnText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  time: { fontFamily: fonts.bodyMedium, fontSize: 11.5 },
});
