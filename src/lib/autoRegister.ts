import type { Dict, EnsureResult } from '../types.ts'

// Shared stub-creation pattern — Blueprint §5.14. Every Codex category
// (Locations first, then NPCs/Adversaries/Items) reuses this same rule:
// when the model references something the client doesn't have yet, stub
// one in immediately, flagged autoLogged so the UI can mark/correct it later.
export function ensureEntry<T extends { autoLogged?: boolean }>(
  dict: Dict<T> | undefined,
  id: string | undefined,
  factory: () => Omit<T, 'autoLogged'>,
): EnsureResult<T> {
  const safeDict: Dict<T> = dict ?? {} // tolerate saves from before this Codex category existed
  if (!id) {
    return { dict: safeDict, entry: null, created: false }
  }
  if (safeDict[id]) {
    return { dict: safeDict, entry: safeDict[id], created: false }
  }
  const entry = { ...factory(), autoLogged: true } as T
  return { dict: { ...safeDict, [id]: entry }, entry, created: true }
}
