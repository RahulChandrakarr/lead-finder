"use client";

import { useActionState } from "react";
import { sendNowAction, type ActionState } from "@/app/actions";

export function SendNowButton() {
  const [state, action, pending] = useActionState<ActionState, FormData>(() => sendNowAction(), {});
  return (
    <form action={action} className="flex items-center gap-3">
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      <button className="btn" disabled={pending}>{pending ? "Sending…" : "Send next batch now"}</button>
    </form>
  );
}
