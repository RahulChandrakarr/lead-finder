"use client";

import { updateLeadStatus } from "@/app/actions";

const STATUSES = ["new", "contacted", "replied", "bounced", "unsubscribed"];

export function LeadStatusSelect({ id, status }: { id: string; status: string }) {
  return (
    <select
      defaultValue={status}
      onChange={(e) => void updateLeadStatus(id, e.target.value)}
      className="rounded border border-zinc-200 bg-white px-1 py-0.5 text-xs"
    >
      {STATUSES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}
