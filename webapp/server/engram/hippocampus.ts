/** Split a trailing REMEMBER line off the model reply. The note is a proposal, not a saved memory. */
export function splitRemember(text: string): { reply: string; remember: string | null } {
  const match = text.match(/\n?REMEMBER:\s*(.{3,180})\s*$/);
  if (!match || match.index === undefined) return { reply: text.trim(), remember: null };
  const note = match[1].trim().replace(/^["']|["']$/g, "");
  return { reply: text.slice(0, match.index).trim(), remember: note || null };
}
