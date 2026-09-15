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

// The core anti-drift guard for every fixed-vocabulary attribute in the new
// grammar (breakthrough/skill tiers, threat tiers, ...): requires the raw
// attribute value to be present AND an exact case-insensitive match for one
// of `validSet`'s canonical words — anything else (a number, an invented
// synonym, a typo) throws XmlParseError rather than being coerced or
// silently dropped, mirroring reqStr/reqNum's own "missing/invalid required
// attribute" posture.
export function reqTierWord<T extends readonly string[]>(v: string | null, field: string, validSet: T): T[number] {
  const s = str(v)
  if (s === undefined) throw new XmlParseError(`Missing required attribute: ${field}`)
  const match = validSet.find((word) => word.toLowerCase() === s.trim().toLowerCase())
  if (match === undefined) {
    throw new XmlParseError(`Invalid ${field}: "${s}" is not one of ${validSet.join(', ')}`)
  }
  return match
}

// Same as reqTierWord, but optional — returns undefined when the attribute
// is simply absent (a legitimate "not set this turn" case for e.g. an NPC's
// `resolve`). A live QC pass caught the model also writing a literal "none"
// for an optional field it had nothing to report (npc.party, when an NPC
// isn't currently a companion or departed) — for an optional attribute that
// throwing on is just as disproportionate as signToDelta's own "=" case
// was: none of this parser's optional-field vocabularies (competency tiers,
// kinship words, party status) use the literal word "none" for real, so
// treating it as "not set" here can never shadow a genuine value. Anything
// else off-vocabulary still throws — this only widens what counts as absent.
export function optTierWord<T extends readonly string[]>(v: string | null, field: string, validSet: T): T[number] | undefined {
  if (v === null || v === '' || v.trim().toLowerCase() === 'none') return undefined
  return reqTierWord(v, field, validSet)
}

// The new `<npc aff="+|-" trust="+|-">` / `<cond>` sign attributes: a bare
// '+' or '-' character only, never a magnitude, never a signed integer
// string — kept strict about what counts as a real delta, specifically to
// foreclose any drift back toward "small integer" thinking. Absent/empty
// means "no change" (undefined). A live QC pass caught the model also
// writing an explicit `"="` here (a reasonable way to say "no change" on an
// attribute it's already listing others alongside) — and, previously, ANY
// off-vocabulary value here (this one included) threw and discarded the
// *entire* turn's narration/sync, a wildly disproportionate cost for a
// single cosmetic relationship-nudge attribute. Self-heals to "no change"
// instead, same self-heal-over-silent-failure spirit as this file's other
// tolerant parsers (optTierWord, resolveInventoryId).
export function signToDelta(raw: string | null, field: string): -1 | 1 | undefined {
  if (raw === null || raw === '' || raw === '=') return undefined
  if (raw === '+') return 1
  if (raw === '-') return -1
  console.warn(`signToDelta: unrecognized ${field} value "${raw}" — treating as no change`)
  return undefined
}

// Sanitizes raw string for XML parsing by converting unescaped ampersands
// into &amp; while leaving valid XML entities (like &amp;, &lt;, &#39;, etc.) intact.
export function sanitizeXmlForParsing(xml: string): string {
  if (!xml) return ''
  return xml.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;')
}

// Extracts `<blockTag>...</blockTag>` from a raw response and parses its
// inner content as XML via DOMParser, wrapped in a synthetic <root> so
// multiple repeated sibling tags parse cleanly. Throws XmlParseError if the
// block is missing or malformed — callers decide what (if anything) to
// fall back to.
export function parseXmlBlock(raw: string, blockTag: string): Document {
  const blockMatch = raw.match(new RegExp(`<${blockTag}>([\\s\\S]*?)</${blockTag}>`))
  if (!blockMatch) throw new XmlParseError(`No <${blockTag}> block found`)
  const sanitized = sanitizeXmlForParsing(blockMatch[1])
  const doc = new DOMParser().parseFromString(`<root>${sanitized}</root>`, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new XmlParseError(`Malformed <${blockTag}> XML: ${parseError.textContent}`)
  return doc
}
