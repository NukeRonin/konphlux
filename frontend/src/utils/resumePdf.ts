import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { Freelancer } from "@/src/api/client";

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function resumeHtml(f: Freelancer): string {
  const skills = (f.skills || []).map((s) => `<span class="skill">${esc(s)}</span>`).join("");
  const links = (f.links || []).map((l) => `<div class="link">${esc(l)}</div>`).join("");
  const exp = (f.experience || [])
    .filter((e) => e.role || e.org || e.detail)
    .map((e) => `<div class="exp"><div class="exp-h">${esc(e.role)}${e.org ? ` · ${esc(e.org)}` : ""}</div>${e.detail ? `<div class="exp-d">${esc(e.detail)}</div>` : ""}</div>`)
    .join("");
  const rate = f.hourly_rate ? `$${f.hourly_rate}/hr` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2d2416; margin: 0; padding: 40px; }
    .name { font-size: 30px; font-weight: 800; color: #7a5a1e; }
    .headline { font-size: 16px; color: #5a4a2a; margin-top: 4px; }
    .meta { font-size: 13px; color: #8a7a5a; margin-top: 8px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #7a5a1e; border-bottom: 2px solid #e6dcc5; padding-bottom: 4px; margin-top: 28px; }
    p { font-size: 14px; line-height: 1.5; }
    .skill { display: inline-block; background: #f2ead8; color: #6a5320; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin: 3px 4px 3px 0; }
    .exp { margin-bottom: 12px; }
    .exp-h { font-weight: 700; font-size: 14px; }
    .exp-d { font-size: 13px; color: #5a4a2a; margin-top: 2px; }
    .link { font-size: 13px; color: #7a5a1e; }
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
export async function shareResumePdf(f: Freelancer): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: resumeHtml(f) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${f.name} — Résumé`, UTI: "com.adobe.pdf" });
  }
}
