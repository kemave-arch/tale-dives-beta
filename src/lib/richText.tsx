import type { ReactNode } from 'react'
import type { KeywordLink } from '../types.ts'

// Blueprint §4.2 Mandatory Rich Text Markup — renders the four narrative
// markers as styled inline spans instead of leaking raw [brackets]/>angle
// brackets</>quotes'/{{tags}} syntax into what the player reads. Keyword
// links are tappable when `onTapTerm` is supplied — opens a Codex Popup
// Card (§6.4C).
//
// Two passes, not one combined regex: a {{Term|category}} tag can appear
// *nested* inside a 'thought/dialogue' span (an NPC's line mentioning a
// place by name is entirely normal), so keyword-link tags are resolved
// within every text segment the outer pass produces, not just at top level.

// The thought pattern's quotes need care: an apostrophe inside a contraction
// ("haven't", "Ymma's") must not be mistaken for a closing quote. A real
// closing quote is never immediately flanked by a word character the way a
// mid-word apostrophe is, so boundary lookarounds tell them apart, and `.+?`
// (not a `[^']` class) lets the match run past internal apostrophes at all.
const OUTER_RE = /\[([^\]]+)\]|>([^<]+)<|(?<!\w)'(.+?)'(?!\w)/g
const TAG_RE = /\{\{([^{}|]+)\|(\w+)\}\}/g

// §7.2 rule 1b tells the model to break `nar` into paragraphs, and it
// usually does — but not always: on some turns it returns one dense,
// unbroken block despite the instruction. Rather than keep re-wording a
// prompt the model doesn't reliably follow, this is a client-side
// guarantee: only fires when a turn has *zero* line breaks at all (a
// turn that made any attempt, even a bad one, is left exactly as
// written — this never overrides genuine model formatting).
const MIN_LENGTH_FOR_FALLBACK = 400
const SENTENCE_BOUNDARY_RE = /(?<=[.!?])\s+(?=[A-Z'"])/g
// Same span a 'thought/dialogue' match covers (OUTER_RE's third
// alternative) — treated as an atomic, unsplittable unit here so a
// paragraph break is never inserted *inside* one (which would break its
// rendering as a single <em> block) and its attribution tag ("... she
// murmurs.") always stays in the same paragraph as the line it belongs to.
const QUOTE_SPAN_RE = /(?<!\w)'.+?'(?!\w)/g

export function ensureParagraphBreaks(text: string): string {
  if (!text || text.length < MIN_LENGTH_FOR_FALLBACK || text.includes('\n')) return text

  const segments: { text: string; quoted: boolean }[] = []
  let lastIndex = 0
  QUOTE_SPAN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = QUOTE_SPAN_RE.exec(text))) {
    if (m.index > lastIndex) segments.push({ text: text.slice(lastIndex, m.index), quoted: false })
    segments.push({ text: m[0], quoted: true })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), quoted: false })

  const paragraphs: string[] = []
  let current = ''
  let sentenceCount = 0
  let hasQuote = false

  const flush = () => {
    if (current.trim()) paragraphs.push(current.trim())
    current = ''
    sentenceCount = 0
    hasQuote = false
  }

  for (const seg of segments) {
    if (seg.quoted) {
      // A paragraph already carrying one dialogue/thought line always
      // starts a fresh one for the next — keeps distinct beats apart
      // without ever splitting a single quote's own span.
      if (hasQuote || sentenceCount >= 2) flush()
      current += (current ? ' ' : '') + seg.text
      hasQuote = true
      continue
    }
    for (const sentence of seg.text.split(SENTENCE_BOUNDARY_RE)) {
      const trimmed = sentence.trim()
      if (!trimmed) continue
      current += (current ? ' ' : '') + trimmed
      sentenceCount++
      if (sentenceCount >= 3) flush()
    }
  }
  flush()

  return paragraphs.join('\n\n')
}

export type TapTermHandler = (term: string, category: KeywordLink['category']) => void

function renderTags(text: string, keyPrefix: string, onTapTerm?: TapTermHandler): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  TAG_RE.lastIndex = 0
  while ((match = TAG_RE.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const term = match[1]
    const category = match[2] as KeywordLink['category']
    nodes.push(
      <span
        key={`${keyPrefix}-tag${key++}`}
        onClick={onTapTerm ? () => onTapTerm(term, category) : undefined}
        className={`underline decoration-dotted decoration-gold-accent/50 underline-offset-2 ${onTapTerm ? 'cursor-pointer hover:text-gold-primary' : ''}`}
      >
        {term}
      </span>,
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function renderNarrative(rawText: string | undefined, onTapTerm?: TapTermHandler): ReactNode[] | null {
  if (!rawText) return null
  const text = ensureParagraphBreaks(rawText)
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  OUTER_RE.lastIndex = 0
  while ((match = OUTER_RE.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(...renderTags(text.slice(lastIndex, match.index), `p${key}`, onTapTerm))
    }

    const [full, skill, item, thought] = match
    if (skill !== undefined) {
      // Bold + the skill token color, like a webnovel's inline ability name —
      // not a rounded UI badge, which read as an app chip sitting on the
      // parchment rather than part of the printed page.
      nodes.push(
        <strong key={`s${key}`} className="font-semibold text-skill">
          {renderTags(skill, `s${key}`, onTapTerm)}
        </strong>,
      )
    } else if (item !== undefined) {
      // Italic + the gold ink color, the same "named proper noun" treatment
      // fantasy prose gives artifacts and titles — distinct from the
      // thought/dialogue italic below by color, not by another badge.
      nodes.push(
        <em key={`i${key}`} className="font-semibold italic text-gold-primary">
          {renderTags(item, `i${key}`, onTapTerm)}
        </em>,
      )
    } else if (thought !== undefined) {
      nodes.push(
        <em key={`th${key}`} className="text-ink-muted">
          '{renderTags(thought, `th${key}`, onTapTerm)}'
        </em>,
      )
    }

    lastIndex = match.index + full.length
    key++
  }

  if (lastIndex < text.length) nodes.push(...renderTags(text.slice(lastIndex), `p${key}`, onTapTerm))
  return nodes
}
