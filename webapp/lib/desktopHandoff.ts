/** Sign-in from the Lexari desktop app: /sign-in?desktop=1&return=lexari://auth/callback */
export function desktopReturn(): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const ret = q.get("return") || "";
  if (q.get("desktop") !== "1" || !/^lexari:\/\/[A-Za-z0-9/_.-]*$/.test(ret) || ret.length > 200) return null;
  return ret;
}

/** After a web sign-in, send a one-time code back to the desktop app. False means stay on the web. */
export async function handoffToDesktop(ret: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/desktop/code", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ return: ret }) });
    if (!res.ok) return false;
    const { url } = (await res.json()) as { url?: string };
    if (!url || !url.startsWith("lexari://")) return false;
    window.location.href = url;
    return true;
  } catch {
    return false;
  }
}
