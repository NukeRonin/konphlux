// Profession Plaza — Job Board helpers.

export const APP_STATUSES = ["submitted", "reviewed", "accepted", "rejected"] as const;

export function statusLabel(s: string): string {
  return ({ submitted: "Submitted", reviewed: "Reviewed", accepted: "Accepted", rejected: "Rejected" } as Record<string, string>)[s] || s;
}

/** Returns a hex tint for an application status. */
export function statusColor(s: string): string {
  return ({ submitted: "#B7791F", reviewed: "#3182CE", accepted: "#2F855A", rejected: "#C53030" } as Record<string, string>)[s] || "#718096";
}

export function salaryText(min: number, max: number): string {
  const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
  if (!min && !max) return "";
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt(min || max);
}

export function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    if (d > 0) return `${d}d ago`;
    const h = Math.floor(diff / 3600000);
    if (h > 0) return `${h}h ago`;
    const m = Math.floor(diff / 60000);
    return m > 0 ? `${m}m ago` : "just now";
  } catch {
    return "";
  }
}
