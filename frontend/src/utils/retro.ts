import { MaterialCommunityIcons } from "@expo/vector-icons";

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

export const RETRO_CATEGORY_META: Record<string, { icon: Icon; color: string }> = {
  Restaurants: { icon: "silverware-fork-knife", color: "#DD6B20" },
  "Cafés": { icon: "coffee", color: "#B7791F" },
  Retail: { icon: "shopping", color: "#805AD5" },
  Services: { icon: "wrench", color: "#3182CE" },
  Entertainment: { icon: "drama-masks", color: "#D53F8C" },
  Health: { icon: "heart-pulse", color: "#38A169" },
};

export function catMeta(category: string): { icon: Icon; color: string } {
  return RETRO_CATEGORY_META[category] || { icon: "map-marker", color: "#718096" };
}

export function fmtDistance(km?: number | null): string {
  if (km == null) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
