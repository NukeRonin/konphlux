import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";

import { api, BPDesignSummary, BPWall } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const THUMB = 52;

function BlueprintThumb({ walls, stroke }: { walls: BPWall[]; stroke: string }) {
  const pad = 7;
  let minx = 1, miny = 1, maxx = 0, maxy = 0;
  for (const w of walls) {
    minx = Math.min(minx, w.x1, w.x2); miny = Math.min(miny, w.y1, w.y2);
    maxx = Math.max(maxx, w.x1, w.x2); maxy = Math.max(maxy, w.y1, w.y2);
  }
  const bw = Math.max(0.001, maxx - minx);
  const bh = Math.max(0.001, maxy - miny);
  const avail = THUMB - pad * 2;
  const scale = Math.min(avail / bw, avail / bh);
  const offx = pad + (avail - bw * scale) / 2;
  const offy = pad + (avail - bh * scale) / 2;
  const map = (x: number, y: number) => ({ X: offx + (x - minx) * scale, Y: offy + (y - miny) * scale });
  return (
    <Svg width={THUMB} height={THUMB}>
      {walls.map((w, i) => {
        const a = map(w.x1, w.y1); const b = map(w.x2, w.y2);
        return <Line key={i} x1={a.X} y1={a.Y} x2={b.X} y2={b.Y} stroke={stroke} strokeWidth={2} strokeLinecap="round" />;
      })}
    </Svg>
  );
}

export default function BluepaintHome() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [designs, setDesigns] = useState<BPDesignSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      setDesigns(await api.bpDesigns());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (name.trim().length < 1) return;
    setCreating(true);
    try {
      const d = await api.bpCreateDesign(name.trim());
      setName("");
      setShowNew(false);
      router.push(`/bluepaint/design/${d.id}`);
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = (d: BPDesignSummary) => {
    Alert.alert("Delete design?", `"${d.name}" will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.bpDeleteDesign(d.id); load(); } },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="bp-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>Space Designer</Text>
          <Eyebrow>Floor plans &amp; room planning</Eyebrow>
        </View>
        <Pressable testID="bp-new" onPress={() => setShowNew(true)} style={[styles.iconBtn, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name="plus" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <FlatList
        data={designs}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={[styles.intro, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="floor-plan" size={22} color={colors.brand} />
            <Text style={[styles.introText, { color: colors.onSurface }]}>Draw walls in Floor Plan mode, then switch to Room View to place furniture &amp; decor — all in one design.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable testID={`bp-design-${item.id}`} onPress={() => router.push(`/bluepaint/design/${item.id}`)} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={[styles.thumb, { backgroundColor: colors.surfaceTertiary }]}>
              {item.walls && item.walls.length > 0 ? (
                <BlueprintThumb walls={item.walls} stroke={colors.brand} />
              ) : (
                <MaterialCommunityIcons name="floor-plan" size={26} color={colors.brand} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.onSurface }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{item.wall_count} walls · {item.item_count} items</Text>
            </View>
            <Pressable testID={`bp-delete-${item.id}`} onPress={() => confirmDelete(item)} hitSlop={10} style={styles.delBtn}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.muted} />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          status === "loading" ? <Loading label="Unrolling the blueprints…" /> : status === "error" ? <ErrorState onRetry={load} /> : <EmptyState icon="floor-plan" title="No designs yet" subtitle="Tap + to start your first space." />
        }
      />

      <Modal visible={showNew} transparent animationType="fade" onRequestClose={() => setShowNew(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowNew(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>New design</Text>
            <TextInput testID="bp-name-input" value={name} onChangeText={setName} placeholder="e.g. Cottage ground floor" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />
            <ForgeButton label="Create &amp; open" fullWidth loading={creating} onPress={create} testID="bp-create" style={{ marginTop: spacing.md }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  intro: { flexDirection: "row", gap: spacing.md, alignItems: "center", borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  introText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.displaySemi, fontSize: 16 },
  meta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  delBtn: { padding: spacing.xs },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg },
  modalCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, marginBottom: spacing.md },
  input: { height: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
});
