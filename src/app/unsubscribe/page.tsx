import { unsubscribeByToken } from "@/lib/mailer";

// Public page (excluded from auth in src/proxy.ts). Requires a click so link scanners don't unsubscribe people.
export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const { t, done } = await searchParams;
  const token = typeof t === "string" ? t : "";

  async function confirm() {
    "use server";
    const { redirect } = await import("next/navigation");
    await unsubscribeByToken(token);
    redirect(`/unsubscribe?done=1`);
  }

  return (
    <div className="mx-auto mt-16 max-w-md card text-center">
      {done ? (
        <p>You’ve been unsubscribed and won’t receive further emails.</p>
      ) : (
        <form action={confirm} className="space-y-4">
          <p>Unsubscribe from future emails?</p>
          <button className="btn">Unsubscribe</button>
        </form>
      )}
    </div>
  );
}
