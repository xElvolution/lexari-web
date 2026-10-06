/** Pure helpers for chat threads (no React, no browser APIs), so they can be unit tested. */
type Msg = { id: string; at: number };

/**
 * Server threads plus any local message the server doesn't have yet. A thread is never emptied by a reload.
 * A local-only message (a reply still streaming, a message waiting its turn) keeps its place right after the message it
 * followed on screen. Sorting those by time put a streaming reply ABOVE your message: the server stamps your message when
 * it saves it (after the wallet and history reads, often a second or more later, plus any clock skew between phone and
 * server), while the reply bubble carries the phone's clock from the moment it opened.
 */
export function mergeThreads<M extends Msg>(local: Record<string, M[]>, server: Record<string, M[]>) {
  const out: Record<string, M[]> = { ...server };
  for (const [k, mine] of Object.entries(local)) {
    const theirs = server[k] || [];
    const ids = new Set(theirs.map((m) => m.id));
    const newest = theirs.length ? theirs[theirs.length - 1].at : 0;
    const keep = (m: M) => !ids.has(m.id) && m.id !== "hello" && (m.at >= newest - 120_000 || !theirs.length);
    if (!mine.some(keep)) { if (!theirs.length && mine.length) out[k] = mine; continue; }
    const merged = [...theirs];
    let anchor = -1; // where the last local message we walked past sits in `merged`
    for (const m of mine) {
      if (ids.has(m.id) || m.id === "hello") { const i = merged.findIndex((x) => x.id === m.id); if (i >= 0) anchor = i; continue; }
      if (!keep(m)) continue;
      if (anchor >= 0) {
        const at = Math.max(m.at, merged[anchor].at + 1);
        merged.splice(anchor + 1, 0, { ...m, at });
        anchor += 1;
      } else {
        const j = merged.findIndex((x) => x.id !== "hello" && x.at > m.at);
        const at2 = j < 0 ? merged.length : j;
        merged.splice(at2, 0, m);
        anchor = at2;
      }
    }
    out[k] = merged.length > 200 ? [merged[0], ...merged.slice(-199)] : merged;
  }
  return out;
}
