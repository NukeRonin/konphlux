import { useEffect, useState } from "react";

import { DBFundingModel } from "@/src/api/client";

export const FUNDING_MODELS: Record<DBFundingModel, { label: string; short: string; blurb: string; icon: string }> = {
  all_or_nothing: {
    label: "All-or-Nothing",
    short: "Only funded if goal is met",
    blurb: "You receive the funds only if your goal is reached by the deadline. If it falls short, backers are not charged the pledged amount. Best when you need the full amount to deliver.",
    icon: "flag-checkered",
  },
  keep_what_you_raise: {
    label: "Keep-What-You-Raise",
    short: "Keep every contribution",
    blurb: "You keep every contribution as it comes in, whether or not you hit your goal. Best for ongoing efforts where any amount helps.",
    icon: "piggy-bank-outline",
  },
};

export type Countdown = { done: boolean; days: number; hours: number; minutes: number; seconds: number };

export function timeLeft(deadlineISO: string | null): Countdown | null {
  if (!deadlineISO) return null;
  const end = new Date(deadlineISO).getTime();
  if (isNaN(end)) return null;
  let diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
  const days = Math.floor(diff / 86400); diff -= days * 86400;
  const hours = Math.floor(diff / 3600); diff -= hours * 3600;
  const minutes = Math.floor(diff / 60); diff -= minutes * 60;
  return { done: end <= Date.now(), days, hours, minutes, seconds: diff };
}

// Live-updating countdown (ticks every second).
export function useCountdown(deadlineISO: string | null): Countdown | null {
  const [c, setC] = useState<Countdown | null>(() => timeLeft(deadlineISO));
  useEffect(() => {
    setC(timeLeft(deadlineISO));
    if (!deadlineISO) return;
    const t = setInterval(() => setC(timeLeft(deadlineISO)), 1000);
    return () => clearInterval(t);
  }, [deadlineISO]);
  return c;
}

export const fmtDeadline = (iso: string | null): string => {
  if (!iso) return "No deadline";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "No deadline";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

export const DB_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: "art", label: "Art", icon: "palette" },
  { key: "tech", label: "Tech", icon: "chip" },
  { key: "community", label: "Community", icon: "account-group" },
  { key: "games", label: "Games", icon: "controller-classic" },
  { key: "music", label: "Music", icon: "music" },
  { key: "film", label: "Film", icon: "movie-open" },
  { key: "publishing", label: "Publishing", icon: "book-open-page-variant" },
  { key: "food", label: "Food", icon: "silverware-fork-knife" },
  { key: "fashion", label: "Fashion", icon: "tshirt-crew" },
  { key: "other", label: "Other", icon: "shape" },
];

export const categoryMeta = (key: string) => DB_CATEGORIES.find((c) => c.key === key) ?? DB_CATEGORIES[DB_CATEGORIES.length - 1];
