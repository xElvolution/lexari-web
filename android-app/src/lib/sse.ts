/** Split a text/event-stream buffer into JSON payloads. The web chat sends `data: {...}\\n\\n`. */
export function takeSse(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: string[] = [];
  for (const block of parts) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (data) events.push(data);
  }
  return { events, rest };
}
