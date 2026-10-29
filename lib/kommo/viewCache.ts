const PREFIX = "kommo-view:";
const MAX_AGE = 3 * 60 * 1000;

type Entry = { at: number; body: unknown };

export function readViewCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry;
    if (!parsed || typeof parsed.at !== "number" || Date.now() - parsed.at > MAX_AGE) return null;
    return parsed.body as T;
  } catch {
    return null;
  }
}

export function writeViewCache(key: string, body: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), body }));
  } catch {
    // O navegador pode recusar quando o armazenamento da aba está cheio.
  }
}
