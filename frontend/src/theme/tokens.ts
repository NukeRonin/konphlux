// Konphlux design tokens — steampunk parchment aesthetic (from website design system).

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 24,
  pill: 999,
} as const;

export const fonts = {
  display: "Cinzel-Bold",
  displaySemi: "Cinzel-SemiBold",
  displayReg: "Cinzel-Regular",
  body: "Karla-Regular",
  bodyMedium: "Karla-Medium",
  bodyBold: "Karla-Bold",
} as const;

export type ThemeColors = {
  surface: string;
  onSurface: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  surfaceInverse: string;
  onSurfaceInverse: string;
  brand: string;
  brandPrimary: string;
  onBrandPrimary: string;
  brandSecondary: string; // copper
  bronze: string;
  wood: string;
  aether: string; // glowing blue
  onAether: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  borderStrong: string;
  divider: string;
  muted: string; // muted foreground text
  shadow: string;
  // brass gradient stops
  brassGradient: [string, string, string];
};

export const lightColors: ThemeColors = {
  surface: "#F6F1E7",
  onSurface: "#3B3229",
  surfaceSecondary: "#FCF9F2",
  surfaceTertiary: "#EAE3D1",
  surfaceInverse: "#2A2620",
  onSurfaceInverse: "#F6F1E7",
  brand: "#A67C3D",
  brandPrimary: "#C69B54",
  onBrandPrimary: "#2A2620",
  brandSecondary: "#B06C3A",
  bronze: "#7C6544",
  wood: "#5A4632",
  aether: "#2E7FC9",
  onAether: "#FFFFFF",
  success: "#4A7C59",
  warning: "#B06C3A",
  error: "#8B3A3A",
  border: "#DDD2BE",
  borderStrong: "#C69B54",
  divider: "#E4DBCD",
  muted: "#8A7A63",
  shadow: "#3A2E1E",
  brassGradient: ["#E4C489", "#C69B54", "#B06C3A"],
};

export const darkColors: ThemeColors = {
  surface: "#2A2620",
  onSurface: "#F6F1E7",
  surfaceSecondary: "#35302A",
  surfaceTertiary: "#403A33",
  surfaceInverse: "#F6F1E7",
  onSurfaceInverse: "#2A2620",
  brand: "#C69B54",
  brandPrimary: "#D9B26A",
  onBrandPrimary: "#2A2620",
  brandSecondary: "#C57E47",
  bronze: "#9A7E56",
  wood: "#4A3A29",
  aether: "#4BA0EA",
  onAether: "#0F1620",
  success: "#5D9C70",
  warning: "#C57E47",
  error: "#C56A6A",
  border: "#4A433A",
  borderStrong: "#A67C3D",
  divider: "#3A342D",
  muted: "#A79A83",
  shadow: "#000000",
  brassGradient: ["#E7CD94", "#D9B26A", "#C57E47"],
};

// centimo -> formatted price string
export const formatPrice = (cents: number): string =>
  "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const compactNumber = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
};

export const timeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
