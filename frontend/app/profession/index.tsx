import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Job, JobApplication } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { salaryText, statusColor, statusLabel, timeAgo } from "@/src/utils/jobs";

type Tab = "find" | "saved" | "applications" | "posted";

export default function ProfessionPlaza() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>(params.tab === "applications" ? "applications" : params.tab === "posted" ? "posted" : params.tab === "saved" ? "saved" : "find");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [categories, setCategories] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [myApps, setMyApps] = useState<JobApplication[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMeta = useCallback(async () => {
    try {
      const m = await api.jobMeta();
      setCategories(["All", ...m.categories]);
    } catch {
      /* ignore */
    }
  }, []);

  const loadFind = useCallback(async (query: string, cat: string) => {
    setLoading(true);
    try {
      setJobs(await api.jobList(query, cat === "All" ? "" : cat));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTab = useCallback(async (t: Tab) => {
    if (t === "find") return loadFind(q, category);
    setLoading(true);
    try {
      if (t === "applications") setMyApps(await api.jobApplicationsMine());
      else if (t === "saved") setSavedJobs(await api.jobsSaved());
      else setMyJobs(await api.jobsMine());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [q, category, loadFind]);

  useFocusEffect(useCallback(() => { loadMeta(); loadTab(tab); }, [loadMeta, loadTab, tab]));

  const switchTab = (t: Tab) => { setTab(t); };

  const toggleSave = async (job: Job) => {
    try {
      const res = await api.jobToggleSave(job.id);
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, saved: res.saved } : j)));
      if (!res.saved) setSavedJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="job-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Job Board</Text>
          <Eyebrow>Profession Plaza</Eyebrow>
        </View>
        <Pressable testID="job-alerts" onPress={() => router.push("/profession/alerts")} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="bell-ring-outline" size={19} color={colors.brand} />
        </Pressable>
        <Pressable testID="job-post-cta" onPress={() => router.push("/profession/post")} style={[styles.postBtn, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name="plus" size={16} color={colors.onBrandPrimary} />
          <Text style={[styles.postBtnText, { color: colors.onBrandPrimary }]}>Post</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {([["find", "Find"], ["saved", "Saved"], ["applications", "Applied"], ["posted", "Posted"]] as [Tab, string][]).map(([key, label]) => (
          <Pressable key={key} testID={`job-tab-${key}`} onPress={() => switchTab(key)} style={styles.tab}>
            <Text style={[styles.tabText, { color: tab === key ? colors.brand : colors.muted }]}>{label}</Text>
            {tab === key ? <View style={[styles.tabBar, { backgroundColor: colors.brand }]} /> : null}
          </Pressable>
        ))}
      </View>

      {tab === "find" ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchWrap}>
            <View style={[styles.searchBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={colors.muted} />
              <TextInput
                testID="job-search"
                value={q}
                onChangeText={setQ}
                onSubmitEditing={() => loadFind(q, category)}
                returnKeyType="search"
                placeholder="Search title, company, location"
                placeholderTextColor={colors.muted}
                style={[styles.searchInput, { color: colors.onSurface }]}
              />
              {q ? (
                <Pressable onPress={() => { setQ(""); loadFind("", category); }} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catRow}>
            {categories.map((c) => {
              const active = category === c;
              return (
                <Pressable key={c} onPress={() => { setCategory(c); loadFind(q, c); }} style={[styles.catChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                  <Text style={[styles.catText, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>{c}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {loading ? (
            <Loading label="Finding jobs…" />
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              <Pressable testID="job-marketplace" onPress={() => router.push("/profession/marketplace")} style={[styles.banner, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="account-hard-hat" size={22} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerTitle, { color: colors.onSurface }]}>Freelance Marketplace</Text>
                  <Text style={[styles.bannerSub, { color: colors.muted }]}>Find gigs, build a résumé, hire freelancers</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
              </Pressable>
              {jobs.length === 0 ? (
                <Empty icon="briefcase-search" text="No jobs match yet. Try another search — or post the first one!" />
              ) : (
                jobs.map((j) => (
                  <JobCard key={j.id} job={j} onPress={() => router.push(`/profession/${j.id}`)} onSave={toggleSave} />
                ))
              )}
            </ScrollView>
          )}
        </View>
      ) : tab === "saved" ? (
        loading ? (
          <Loading label="Loading saved jobs…" />
        ) : savedJobs.length === 0 ? (
          <Empty icon="bookmark-outline" text="No saved jobs yet. Tap the bookmark on any listing to keep it here." />
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {savedJobs.map((j) => (
              <JobCard key={j.id} job={j} onPress={() => router.push(`/profession/${j.id}`)} onSave={toggleSave} />
            ))}
          </ScrollView>
        )
      ) : tab === "applications" ? (
        loading ? (
          <Loading label="Loading your applications…" />
        ) : myApps.length === 0 ? (
          <Empty icon="send-outline" text="You haven't applied to any jobs yet. Find one you like and hit Apply." />
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {myApps.map((a) => (
              <Pressable key={a.id} testID={`app-${a.id}`} onPress={() => a.job_open && router.push(`/profession/${a.job_id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{a.job_title}</Text>
                  {a.company ? <Text style={[styles.cardSub, { color: colors.muted }]}>{a.company}</Text> : null}
                  <Text style={[styles.cardMeta, { color: colors.muted }]}>Applied {timeAgo(a.created_at)}{a.job_open ? "" : " · listing closed"}</Text>
                </View>
                <StatusPill status={a.status} />
              </Pressable>
            ))}
          </ScrollView>
        )
      ) : (
        loading ? (
          <Loading label="Loading your listings…" />
        ) : myJobs.length === 0 ? (
          <View style={{ flex: 1 }}>
            <Empty icon="clipboard-text-outline" text="You haven't posted any jobs yet." />
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ForgeButton label="Post a job" fullWidth onPress={() => router.push("/profession/post")} testID="job-post-empty" />
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {myJobs.map((j) => (
              <Pressable key={j.id} testID={`myjob-${j.id}`} onPress={() => router.push(`/profession/manage/${j.id}`)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{j.title}</Text>
                  <Text style={[styles.cardSub, { color: colors.muted }]}>{[j.company, j.job_type].filter(Boolean).join(" · ")}</Text>
                  <View style={styles.rowGap}>
                    <View style={[styles.miniBadge, { backgroundColor: j.status === "open" ? colors.brand : colors.surfaceTertiary }]}>
                      <Text style={[styles.miniBadgeText, { color: j.status === "open" ? colors.onBrandPrimary : colors.muted }]}>{j.status === "open" ? "Open" : "Closed"}</Text>
                    </View>
                    <Text style={[styles.cardMeta, { color: colors.muted }]}>{j.applicant_count || 0} applicant{(j.applicant_count || 0) === 1 ? "" : "s"}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
              </Pressable>
            ))}
          </ScrollView>
        )
      )}
    </View>
  );
}

function JobCard({ job, onPress, onSave }: { job: Job; onPress: () => void; onSave?: (j: Job) => void }) {
  const { colors } = useTheme();
  const sal = salaryText(job.salary_min, job.salary_max);
  return (
    <Pressable testID={`job-${job.id}`} onPress={onPress} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <View style={[styles.jobIcon, { backgroundColor: colors.surfaceTertiary }]}>
        <MaterialCommunityIcons name="briefcase-variant" size={20} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>{job.title}</Text>
        <Text style={[styles.cardSub, { color: colors.muted }]} numberOfLines={1}>{[job.company, job.location].filter(Boolean).join(" · ") || "—"}</Text>
        <View style={styles.rowGap}>
          <View style={[styles.miniBadge, { backgroundColor: colors.surfaceTertiary }]}>
            <Text style={[styles.miniBadgeText, { color: colors.brand }]}>{job.job_type}</Text>
          </View>
          {job.remote ? (
            <View style={[styles.miniBadge, { backgroundColor: colors.surfaceTertiary }]}>
              <Text style={[styles.miniBadgeText, { color: colors.brand }]}>Remote</Text>
            </View>
          ) : null}
          {sal ? <Text style={[styles.cardMeta, { color: colors.onSurface }]}>{sal}</Text> : null}
          {job.has_applied ? <Text style={[styles.cardMeta, { color: colors.brand }]}>✓ Applied</Text> : null}
        </View>
      </View>
      {onSave ? (
        <Pressable onPress={() => onSave(job)} hitSlop={10} testID={`job-save-${job.id}`}>
          <MaterialCommunityIcons name={job.saved ? "bookmark" : "bookmark-outline"} size={22} color={job.saved ? colors.brand : colors.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function StatusPill({ status }: { status: string }) {
  const c = statusColor(status);
  return (
    <View style={[styles.pill, { backgroundColor: `${c}22`, borderColor: c }]}>
      <Text style={[styles.pillText, { color: c }]}>{statusLabel(status)}</Text>
    </View>
  );
}

function Empty({ icon, text }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <MaterialCommunityIcons name={icon} size={40} color={colors.muted} />
      <Text style={[styles.emptyText, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  postBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill },
  postBtnText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  bannerTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  bannerSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: spacing.md },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  tabBar: { height: 2, width: "60%", borderRadius: 2, marginTop: 6 },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  catScroll: { flexGrow: 0 },
  catRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  catChip: { paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  catText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  jobIcon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.displaySemi, fontSize: 15.5 },
  cardSub: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 1 },
  cardMeta: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  rowGap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 6, flexWrap: "wrap" },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  miniBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  emptyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: "center" },
});
