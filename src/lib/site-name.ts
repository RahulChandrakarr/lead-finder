const GENERIC = /^(home|welcome|welcome to our website|untitled|index|official site|official website)$/i;

function decode(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match?.[2] ?? "";
}

function meta(html: string, key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const prop = attr(tag, "property") || attr(tag, "name");
    if (prop.toLowerCase() === key.toLowerCase()) return attr(tag, "content");
  }
  return "";
}

/** Pulls a business name from a homepage: site name, then a non-generic title segment. */
export function nameFromHtml(html: string) {
  const raw = meta(html, "og:site_name") || meta(html, "application-name") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
  const text = decode(raw).replace(/\s+/g, " ").trim();
  if (!text) return null;
  const parts = text.split(/\s+[|\-–—•·:]\s+/).map((s) => s.trim()).filter((s) => s.length >= 2 && s.length <= 80);
  const chosen = parts.find((p) => !GENERIC.test(p)) ?? parts[0];
  if (!chosen || GENERIC.test(chosen)) return null;
  return chosen;
}

/** Keeps the Maps name when it is already more specific than the website title. */
export function chooseBusinessName(mapsName: string, extracted: string | null) {
  const current = mapsName.trim();
  const found = extracted?.trim();
  if (!found) return current;
  const fold = (s: string) => s.toLowerCase().replace(/[’']/g, "'");
  const currentKey = fold(current);
  const foundKey = fold(found);
  if (currentKey === foundKey || currentKey.includes(foundKey)) return current;
  return found;
}
