export function apiBase(value: string | undefined = undefined): string {
  const raw =
    value !== undefined
      ? value
      : typeof import.meta !== "undefined"
        ? String((import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? "")
        : "";
  return raw.replace(/\/$/, "");
}

export function apiUrl(path: string, base = apiBase()): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
