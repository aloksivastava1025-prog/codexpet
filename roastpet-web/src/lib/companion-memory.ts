export function parseMemoryNotes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12);
  } catch {
    return [];
  }
}

export function stringifyMemoryNotes(notes: string[]) {
  return JSON.stringify(notes.slice(0, 12));
}

export function extractMemoryCandidates(message: string) {
  const text = String(message || "").trim();
  const lowered = text.toLowerCase();
  const notes: string[] = [];

  const patterns: Array<[RegExp, string]> = [
    [/\bmy name is ([a-zA-Z][a-zA-Z0-9 _-]{1,30})/i, "Name"],
    [/\bi am building ([^.!\n]+)/i, "Building"],
    [/\bi'm building ([^.!\n]+)/i, "Building"],
    [/\bi work on ([^.!\n]+)/i, "Works on"],
    [/\bi like ([^.!\n]+)/i, "Likes"],
    [/\bi love ([^.!\n]+)/i, "Loves"],
    [/\bmy favorite ([a-zA-Z ]+) is ([^.!\n]+)/i, "Favorite"],
    [/\bi use ([^.!\n]+)/i, "Uses"],
    [/\bi live in ([^.!\n]+)/i, "Lives in"],
    [/\bmera naam ([a-zA-Z][a-zA-Z0-9 _-]{1,30})/i, "Name"],
    [/\bmain ([^.!\n]+) build kar raha/iu, "Building"],
    [/\bmujhe ([^.!\n]+) pasand hai/iu, "Likes"],
    [/\bmera favorite ([^.!\n]+)/iu, "Favorite"],
  ];

  for (const [pattern, label] of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = match[match.length - 1]?.trim();
    if (value && value.length <= 80) {
      notes.push(`${label}: ${value}`);
    }
  }

  if (lowered.includes("my project") && text.length <= 120) {
    notes.push(`Project note: ${text}`);
  }

  return Array.from(new Set(notes)).slice(0, 4);
}

export function mergeMemoryNotes(existing: string[], incoming: string[]) {
  const merged = [...existing];
  for (const note of incoming) {
    if (!merged.includes(note)) {
      merged.push(note);
    }
  }
  return merged.slice(-12);
}
