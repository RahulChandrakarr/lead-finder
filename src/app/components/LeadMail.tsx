export function LeadMail({ subject, body }: { subject: string; body: string }) {
  if (!subject) return <span className="text-xs text-zinc-400">No template yet</span>;
  return (
    <div className="max-h-40 w-80 overflow-y-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-xs">
      <p className="font-medium text-zinc-900">{subject}</p>
      <pre className="mt-1 whitespace-pre-wrap font-sans text-zinc-700">{body}</pre>
    </div>
  );
}
