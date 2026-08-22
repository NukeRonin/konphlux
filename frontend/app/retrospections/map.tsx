import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

import { api, RetroBusiness } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { catMeta, fmtDistance } from "@/src/utils/retro";

const SIZE = Math.min(Dimensions.get("window").width - spacing.lg * 2, 360);
const HALF = SIZE / 2;
const PAD = 34;

function ringLabel(m: number) {
  if (m < 1000) return `${Math.round(m / 50) * 50} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function NearbyMap() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [precise, setPrecise] = useState(false);
  const [list, setList] = useState<RetroBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const init = useCallback(async () => {
    setLoading(true);
    let c: { lat: number; lng: number } | null = null;
    let gotPrecise = false;
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      let ok = status === "granted";
      if (!ok && canAskAgain) ok = (await Location.requestForegroundPermissionsAsync()).status === "granted";
      if (ok) {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        gotPrecise = true;
      }
    } catch { /* fall back below */ }
    if (!c) {
      try { c = (await api.retroMeta()).center; } catch { c = { lat: 0, lng: 0 }; }
    }
    setCenter(c); setPrecise(gotPrecise);
    try { setList((await api.retroNearby(c.lat, c.lng)).businesses); } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { init(); }, [init]);

  const placed = useMemo(() => {
    if (!center || list.length === 0) return { pins: [] as (RetroBusiness & { x: number; y: number; meters: number })[], maxM: 500 };
    const latRad = (center.lat * Math.PI) / 180;
    const raw = list.map((b) => {
      const yM = ((b.lat ?? center.lat) - center.lat) * 111320;
      const xM = ((b.lng ?? center.lng) - center.lng) * 111320 * Math.cos(latRad);
      const meters = Math.sqrt(xM * xM + yM * yM);
      return { b, xM, yM, meters };
    });
    const maxM = Math.max(200, ...raw.map((r) => r.meters)) * 1.12;
    const radiusPx = HALF - PAD;
    const scale = radiusPx / maxM;
    const pins = raw.map((r) => ({ ...r.b, meters: r.meters, x: HALF + r.xM * scale, y: HALF - r.yM * scale }));
    return { pins, maxM };
  }, [center, list]);

  const sel = placed.pins.find((p) => p.id === selected) || null;
  const grid = colors.border;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="map-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Browse Nearby</Text>
          <Eyebrow>Retrospections</Eyebrow>
        </View>
      </View>

      {loading ? (
        <Loading label="Finding places around you…" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {!precise ? (
            <Pressable onPress={() => Linking.openSettings()} style={[styles.banner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="map-marker-off-outline" size={16} color={colors.muted} />
              <Text style={[styles.bannerText, { color: colors.muted }]}>Showing the district centre. Enable location for your exact surroundings.</Text>
            </Pressable>
          ) : null}

          <View style={[styles.mapWrap, { width: SIZE, height: SIZE, alignSelf: "center", backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Svg width={SIZE} height={SIZE}>
              {[1, 2, 3].map((i) => (
                <Circle key={i} cx={HALF} cy={HALF} r={(HALF - PAD) * (i / 3)} stroke={grid} strokeWidth={1} fill="none" strokeDasharray="4 5" />
              ))}
              <Line x1={HALF} y1={PAD / 2} x2={HALF} y2={SIZE - PAD / 2} stroke={grid} strokeWidth={0.5} />
              <Line x1={PAD / 2} y1={HALF} x2={SIZE - PAD / 2} y2={HALF} stroke={grid} strokeWidth={0.5} />
              {[1, 2, 3].map((i) => (
                <SvgText key={`l${i}`} x={HALF + 4} y={HALF - (HALF - PAD) * (i / 3) + 12} fontSize={9} fill={colors.muted}>
                  {ringLabel((placed.maxM * i) / 3)}
                </SvgText>
              ))}
            </Svg>

            {/* User marker */}
            <View style={[styles.you, { left: HALF - 9, top: HALF - 9, borderColor: colors.surface, backgroundColor: colors.brand }]} />

            {/* Business pins */}
            {placed.pins.map((p) => {
              const m = catMeta(p.category);
              const active = p.id === selected;
              return (
                <Pressable key={p.id} onPress={() => setSelected(active ? null : p.id)} hitSlop={6}
                  style={[styles.pin, { left: p.x - 13, top: p.y - 13, backgroundColor: m.color, borderColor: active ? colors.onSurface : colors.surface, transform: [{ scale: active ? 1.25 : 1 }] }]}
                  testID={`map-pin-${p.id}`}>
                  <MaterialCommunityIcons name={m.icon} size={14} color="#fff" />
                </Pressable>
              );
            })}
          </View>

          {/* Selected callout */}
          {sel ? (
            <Pressable onPress={() => router.push(`/retrospections/business/${sel.id}`)} style={[styles.callout, { backgroundColor: colors.surfaceSecondary, borderColor: catMeta(sel.category).color }]} testID="map-callout">
              <View style={[styles.calloutIcon, { backgroundColor: `${catMeta(sel.category).color}22` }]}>
                <MaterialCommunityIcons name={catMeta(sel.category).icon} size={20} color={catMeta(sel.category).color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.calloutTitle, { color: colors.onSurface }]} numberOfLines={1}>{sel.name}</Text>
                <Text style={[styles.calloutMeta, { color: colors.muted }]}>{sel.category} · ★ {sel.avg_rating.toFixed(1)} · {fmtDistance(sel.distance_km)}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
            </Pressable>
          ) : (
            <Text style={[styles.tapHint, { color: colors.muted }]}>Tap a pin to see the place. You are at the centre.</Text>
          )}

          <Eyebrow style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Nearest to you</Eyebrow>
          {placed.pins.slice().sort((a, b) => a.meters - b.meters).map((p) => {
            const m = catMeta(p.category);
            return (
              <Pressable key={p.id} onPress={() => router.push(`/retrospections/business/${p.id}`)} style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`map-row-${p.id}`}>
                <View style={[styles.rowIcon, { backgroundColor: `${m.color}22` }]}>
                  <MaterialCommunityIcons name={m.icon} size={18} color={m.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.onSurface }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[styles.rowMeta, { color: colors.muted }]}>★ {p.avg_rating.toFixed(1)} ({p.review_count}) · {p.category}</Text>
                </View>
                <Text style={[styles.rowDist, { color: colors.brand }]}>{fmtDistance(p.distance_km)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  bannerText: { fontFamily: fonts.body, fontSize: 12.5, flex: 1, lineHeight: 18 },
  mapWrap: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  you: { position: "absolute", width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  pin: { position: "absolute", width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  callout: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md, marginTop: spacing.md },
  calloutIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  calloutTitle: { fontFamily: fonts.bodyBold, fontSize: 15 },
  calloutMeta: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  tapHint: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", marginTop: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.sm, paddingRight: spacing.md, marginBottom: spacing.sm },
  rowIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  rowMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  rowDist: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
});
