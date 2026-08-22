// PictureShow AI Video Suite — shared option catalogues.

export type PSKind = "video" | "animation";

export const PS_STYLES: { key: string; note: string }[] = [
  { key: "Cinematic", note: "Big-budget film look" },
  { key: "Documentary", note: "Handheld, natural, real" },
  { key: "Music Video", note: "Bold colour, beat-cut energy" },
  { key: "Noir", note: "High-contrast black & white" },
  { key: "Splash Noir", note: "Noir with one splash of colour" },
  { key: "Sepia", note: "Warm vintage tone" },
  { key: "Cool Toon", note: "Live action mixed with cartoon" },
];

export const PS_LENGTHS = ["10 seconds", "30 seconds", "5 minutes", "20 minutes", "60 minutes", "90 minutes", "150 minutes"];

export const PS_SPEEDS = ["0.5× (slow)", "0.75×", "1× (normal)", "1.25×", "1.5×", "2× (fast)"];

export const PS_TRANSITIONS = [
  "Swap", "Cube", "Page Curl Left", "Cross Blur", "Cross Dissolve",
  "Cross Zoom", "Ripple", "Mosaic", "Circle Close", "Wipe Down",
];

export const PS_ATMOSPHERICS = ["X-Ray", "Film Grain", "Aged Film", "Glitchy", "Negative", "Sci-Fi"];

export const PS_TITLES = [
  "Slide", "Split", "Chromatic", "Standard", "Expand", "Reveal", "Focus",
  "Pop-Up", "Gravity", "Echo", "Overlap", "Drifting", "Prism", "Zoom",
  "Horizontal Blur", "Vertical Blur", "Soft Edge", "Scrolling Credits",
];

export const PS_FINISHING = ["Ken Burns", "Reduce background noise"];

export const PS_AUDIO_EFFECTS = ["Pitch Up", "Pitch Down", "Robot", "Alien"];

export function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
