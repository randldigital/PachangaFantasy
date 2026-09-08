export function uniqueLeaguePlayerName(
  desired: string,
  existing: string[],
  maxLength = 30,
): string {
  const taken = new Set(existing.map((name) => name.toLowerCase()));
  const base = desired.slice(0, maxLength).trim() || "Player";
  if (!taken.has(base.toLowerCase())) {
    return base;
  }

  let index = 2;
  while (index < 1000) {
    const suffix = ` (${index})`;
    const name = `${base.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
    if (!taken.has(name.toLowerCase())) {
      return name;
    }
    index += 1;
  }

  return `${base.slice(0, 24)} (${Date.now() % 1000})`;
}
