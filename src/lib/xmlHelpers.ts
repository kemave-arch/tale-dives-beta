import type { StatBonus } from '../types.ts'

// Shared primitives for parsing the app's hand-rolled XML wire formats —
// originally private to xmlTurnParser.ts, extracted so a second grammar
// (worldSeedParser.ts, for the one-time world-seeding call) can reuse the
// same attribute-reading/entity-decoding logic instead of duplicating it.
// Both parsers still do their own DOMParser call and querySelector walk —
// only the primitives below are actually shared.

export class XmlParseError extends Error {}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

// Handles the 5 predefined XML entities plus numeric character references
// (&#39; / &#x27;) — the model is only instructed to escape literal &, but
// decoding the full set is defensive in case it over-escapes.
export function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (full, code: string) => {
    if (code[0] === '#') {
      const codepoint = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(codepoint) ? String.fromCodePoint(codepoint) : full
    }
    return XML_ENTITIES[code] ?? full
  })
}

export function num(v: string | null): number | undefined {
  if (v === null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export function reqNum(v: string | null, field: string): number {
  const n = num(v)
  if (n === undefined) throw new XmlParseError(`Missing/invalid required numeric attribute: ${field}`)
  return n
}

export function str(v: string | null): string | undefined {
  return v === null || v === '' ? undefined : v
}

export function reqStr(v: string | null, field: string): string {
  const s = str(v)
  if (s === undefined) throw new XmlParseError(`Missing required attribute: ${field}`)
  return s
}

// "+2 AGI, +5 MP" -> { AGI: 2, mp: 5 }. Shared freeform stat-bonus format
// used both by a turn's <item> bonus attribute (xmlTurnParser.ts) and a
// seeded key item's <item> bonus attribute (worldSeedParser.ts).
export function parseStatBonus(text: string): StatBonus {
  const bonus: StatBonus = {}
  const attrKeys: (keyof StatBonus)[] = ['STR', 'INT', 'AGI', 'hp', 'mp', 'st']
  for (const part of text.split(',')) {
    const match = part.trim().match(/^([+-]?\d+)\s*(\w+)$/)
    if (!match) continue
    const [, amountStr, key] = match
    const found = attrKeys.find((k) => k.toLowerCase() === key.toLowerCase())
    if (found) bonus[found] = Number(amountStr)
  }
  return bonus
}

// Extracts `<blockTag>...</blockTag>` from a raw response and parses its
// inner content as XML via DOMParser, wrapped in a synthetic <root> so
// multiple repeated sibling tags parse cleanly. Throws XmlParseError if the
// block is missing or malformed — callers decide what (if anything) to
// fall back to.
export function parseXmlBlock(raw: string, blockTag: string): Document {
  const blockMatch = raw.match(new RegExp(`<${blockTag}>([\\s\\S]*?)</${blockTag}>`))
  if (!blockMatch) throw new XmlParseError(`No <${blockTag}> block found`)
  const doc = new DOMParser().parseFromString(`<root>${blockMatch[1]}</root>`, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new XmlParseError(`Malformed <${blockTag}> XML: ${parseError.textContent}`)
  return doc
}
