import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { Freelancer } from "@/src/api/client";

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const RESUME_THEMES = [
  { key: "brass", label: "Brass" },
  { key: "slate", label: "Slate" },
  { key: "ink", label: "Ink" },
  { key: "rose", label: "Rose" },
];

const THEME_VARS: Record<string, { accent: string; text: string; sub: string; chipBg: string; chipText: string; rule: string; font: string }> = {
  brass: { accent: "#7a5a1e", text: "#2d2416", sub: "#5a4a2a", chipBg: "#f2ead8", chipText: "#6a5320", rule: "#e6dcc5", font: "Georgia, 'Times New Roman', serif" },
  slate: { accent: "#2c5282", text: "#1a202c", sub: "#4a5568", chipBg: "#e6effa", chipText: "#2c5282", rule: "#cbd5e0", font: "-apple-system, Helvetica, Arial, sans-serif" },
  ink: { accent: "#1a1a1a", text: "#111111", sub: "#444444", chipBg: "#eeeeee", chipText: "#222222", rule: "#dddddd", font: "'Courier New', monospace" },
  rose: { accent: "#9b2c5d", text: "#2d1a24", sub: "#6b4453", chipBg: "#fbe6ef", chipText: "#9b2c5d", rule: "#f0d5df", font: "Georgia, serif" },
};

function resumeHtml(f: Freelancer, theme = "brass"): string {
  const t = THEME_VARS[theme] || THEME_VARS.brass;
  const skills = (f.skills || []).map((s) => `<span class="skill">${esc(s)}</span>`).join("");
  const links = (f.links || []).map((l) => `<div class="link">${esc(l)}</div>`).join("");
  const exp = (f.experience || [])
    .filter((e) => e.role || e.org || e.detail)
    .map((e) => `<div class="exp"><div class="exp-h">${esc(e.role)}${e.org ? ` · ${esc(e.org)}` : ""}</div>${e.detail ? `<div class="exp-d">${esc(e.detail)}</div>` : ""}</div>`)
    .join("");
  const rate = f.hourly_rate ? `$${f.hourly_rate}/hr` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    * { box-sizing: border-box; }
    body { font-family: ${t.font}; color: ${t.text}; margin: 0; padding: 40px; }
    .name { font-size: 30px; font-weight: 800; color: ${t.accent}; }
    .headline { font-size: 16px; color: ${t.sub}; margin-top: 4px; }
    .meta { font-size: 13px; color: ${t.sub}; margin-top: 8px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: ${t.accent}; border-bottom: 2px solid ${t.rule}; padding-bottom: 4px; margin-top: 28px; }
    p { font-size: 14px; line-height: 1.5; }
    .skill { display: inline-block; background: ${t.chipBg}; color: ${t.chipText}; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin: 3px 4px 3px 0; }
    .exp { margin-bottom: 12px; }
    .exp-h { font-weight: 700; font-size: 14px; }
    .exp-d { font-size: 13px; color: ${t.sub}; margin-top: 2px; }
    .link { font-size: 13px; color: ${t.accent}; }
  </style></head><body>
    <div class="name">${esc(f.name)}</div>
    ${f.headline ? `<div class="headline">${esc(f.headline)}</div>` : ""}
    <div class="meta">${[f.location, rate, f.category].filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ")}</div>
    ${f.bio ? `<h2>About</h2><p>${esc(f.bio)}</p>` : ""}
    ${skills ? `<h2>Skills</h2><div>${skills}</div>` : ""}
    ${exp ? `<h2>Experience</h2>${exp}` : ""}
    ${links ? `<h2>Links</h2>${links}` : ""}
  </body></html>`;
}

/** Generate a PDF of the résumé and open the share sheet. */
export async function shareResumePdf(f: Freelancer, theme = "brass"): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: resumeHtml(f, theme) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${f.name} — Résumé`, UTI: "com.adobe.pdf" });
  }
}
