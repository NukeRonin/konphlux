import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Workspace, WsClient, WsProject, WsTask } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const TABS = [
  { key: "team", label: "My Team", icon: "account-group" as const },
  { key: "clients", label: "Clients", icon: "briefcase-account" as const },
  { key: "projects", label: "Projects", icon: "folder-multiple" as const },
  { key: "tasks", label: "Tasks", icon: "check-circle-outline" as const },
];

export default function WorkspaceDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [clients, setClients] = useState<WsClient[]>([]);
  const [projects, setProjects] = useState<WsProject[]>([]);
  const [tasks, setTasks] = useState<WsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("team");

  // form fields
  const [recipient, setRecipient] = useState("");
  const [cName, setCName] = useState(""); const [cCompany, setCCompany] = useState(""); const [cContact, setCContact] = useState("");
  const [pName, setPName] = useState(""); const [pDesc, setPDesc] = useState(""); const [pClient, setPClient] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState(""); const [tProject, setTProject] = useState<string | null>(null); const [tAssignee, setTAssignee] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [w, c, p, t] = await Promise.all([api.lobbyWorkspace(id), api.lobbyClients(id), api.lobbyProjects(id), api.lobbyTasks(id)]);
      setWs(w); setClients(c); setProjects(p); setTasks(t);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addMember = async () => {
    if (!id || !recipient.trim()) return;
    try { await api.lobbyAddMember(id, recipient.trim()); setRecipient(""); load(); }
    catch (e: any) { Alert.alert("Couldn't add teammate", e?.message || "Try again."); }
  };
  const removeMember = (mid: string, name: string) => id && Alert.alert("Remove teammate", `Remove ${name}?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: async () => { await api.lobbyRemoveMember(id, mid); load(); } }]);

  const addClient = async () => {
    if (!id || !cName.trim()) return;
    try { await api.lobbyAddClient(id, { name: cName.trim(), company: cCompany.trim(), contact: cContact.trim() }); setCName(""); setCCompany(""); setCContact(""); load(); }
    catch (e: any) { Alert.alert("Couldn't add client", e?.message || "Try again."); }
  };
  const delClient = (cid: string) => id && Alert.alert("Delete client", "Remove this client?", [
    { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { await api.lobbyDeleteClient(id, cid); load(); } }]);

  const addProject = async () => {
    if (!id || !pName.trim()) return;
    try { await api.lobbyAddProject(id, { name: pName.trim(), description: pDesc.trim(), client_id: pClient }); setPName(""); setPDesc(""); setPClient(null); load(); }
    catch (e: any) { Alert.alert("Couldn't add project", e?.message || "Try again."); }
  };
  const delProject = (pid: string) => id && Alert.alert("Delete project", "Remove this project? Its tasks stay but are unlinked.", [
    { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { await api.lobbyDeleteProject(id, pid); load(); } }]);

  const addTask = async () => {
    if (!id || !tTitle.trim()) return;
    try { await api.lobbyAddTask(id, { title: tTitle.trim(), project_id: tProject, assignee_id: tAssignee }); setTTitle(""); setTProject(null); setTAssignee(null); load(); }
    catch (e: any) { Alert.alert("Couldn't add task", e?.message || "Try again."); }
  };
  const toggleTask = async (tid: string) => {
    if (!id) return;
    setTasks((prev) => prev.map((t) => (t.id === tid ? { ...t, done: !t.done } : t)));
    try { await api.lobbyToggleTask(id, tid); } catch { load(); }
  };
  const delTask = async (tid: string) => { if (!id) return; setTasks((prev) => prev.filter((t) => t.id !== tid)); try { await api.lobbyDeleteTask(id, tid); } catch { load(); } };

  const [messaging, setMessaging] = useState(false);
  const messageTeam = async () => {
    if (!id || messaging) return;
    setMessaging(true);
    try {
      const { conversation_id } = await api.lobbyMessageTeam(id);
      router.push(`/chatterbox/conversation/${conversation_id}`);
    } catch (e: any) { Alert.alert("Can't message team", e?.message || "Add a teammate first."); }
    finally { setMessaging(false); }
  };

  if (loading) return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><Loading label="Loading…" /></View>;
  if (!ws) return <View style={[styles.screen, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}><Text style={{ color: colors.muted, fontFamily: fonts.body }}>Workspace not found.</Text></View>;

  const isOwner = ws.is_owner;
  const inputStyle = [styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }];

  const Chip = ({ active, label, onPress, tid }: { active: boolean; label: string; onPress: () => void; tid?: string }) => (
    <Pressable onPress={onPress} testID={tid} style={[styles.chip, { backgroundColor: active ? colors.brand : colors.surface, borderColor: active ? colors.brand : colors.border }]}>
      <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurface }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="wsd-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>{ws.name}</Text>
          <Eyebrow>{ws.member_count} members · {ws.is_owner ? "Owner" : "Member"}</Eyebrow>
        </View>
        <Pressable onPress={messageTeam} disabled={messaging} style={[styles.msgBtn, { backgroundColor: colors.brand }]} testID="wsd-message-team">
          <MaterialCommunityIcons name="message-text" size={15} color={colors.onBrandPrimary} />
          <Text style={[styles.msgText, { color: colors.onBrandPrimary }]}>{messaging ? "…" : "Message Team"}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.tabs}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} testID={`wsd-tab-${t.key}`} style={[styles.tab, { backgroundColor: on ? colors.brand : colors.surfaceSecondary, borderColor: on ? colors.brand : colors.border }]}>
              <MaterialCommunityIcons name={t.icon} size={14} color={on ? colors.onBrandPrimary : colors.onSurface} />
              <Text style={[styles.tabText, { color: on ? colors.onBrandPrimary : colors.onSurface }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        {tab === "team" ? (
          <>
            {isOwner ? (
              <View style={[styles.box, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.boxTitle, { color: colors.onSurface }]}>Add a teammate</Text>
                <View style={styles.row}>
                  <TextInput value={recipient} onChangeText={setRecipient} placeholder="Email or @handle" placeholderTextColor={colors.muted} autoCapitalize="none" style={[inputStyle, { flex: 1 }]} testID="wsd-recipient" onSubmitEditing={addMember} />
                  <Pressable onPress={addMember} disabled={!recipient.trim()} style={[styles.iconBtn, { backgroundColor: recipient.trim() ? colors.brand : colors.surfaceTertiary }]} testID="wsd-add"><MaterialCommunityIcons name="account-plus" size={20} color={recipient.trim() ? colors.onBrandPrimary : colors.muted} /></Pressable>
                </View>
              </View>
            ) : null}
            {ws.members.map((m) => (
              <View key={m.user_id} style={[styles.item, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: `${colors.brand}22` }]}><Text style={[styles.avatarText, { color: colors.brand }]}>{(m.name || "?").charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: colors.onSurface }]} numberOfLines={1}>{m.name}</Text>
                  {m.handle ? <Text style={[styles.itemMeta, { color: colors.muted }]}>{m.handle}</Text> : null}
                </View>
                <View style={[styles.roleTag, { backgroundColor: m.role === "owner" ? colors.brand : colors.surfaceTertiary }]}><Text style={[styles.roleText, { color: m.role === "owner" ? colors.onBrandPrimary : colors.muted }]}>{m.role === "owner" ? "Owner" : "Member"}</Text></View>
                {isOwner && m.role !== "owner" ? <Pressable onPress={() => removeMember(m.user_id, m.name)} hitSlop={8} style={{ marginLeft: spacing.sm }} testID={`wsd-remove-${m.user_id}`}><MaterialCommunityIcons name="account-remove-outline" size={20} color={colors.muted} /></Pressable> : null}
              </View>
            ))}
          </>
        ) : null}

        {tab === "clients" ? (
          <>
            <View style={[styles.box, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.boxTitle, { color: colors.onSurface }]}>Add a client</Text>
              <TextInput value={cName} onChangeText={setCName} placeholder="Client name *" placeholderTextColor={colors.muted} style={inputStyle} testID="wsd-cname" />
              <TextInput value={cCompany} onChangeText={setCCompany} placeholder="Company (optional)" placeholderTextColor={colors.muted} style={[inputStyle, { marginTop: spacing.sm }]} testID="wsd-ccompany" />
              <TextInput value={cContact} onChangeText={setCContact} placeholder="Contact — email/phone (optional)" placeholderTextColor={colors.muted} style={[inputStyle, { marginTop: spacing.sm }]} testID="wsd-ccontact" />
              <Pressable onPress={addClient} disabled={!cName.trim()} style={[styles.addBtn, { backgroundColor: cName.trim() ? colors.brand : colors.surfaceTertiary }]} testID="wsd-cadd"><Text style={[styles.addBtnText, { color: cName.trim() ? colors.onBrandPrimary : colors.muted }]}>Add client</Text></Pressable>
            </View>
            {clients.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>No clients yet.</Text> : clients.map((c) => (
              <View key={c.id} style={[styles.item, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: `${colors.brand}22` }]}><MaterialCommunityIcons name="briefcase-account" size={20} color={colors.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: colors.onSurface }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[styles.itemMeta, { color: colors.muted }]} numberOfLines={1}>{[c.company, c.contact].filter(Boolean).join(" · ") || "Client"}</Text>
                </View>
                <Pressable onPress={() => delClient(c.id)} hitSlop={8} testID={`wsd-cdel-${c.id}`}><MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.muted} /></Pressable>
              </View>
            ))}
          </>
        ) : null}

        {tab === "projects" ? (
          <>
            <View style={[styles.box, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.boxTitle, { color: colors.onSurface }]}>Add a project</Text>
              <TextInput value={pName} onChangeText={setPName} placeholder="Project name *" placeholderTextColor={colors.muted} style={inputStyle} testID="wsd-pname" />
              <TextInput value={pDesc} onChangeText={setPDesc} placeholder="Description (optional)" placeholderTextColor={colors.muted} style={[inputStyle, { marginTop: spacing.sm }]} testID="wsd-pdesc" />
              {clients.length > 0 ? (
                <>
                  <Text style={[styles.pickLabel, { color: colors.muted }]}>Client (optional)</Text>
                  <View style={styles.chipWrap}>
                    <Chip active={pClient === null} label="None" onPress={() => setPClient(null)} />
                    {clients.map((c) => <Chip key={c.id} active={pClient === c.id} label={c.name} onPress={() => setPClient(c.id)} tid={`wsd-pclient-${c.id}`} />)}
                  </View>
                </>
              ) : null}
              <Pressable onPress={addProject} disabled={!pName.trim()} style={[styles.addBtn, { backgroundColor: pName.trim() ? colors.brand : colors.surfaceTertiary }]} testID="wsd-padd"><Text style={[styles.addBtnText, { color: pName.trim() ? colors.onBrandPrimary : colors.muted }]}>Add project</Text></Pressable>
            </View>
            {projects.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>No projects yet.</Text> : projects.map((p) => (
              <View key={p.id} style={[styles.item, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: `${colors.brand}22` }]}><MaterialCommunityIcons name="folder" size={20} color={colors.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: colors.onSurface }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[styles.itemMeta, { color: colors.muted }]} numberOfLines={1}>{p.client_name ? `Client: ${p.client_name}` : (p.description || "Project")}</Text>
                </View>
                <Pressable onPress={() => delProject(p.id)} hitSlop={8} testID={`wsd-pdel-${p.id}`}><MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.muted} /></Pressable>
              </View>
            ))}
          </>
        ) : null}

        {tab === "tasks" ? (
          <>
            <View style={[styles.box, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.boxTitle, { color: colors.onSurface }]}>Add a task</Text>
              <TextInput value={tTitle} onChangeText={setTTitle} placeholder="What needs doing? *" placeholderTextColor={colors.muted} style={inputStyle} testID="wsd-ttitle" />
              <Text style={[styles.pickLabel, { color: colors.muted }]}>Project (optional)</Text>
              <View style={styles.chipWrap}>
                <Chip active={tProject === null} label="None" onPress={() => setTProject(null)} />
                {projects.map((p) => <Chip key={p.id} active={tProject === p.id} label={p.name} onPress={() => setTProject(p.id)} tid={`wsd-tproject-${p.id}`} />)}
              </View>
              <Text style={[styles.pickLabel, { color: colors.muted }]}>Assign to (optional)</Text>
              <View style={styles.chipWrap}>
                <Chip active={tAssignee === null} label="Unassigned" onPress={() => setTAssignee(null)} />
                {ws.members.map((m) => <Chip key={m.user_id} active={tAssignee === m.user_id} label={m.name} onPress={() => setTAssignee(m.user_id)} tid={`wsd-tassignee-${m.user_id}`} />)}
              </View>
              <Pressable onPress={addTask} disabled={!tTitle.trim()} style={[styles.addBtn, { backgroundColor: tTitle.trim() ? colors.brand : colors.surfaceTertiary }]} testID="wsd-tadd"><Text style={[styles.addBtnText, { color: tTitle.trim() ? colors.onBrandPrimary : colors.muted }]}>Add task</Text></Pressable>
            </View>
            {tasks.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>No tasks yet.</Text> : tasks.map((t) => (
              <View key={t.id} style={[styles.item, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Pressable onPress={() => toggleTask(t.id)} hitSlop={8} testID={`wsd-ttoggle-${t.id}`}><MaterialCommunityIcons name={t.done ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={t.done ? colors.brand : colors.muted} /></Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: t.done ? colors.muted : colors.onSurface, textDecorationLine: t.done ? "line-through" : "none" }]} numberOfLines={2}>{t.title}</Text>
                  <View style={styles.taskMetaRow}>
                    {t.project_name ? <View style={[styles.metaPill, { backgroundColor: `${colors.brand}18` }]}><MaterialCommunityIcons name="folder-outline" size={11} color={colors.brand} /><Text style={[styles.metaPillText, { color: colors.brand }]} numberOfLines={1}>{t.project_name}</Text></View> : null}
                    {t.assignee_name ? <View style={[styles.metaPill, { backgroundColor: colors.surfaceTertiary }]}><MaterialCommunityIcons name="account" size={11} color={colors.muted} /><Text style={[styles.metaPillText, { color: colors.muted }]} numberOfLines={1}>{t.assignee_name}</Text></View> : null}
                  </View>
                </View>
                <Pressable onPress={() => delTask(t.id)} hitSlop={8} testID={`wsd-tdel-${t.id}`}><MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.muted} /></Pressable>
              </View>
            ))}
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  msgBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill },
  msgText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  tabs: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1 },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  box: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.lg },
  boxTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  iconBtn: { width: 46, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  addBtn: { height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  addBtnText: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  pickLabel: { fontFamily: fonts.bodyBold, fontSize: 12, marginTop: spacing.md, marginBottom: spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", maxWidth: 200 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.displaySemi, fontSize: 16 },
  itemTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  itemMeta: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  roleTag: { paddingHorizontal: 10, height: 24, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  roleText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  taskMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, height: 22, borderRadius: radius.pill, maxWidth: 160 },
  metaPillText: { fontFamily: fonts.bodyBold, fontSize: 10.5 },
  empty: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", paddingVertical: spacing.xl },
});
