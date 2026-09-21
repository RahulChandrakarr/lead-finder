import { connection } from "next/server";
import { query } from "@/lib/db";
import { PLACEHOLDERS } from "@/lib/mailer";
import { createTemplate, deleteTemplate } from "@/app/actions";
import { FormAction } from "@/app/components/FormAction";

type Template = { id: string; name: string; subject: string; body: string; used: boolean };

const EXAMPLE = `Hi {{business_name}} team,

I came across your {{category}} business in {{city}} and had a quick idea to help you get more bookings from your website ({{website}}).

Would you be open to a 10-minute call this week?

Best,
Your Name`;

export default async function TemplatesPage() {
  await connection();
  const templates = await query<Template>(
    `select t.*, exists(select 1 from campaigns c where c.template_id = t.id) as used from templates t order by t.id desc`,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Email templates</h1>
        <FormAction action={createTemplate} className="card space-y-3">
          <div>
            <label className="label" htmlFor="name">Template name</label>
            <input id="name" name="name" className="input" placeholder="Intro – restaurants" required />
          </div>
          <div>
            <label className="label" htmlFor="subject">Subject</label>
            <input id="subject" name="subject" className="input" defaultValue="Quick idea for {{business_name}}" required />
          </div>
          <div>
            <label className="label" htmlFor="body">Body (plain text)</label>
            <textarea id="body" name="body" rows={12} className="input font-mono" defaultValue={EXAMPLE} required />
          </div>
          <p className="text-xs text-zinc-500">
            Placeholders: {PLACEHOLDERS.map((p) => <code key={p} className="mr-1 rounded bg-zinc-100 px-1">{`{{${p}}}`}</code>)}
            <br />An unsubscribe link and your postal address are added to every email automatically.
          </p>
          <button className="btn">Save template</button>
        </FormAction>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium lg:mt-10">Saved ({templates.length})</h2>
        {templates.map((t) => (
          <div key={t.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-zinc-600">{t.subject}</div>
              </div>
              {!t.used && (
                <form action={deleteTemplate.bind(null, t.id)}>
                  <button className="text-xs text-zinc-400 hover:text-red-600">Delete</button>
                </form>
              )}
            </div>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-zinc-700">{t.body}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
