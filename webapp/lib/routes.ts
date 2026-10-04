/** The app used to live under /app (/app?c=<id> for a chat, /app/memory for Brain, /app/bond for Hub). Old links get a 301. */
const RENAMED: Record<string, string> = { memory: "brain", bond: "hub", chat: "agents" };
export function legacyPath(pathname: string, search: URLSearchParams): string | null {
  if (pathname !== "/app" && !pathname.startsWith("/app/")) return null;
  const parts = pathname.split("/").filter(Boolean).slice(1); // after "app"
  const c = search.get("c");
  if (!parts.length) return c ? `/agents/${encodeURIComponent(c)}` : "/agents";
  const [head, ...rest] = parts;
  if (head === "chat") return rest.length ? `/agents/${rest.map(encodeURIComponent).join("/")}` : "/agents";
  return `/${[RENAMED[head] ?? head, ...rest].join("/")}`;
}

/** A stored link (a notification) in today's form: old /app links are rewritten, anything else is kept. */
export function modernUrl(url: string) {
  try {
    const u = new URL(url, "https://x.invalid");
    const to = legacyPath(u.pathname, u.searchParams);
    if (!to) return url;
    u.searchParams.delete("c");
    return `${to}${u.search}${u.hash}`;
  } catch { return url; }
}
