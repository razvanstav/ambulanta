export function hasSameOrigin(origin: string | null, host: string | null) {
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && url.host === host && url.origin === origin;
  } catch {
    return false;
  }
}
