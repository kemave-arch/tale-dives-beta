import type { Dict, EnsureResult } from '../types.ts'

// Shared stub-creation pattern — Blueprint §5.14. Every Codex category
// (Locations first, then NPCs/Adversaries/Items) reuses this same rule:
// when the model references something the client doesn't have yet, stub
// one in immediately, flagged autoLogged so the UI can mark/correct it later.
export function ensureEntry<T extends { autoLogged?: boolean; loggedAt?: string }>(
  dict: Dict<T> | undefined,
  id: string | undefined,
  factory: () => Omit<T, 'autoLogged'>,
  turnRef?: string,
): EnsureResult<T> {
  const safeDict: Dict<T> = dict ?? {} // tolerate saves from before this Codex category existed
  if (!id) {
    return { dict: safeDict, entry: null, created: false }
  }
  if (safeDict[id]) {
    return { dict: safeDict, entry: safeDict[id], created: false }
  }
  // loggedAt stamps the turn this entry first existed — omitted (not a blank
  // string) when the caller has no turnRef to give (e.g. campaign creation's
  // seeding pass, which isn't a turn), same optionality as autoLogged itself.
  const entry = { ...factory(), autoLogged: true, ...(turnRef ? { loggedAt: turnRef } : {}) } as T
  return { dict: { ...safeDict, [id]: entry }, entry, created: true }
}
