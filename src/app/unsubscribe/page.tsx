import { redirect } from "next/navigation";
import { unsubscribeByToken } from "@/lib/mailer";
import { movedTo } from "@/lib/moved";

// Public page (excluded from auth in src/proxy.ts). Requires a click so link scanners don't unsubscribe people.
export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const { t, done } = await searchParams;
  const token = typeof t === "string" ? t : "";

  // Moved: RactroTech has the same tokens (copied with the data) and asks for the same click.
  const moved = movedTo();
  if (moved) redirect(`${moved}/unsubscribe?${new URLSearchParams(done ? { done: "1" } : { t: token })}`);

  async function confirm() {
    "use server";
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
