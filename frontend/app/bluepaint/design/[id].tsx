import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

import { api, BPItem, BPWall } from "@/src/api/client";
import { ErrorState, Loading } from "@/src/components/States";
import { SaveToVaultButton } from "@/src/components/SaveToVaultButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { computeEstimate, fmtArea, fmtLen } from "@/src/utils/bpEstimate";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const PALETTE: { kind: string; icon: IconName; label: string }[] = [
  { kind: "sofa", icon: "sofa", label: "Sofa" },
  { kind: "bed", icon: "bed", label: "Bed" },
  { kind: "table", icon: "table-furniture", label: "Table" },
  { kind: "chair", icon: "seat", label: "Chair" },
  { kind: "desk", icon: "desk", label: "Desk" },
  { kind: "tv", icon: "television", label: "TV" },
  { kind: "fridge", icon: "fridge", label: "Fridge" },
  { kind: "stove", icon: "stove", label: "Stove" },
  { kind: "toilet", icon: "toilet", label: "Toilet" },
  { kind: "bath", icon: "bathtub", label: "Bath" },
  { kind: "wardrobe", icon: "wardrobe", label: "Wardrobe" },
  { kind: "plant", icon: "flower", label: "Plant" },
  { kind: "lamp", icon: "lamp", label: "Lamp" },
  { kind: "rug", icon: "rug", label: "Rug" },
  { kind: "door", icon: "door", label: "Door" },
  { kind: "window", icon: "window-closed-variant", label: "Window" },
];
const ICON_FOR: Record<string, IconName> = PALETTE.reduce((a, p) => ({ ...a, [p.kind]: p.icon }), {});
const ITEM_PX = 46;
const GRID = 0.05;

const snap = (v: number) => Math.min(1, Math.max(0, Math.round(v / GRID) * GRID));

function DraggableItem({
  item, size, selected, onSelect, onMove, color, selColor, surface,
}: {
  item: BPItem; size: number; selected: boolean;
  onSelect: (id: string) => void; onMove: (id: string, x: number, y: number) => void;
  color: string; selColor: string; surface: string;
}) {
  const start = useRef({ x: item.x, y: item.y });
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = { x: item.x, y: item.y };
          onSelect(item.id);
        },
        onPanResponderMove: (_e, g) => {
          const nx = Math.min(1, Math.max(0, start.current.x + g.dx / size));
          const ny = Math.min(1, Math.max(0, start.current.y + g.dy / size));
          onMove(item.id, nx, ny);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.id, size, item.x, item.y],
  );
  const px = ITEM_PX * (item.scale || 1);
  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.item,
        {
          left: item.x * size - px / 2,
          top: item.y * size - px / 2,
          width: px,
          height: px,
          backgroundColor: surface,
          borderColor: selected ? selColor : color,
          borderWidth: selected ? 2 : 1,
          transform: [{ rotate: `${item.rotation || 0}deg` }],
        },
      ]}
    >
      <MaterialCommunityIcons name={ICON_FOR[item.kind] ?? "cube-outline"} size={px * 0.55} color={selected ? selColor : color} />
    </View>
  );
}

export default function SpaceDesigner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [walls, setWalls] = useState<BPWall[]>([]);
  const [items, setItems] = useState<BPItem[]>([]);
  const [mode, setMode] = useState<"floor" | "room">("floor");
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<BPWall | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [size, setSize] = useState(0);
  const [scale, setScale] = useState(8);
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<View>(null);

  const measure = useMemo(() => computeEstimate(walls, scale), [walls, scale]);

  const shareImage = async () => {
    try {
      const uri = await captureRef(canvasRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {
      /* cancelled or unsupported */
    }
  };

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      const d = await api.bpDesign(id);
      setName(d.name);
      setWalls(d.walls);
      setItems(d.items);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const markDirty = () => { setDirty(true); setSavedMsg(""); };

  // Wall drawing responder (floor mode only).
  const drawResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          const p = { x: snap(locationX / size), y: snap(locationY / size) };
          drawStart.current = p;
          setPreview({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
        },
        onPanResponderMove: (e) => {
          if (!drawStart.current) return;
          const { locationX, locationY } = e.nativeEvent;
          setPreview({ x1: drawStart.current.x, y1: drawStart.current.y, x2: snap(locationX / size), y2: snap(locationY / size) });
        },
        onPanResponderRelease: (e) => {
          const s = drawStart.current;
          drawStart.current = null;
          setPreview(null);
          if (!s) return;
          const { locationX, locationY } = e.nativeEvent;
          const end = { x: snap(locationX / size), y: snap(locationY / size) };
          const dist = Math.hypot(end.x - s.x, end.y - s.y);
          if (dist >= 0.03) {
            setWalls((w) => [...w, { x1: s.x, y1: s.y, x2: end.x, y2: end.y }]);
            markDirty();
          }
        },
      }),
    [size],
  );

  const addItem = (kind: string) => {
    const it: BPItem = { id: `${kind}-${Date.now()}`, kind, x: 0.5, y: 0.5, rotation: 0, scale: 1 };
    setItems((arr) => [...arr, it]);
    setSelected(it.id);
    markDirty();
  };

  const moveItem = useCallback((iid: string, x: number, y: number) => {
    setItems((arr) => arr.map((it) => (it.id === iid ? { ...it, x, y } : it)));
    setDirty(true);
  }, []);

  const rotateSelected = () => {
    if (!selected) return;
    setItems((arr) => arr.map((it) => (it.id === selected ? { ...it, rotation: (it.rotation + 45) % 360 } : it)));
    markDirty();
  };
  const scaleSelected = (delta: number) => {
    if (!selected) return;
    setItems((arr) => arr.map((it) => (it.id === selected ? { ...it, scale: Math.min(2, Math.max(0.6, +(it.scale + delta).toFixed(2))) } : it)));
    markDirty();
  };
  const deleteSelected = () => {
    if (!selected) return;
    setItems((arr) => arr.filter((it) => it.id !== selected));
    setSelected(null);
    markDirty();
  };

  const undoWall = () => { setWalls((w) => w.slice(0, -1)); markDirty(); };
  const clearWalls = () => { setWalls([]); markDirty(); };

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.bpSaveDesign(id, { name, walls, items });
      setDirty(false);
      setSavedMsg("Saved");
      setTimeout(() => setSavedMsg(""), 1600);
    } finally {
      setSaving(false);
    }
  };

  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let i = 1; i < 20; i++) {
      const p = (i / 20) * size;
      lines.push(<Line key={`v${i}`} x1={p} y1={0} x2={p} y2={size} stroke={colors.border} strokeWidth={i % 4 === 0 ? 1 : 0.5} />);
      lines.push(<Line key={`h${i}`} x1={0} y1={p} x2={size} y2={p} stroke={colors.border} strokeWidth={i % 4 === 0 ? 1 : 0.5} />);
    }
    return lines;
  }, [size, colors.border]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="designer-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>{name || "Design"}</Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>{walls.length} walls · {items.length} items{dirty ? " · unsaved" : ""}</Text>
        </View>
        <Pressable testID="designer-share" onPress={shareImage} hitSlop={8} style={[styles.shareBtn, { borderColor: colors.border }]}>
          <MaterialCommunityIcons name="share-variant" size={18} color={colors.brand} />
        </Pressable>
        <View style={{ marginHorizontal: spacing.xs }}>
          <SaveToVaultButton source="bluepaint" refId={id!} title={name || "Bluepaint design"} subtitle="Bluepaint design" route={`/bluepaint/design/${id}`} compact />
        </View>
        <Pressable testID="designer-save" onPress={save} disabled={saving} style={[styles.saveBtn, { backgroundColor: dirty ? colors.brand : colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="content-save" size={16} color={dirty ? colors.onBrandPrimary : colors.muted} />
          <Text style={[styles.saveText, { color: dirty ? colors.onBrandPrimary : colors.muted }]}>{savedMsg || "Save"}</Text>
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Loading the blueprint…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <>
          {/* Mode toggle */}
          <View style={styles.modeRow}>
            {(["floor", "room"] as const).map((m) => (
              <Pressable key={m} testID={`designer-mode-${m}`} onPress={() => { setMode(m); setSelected(null); }} style={[styles.modeBtn, { backgroundColor: mode === m ? colors.brand : colors.surfaceSecondary, borderColor: mode === m ? colors.brand : colors.border }]}>
                <MaterialCommunityIcons name={m === "floor" ? "vector-square" : "sofa-single"} size={16} color={mode === m ? colors.onBrandPrimary : colors.brand} />
                <Text style={[styles.modeText, { color: mode === m ? colors.onBrandPrimary : colors.onSurface }]}>{m === "floor" ? "Floor Plan" : "Room View"}</Text>
              </Pressable>
            ))}
          </View>

          {/* Canvas */}
          <View style={styles.canvasWrap}>
            <View
              testID="designer-canvas"
              ref={canvasRef}
              collapsable={false}
              onLayout={(e) => setSize(e.nativeEvent.layout.width)}
              style={[styles.canvas, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}
            >
              {size > 0 ? (
                <>
                  <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                    {gridLines}
                    {walls.map((w, i) => (
                      <Line key={i} x1={w.x1 * size} y1={w.y1 * size} x2={w.x2 * size} y2={w.y2 * size} stroke={colors.brand} strokeWidth={5} strokeLinecap="round" />
                    ))}
                    {preview ? (
                      <Line x1={preview.x1 * size} y1={preview.y1 * size} x2={preview.x2 * size} y2={preview.y2 * size} stroke={colors.brandSecondary} strokeWidth={5} strokeDasharray="6 6" strokeLinecap="round" />
                    ) : null}
                  </Svg>

                  {/* Room View: draggable items */}
                  {mode === "room"
                    ? items.map((it) => (
                        <DraggableItem
                          key={it.id}
                          item={it}
                          size={size}
                          selected={selected === it.id}
                          onSelect={setSelected}
                          onMove={moveItem}
                          color={colors.onSurface}
                          selColor={colors.brand}
                          surface={colors.surface}
                        />
                      ))
                    : null}

                  {/* Floor mode: drawing overlay */}
                  {mode === "floor" ? <View {...drawResponder.panHandlers} style={StyleSheet.absoluteFill} /> : null}
                </>
              ) : null}
            </View>
          </View>

          {/* Live measurements + plan scale */}
          <View style={styles.measureBar}>
            <View style={[styles.measurePill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="ruler" size={14} color={colors.brand} />
              <Text style={[styles.measureText, { color: colors.onSurface }]}>{fmtLen(measure.wallLen)}</Text>
            </View>
            <View style={[styles.measurePill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="vector-square" size={14} color={colors.brand} />
              <Text style={[styles.measureText, { color: colors.onSurface }]}>{fmtArea(measure.floorArea)}</Text>
            </View>
            <View style={[styles.scaleMini, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Pressable testID="designer-scale-down" onPress={() => setScale((s) => Math.max(2, s - 1))} hitSlop={6}><MaterialCommunityIcons name="minus" size={16} color={colors.brand} /></Pressable>
              <Text style={[styles.scaleMiniText, { color: colors.onSurface }]}>{scale}m</Text>
              <Pressable testID="designer-scale-up" onPress={() => setScale((s) => Math.min(40, s + 1))} hitSlop={6}><MaterialCommunityIcons name="plus" size={16} color={colors.brand} /></Pressable>
            </View>
          </View>

          {/* Tools */}
          {mode === "floor" ? (
            <View style={styles.toolbar}>
              <Text style={[styles.hint, { color: colors.muted }]}>Drag on the grid to draw a wall.</Text>
              <View style={styles.toolBtns}>
                <Pressable testID="designer-undo-wall" onPress={undoWall} disabled={!walls.length} style={[styles.toolBtn, { borderColor: colors.border, opacity: walls.length ? 1 : 0.4 }]}>
                  <MaterialCommunityIcons name="undo-variant" size={18} color={colors.brand} />
                  <Text style={[styles.toolText, { color: colors.onSurface }]}>Undo</Text>
                </Pressable>
                <Pressable testID="designer-clear-walls" onPress={clearWalls} disabled={!walls.length} style={[styles.toolBtn, { borderColor: colors.border, opacity: walls.length ? 1 : 0.4 }]}>
                  <MaterialCommunityIcons name="eraser" size={18} color={colors.error} />
                  <Text style={[styles.toolText, { color: colors.onSurface }]}>Clear walls</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.toolbar}>
              {selected ? (
                <View style={styles.toolBtns}>
                  <Pressable testID="designer-rotate" onPress={rotateSelected} style={[styles.toolBtn, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="rotate-right" size={18} color={colors.brand} />
                    <Text style={[styles.toolText, { color: colors.onSurface }]}>Rotate</Text>
                  </Pressable>
                  <Pressable testID="designer-bigger" onPress={() => scaleSelected(0.2)} style={[styles.toolBtn, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="magnify-plus-outline" size={18} color={colors.brand} />
                  </Pressable>
                  <Pressable testID="designer-smaller" onPress={() => scaleSelected(-0.2)} style={[styles.toolBtn, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="magnify-minus-outline" size={18} color={colors.brand} />
                  </Pressable>
                  <Pressable testID="designer-delete-item" onPress={deleteSelected} style={[styles.toolBtn, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error} />
                    <Text style={[styles.toolText, { color: colors.onSurface }]}>Delete</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[styles.hint, { color: colors.muted }]}>Tap a piece below to add it, then drag to place. Tap a placed item to edit.</Text>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.palette}>
                {PALETTE.map((p) => (
                  <Pressable key={p.kind} testID={`designer-add-${p.kind}`} onPress={() => addItem(p.kind)} style={[styles.paletteItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name={p.icon} size={24} color={colors.brand} />
                    <Text style={[styles.paletteLabel, { color: colors.onSurface }]}>{p.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 17 },
  headerSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  saveBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  shareBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  measureBar: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: -spacing.xs, marginBottom: spacing.md, flexWrap: "wrap" },
  measurePill: { flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  measureText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  scaleMini: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  scaleMiniText: { fontFamily: fonts.bodyBold, fontSize: 12, minWidth: 28, textAlign: "center" },
  modeRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1 },
  modeText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  canvasWrap: { padding: spacing.lg },
  canvas: { width: "100%", aspectRatio: 1, borderRadius: radius.md, borderWidth: 2, overflow: "hidden", position: "relative" },
  item: { position: "absolute", borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  toolbar: { paddingHorizontal: spacing.lg, gap: spacing.md },
  hint: { fontFamily: fonts.body, fontSize: 13, textAlign: "center" },
  toolBtns: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", justifyContent: "center" },
  toolBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 40, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  toolText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  palette: { gap: spacing.sm, paddingVertical: spacing.xs },
  paletteItem: { width: 68, height: 68, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  paletteLabel: { fontFamily: fonts.bodyMedium, fontSize: 10 },
});
