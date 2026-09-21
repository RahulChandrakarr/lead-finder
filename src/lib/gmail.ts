import "server-only";
import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import { decrypt, encrypt } from "./crypto";
import { query } from "./db";

// Gmail / Google Workspace sending via OAuth + Gmail API (scope: gmail.send only).
const SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.send"];

function creds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set in .env.local");
  return { id, secret };
}

export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function redirectUri() {
  return `${process.env.APP_URL ?? "http://localhost:3000"}/api/google/callback`;
}

export function authUrl(state: string) {
  const params = new URLSearchParams({
    client_id: creds().id,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account", // always return a refresh token
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope: string };

async function tokenRequest(body: Record<string, string>) {
  const { id, secret } = creds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${json.error_description ?? json.error ?? res.status}`);
  return json as TokenResponse;
}

/** Exchanges the OAuth code and saves (or updates) the connected account. */
export async function connectAccount(code: string) {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!tokens.scope.includes("gmail.send")) throw new Error("Gmail send permission was not granted — tick the checkbox on the consent screen.");
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and try again.");

  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  });
  const user = (await res.json()) as { email: string; name?: string };

  await query(
    `insert into mail_accounts (email, from_name, refresh_token_enc) values (lower($1), $2, $3)
     on conflict (email) do update set refresh_token_enc = excluded.refresh_token_enc`,
    [user.email, user.name ?? null, encrypt(tokens.refresh_token)],
  );
  accessTokens.delete(user.email.toLowerCase());
  return user.email;
}

export type MailAccount = { id: string; email: string; from_name: string | null; refresh_token_enc: string; daily_limit: number };

const accessTokens = new Map<string, { token: string; expires: number }>();

async function accessToken(account: MailAccount) {
  const cached = accessTokens.get(account.email);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const t = await tokenRequest({ refresh_token: decrypt(account.refresh_token_enc), grant_type: "refresh_token" });
  accessTokens.set(account.email, { token: t.access_token, expires: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

/** Sends one message from a connected Gmail account. Returns Gmail's message/thread ids. */
export async function sendViaGmail(account: MailAccount, message: Mail.Options) {
  const from = account.from_name ? `"${account.from_name.replace(/"/g, "")}" <${account.email}>` : account.email;
  const raw = await new MailComposer({ ...message, from }).compile().build();
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(account)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: raw.toString("base64url") }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${json.error?.message ?? JSON.stringify(json)}`);
  return json as { id: string; threadId: string };
}
