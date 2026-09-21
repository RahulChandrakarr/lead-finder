"use client";

import { useEffect } from "react";
import { syncJobsAction } from "@/app/actions";

/** While scrape jobs are running, polls Apify every 15s and imports finished results. */
export function AutoSync({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => void syncJobsAction(), 15_000);
    return () => clearInterval(id);
  }, [active]);
  return active ? <span className="text-xs text-zinc-500">Auto-refreshing every 15s…</span> : null;
}
