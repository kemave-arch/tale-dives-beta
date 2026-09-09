// Debug tool — exports every `export interface` in types.ts to a CSV so the
// game's actual data schema can be inspected outside the app (a spreadsheet,
// a doc, handed to another AI session) without hand-transcribing it.
//
// Deliberately NOT a hand-maintained registry: types.ts itself is imported as
// raw source text (Vite's `?raw` import — inert text, never executed) and
// regex-scanned for interface/field declarations every time this runs. That's
// the whole point — a hand-copied field list is exactly the kind of doc that
// goes stale the moment someone adds a field and forgets the copy (see
// PROJECT_REVISION_NOTES.md's blueprint-drift entries this same week). This
// file has nothing to update when a future schema addition (a music cue
// field, an in-campaign image asset field, a new Codex category) lands in
// types.ts — the next export just picks it up.
//
// Known limitation, accepted on purpose: this is a lightweight line-based
// scanner, not a real TypeScript parser. It correctly handles this codebase's
// actual, consistent style — one field per line, `field?: Type // comment` —
// including a single-line inline object type (`breakthrough?: { attr: ...;
// tier: string }`). It does NOT correctly attribute a field declared inside a
// multi-line inline object literal (rare in this file; named type aliases are
// used instead almost everywhere) — such a field would show up attributed to
// the outer interface rather than nested under it. Good enough for a quick
// reference view; not a substitute for reading types.ts itself.
import typesSource from '../types.ts?raw'

export interface SchemaFieldRow {
  schema: string
  field: string
  type: string
  required: boolean
  description: string
}

const INTERFACE_START = /export interface (\w+)(?:<[^>]*>)?\s*(?:extends\s+[^{]+)?\{/g
// One field per line: `name`, optional `?`, `: Type`, optional trailing `;`,
// optional trailing `// comment`. `[^/]+?` for the type stops at the first
// `/` so a trailing comment's `//` never gets swallowed into the type text.
const FIELD_LINE = /^([A-Za-z_$][\w$]*)(\?)?\s*:\s*([^/]+?);?\s*(?:\/\/\s*(.*))?$/

export function extractSchemaFields(source: string = typesSource): SchemaFieldRow[] {
  const rows: SchemaFieldRow[] = []

  let match: RegExpExecArray | null
  while ((match = INTERFACE_START.exec(source))) {
    const schemaName = match[1]
    const bodyStart = match.index + match[0].length

    // Brace-depth scan (not a naive first-`}` match) so a single-line inline
    // object type inside a field — `{ attr: ...; tier: string }` — doesn't
    // prematurely close the interface body.
    let depth = 1
    let i = bodyStart
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') depth--
      i++
    }
    const body = source.slice(bodyStart, i - 1)
    const lines = body.split('\n').map((l) => l.trim())

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]
      if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue
      const fieldMatch = line.match(FIELD_LINE)
      if (!fieldMatch) continue
      const [, field, optional, type, trailingComment] = fieldMatch

      // Fall back to an immediately-preceding single-line `//` comment when
      // the field has no trailing one — catches the common "explanatory
      // comment on its own line above the field" style this file also uses,
      // though only its last line if that comment spans several.
      let description = (trailingComment ?? '').trim()
      if (!description) {
        const prev = lines[li - 1]
        if (prev?.startsWith('//')) description = prev.replace(/^\/\/\s?/, '').trim()
      }

      rows.push({ schema: schemaName, field, type: type.trim(), required: !optional, description })
    }
  }
  return rows
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function schemaFieldsToCsv(rows: SchemaFieldRow[]): string {
  const header = ['Schema', 'Field', 'Type', 'Required', 'Description']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([r.schema, r.field, r.type, r.required ? 'yes' : 'no', r.description].map(csvEscape).join(','))
  }
  return lines.join('\n')
}

export function downloadSchemaCsv(): void {
  const csv = schemaFieldsToCsv(extractSchemaFields())
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tale-dives-schema-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
