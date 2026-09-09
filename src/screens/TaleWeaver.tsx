import { useState, useRef, useEffect } from 'react'
import { Send, X, ChevronRight, Sparkles, Lock, Unlock } from 'lucide-react'
import { GlassScreen, GlassHeader } from '../lib/glassChrome.tsx'
import type { ApiSettings } from '../types.ts'
import {
  TALE_WEAVER_PHASES, emptyAccumulated, runTaleWeaverPhase,
  type TaleWeaverAccumulated, type TaleWeaverPhaseDef,
} from '../lib/taleWeaving.ts'

// Inspired Mode's "Tale Weaving" screen — a simple chat interface (per
// explicit design direction: the UI here is deliberately plain, not a
// second node-graph editor like TaleDiveWeaver.tsx). One phase at a time,
// the player describes what they want in a text box, the model proposes
// real content, and the player either keeps typing to refine/add more or
// advances once satisfied — never a fixed one-shot take-it-or-leave-it.

interface TaleWeaverProps {
  apiSettings: ApiSettings
  onBack: () => void
  onBeginTale: (accumulated: TaleWeaverAccumulated) => void
}

type ChatMsg =
  | { kind: 'intro'; label: string; prompt: string }
  | { kind: 'user'; text: string }
  | { kind: 'batch'; phaseId: TaleWeaverPhaseDef['id']; ids: string[] }
  | { kind: 'single'; phaseId: 'world' | 'protagonist' }
  | { kind: 'error'; text: string }

function fieldSummary(fields: (string | undefined)[]): string {
  return fields.filter(Boolean).join(' · ')
}

export default function TaleWeaver({ apiSettings, onBack, onBeginTale }: TaleWeaverProps) {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [messages, setMessages] = useState<ChatMsg[]>([
    { kind: 'intro', label: TALE_WEAVER_PHASES[0].label, prompt: TALE_WEAVER_PHASES[0].prompt },
  ])
  const [guidance, setGuidance] = useState('')
  const [busy, setBusy] = useState(false)
  const [revealedBeats, setRevealedBeats] = useState<Set<string>>(new Set())
  const [accumulated, setAccumulated] = useState<TaleWeaverAccumulated>(emptyAccumulated())
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const phase = TALE_WEAVER_PHASES[phaseIdx]
  const isLastPhase = phaseIdx === TALE_WEAVER_PHASES.length - 1

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  async function handleGenerate() {
    if (busy) return
    const text = guidance.trim()
    setBusy(true)
    setGuidance('')
    setMessages((m) => [...m, { kind: 'user', text: text || '(no specific guidance — surprise me)' }])

    const result = await runTaleWeaverPhase({ apiSettings, phase, accumulated, guidance: text })
    setBusy(false)

    if (!result.ok || !result.draft) {
      setMessages((m) => [...m, { kind: 'error', text: result.error ?? 'The weave slipped — try again, perhaps with different phrasing.' }])
      return
    }
    const draft = result.draft

    if (phase.id === 'world' && draft.world) {
      setAccumulated((prev) => ({ ...prev, world: draft.world }))
      setMessages((m) => [...m, { kind: 'single', phaseId: 'world' }])
      return
    }
    if (phase.id === 'protagonist' && draft.protagonist) {
      setAccumulated((prev) => ({ ...prev, protagonist: draft.protagonist }))
      setMessages((m) => [...m, { kind: 'single', phaseId: 'protagonist' }])
      return
    }

    const newIds: string[] = []
    setAccumulated((prev) => {
      const next = { ...prev }
      if (draft.regions.length) {
        next.regions = [...prev.regions.filter((r) => !draft.regions.some((d) => d.id === r.id)), ...draft.regions]
        newIds.push(...draft.regions.map((r) => r.id))
      }
      if (draft.locations.length) {
        next.locations = [...prev.locations.filter((l) => !draft.locations.some((d) => d.id === l.id)), ...draft.locations]
        newIds.push(...draft.locations.map((l) => l.id))
      }
      if (draft.factions.length) {
        next.factions = [...prev.factions.filter((f) => !draft.factions.some((d) => d.id === f.id)), ...draft.factions]
        newIds.push(...draft.factions.map((f) => f.id))
      }
      if (draft.npcs.length) {
        next.npcs = [...prev.npcs.filter((n) => !draft.npcs.some((d) => d.id === n.id)), ...draft.npcs]
        newIds.push(...draft.npcs.map((n) => n.id))
      }
      if (draft.lore.length) {
        next.lore = [...prev.lore.filter((l) => !draft.lore.some((d) => d.id === l.id)), ...draft.lore]
        newIds.push(...draft.lore.map((l) => l.id))
      }
      if (draft.beats.length) {
        next.beats = [...prev.beats.filter((b) => !draft.beats.some((d) => d.id === b.id)), ...draft.beats]
        newIds.push(...draft.beats.map((b) => b.id))
      }
      return next
    })
    setMessages((m) => [...m, { kind: 'batch', phaseId: phase.id, ids: newIds }])
  }

  function removeItem(category: keyof TaleWeaverAccumulated, id: string) {
    setAccumulated((prev) => {
      const list = prev[category]
      if (!Array.isArray(list)) return prev
      return { ...prev, [category]: list.filter((item: { id: string }) => item.id !== id) }
    })
  }

  function handleNext() {
    if (isLastPhase) {
      onBeginTale(accumulated)
      return
    }
    const nextPhase = TALE_WEAVER_PHASES[phaseIdx + 1]
    setPhaseIdx((i) => i + 1)
    setMessages((m) => [...m, { kind: 'intro', label: nextPhase.label, prompt: nextPhase.prompt }])
  }

  function toggleBeatReveal(id: string) {
    setRevealedBeats((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderBatch(msg: Extract<ChatMsg, { kind: 'batch' }>) {
    const idSet = new Set(msg.ids)
    const chips: { key: string; title: string; subtitle: string; onRemove: () => void }[] = []

    for (const r of accumulated.regions) {
      if (idSet.has(r.id)) chips.push({ key: `region_${r.id}`, title: r.name, subtitle: r.desc ?? 'Region', onRemove: () => removeItem('regions', r.id) })
    }
    for (const l of accumulated.locations) {
      if (idSet.has(l.id)) {
        const region = accumulated.regions.find((r) => r.id === l.regionId)
        chips.push({ key: `loc_${l.id}`, title: l.name, subtitle: fieldSummary([region?.name, l.locationType, l.danger]), onRemove: () => removeItem('locations', l.id) })
      }
    }
    for (const f of accumulated.factions) {
      if (idSet.has(f.id)) chips.push({ key: `fac_${f.id}`, title: f.name, subtitle: fieldSummary([f.attitude, f.territory]), onRemove: () => removeItem('factions', f.id) })
    }
    for (const n of accumulated.npcs) {
      if (idSet.has(n.id)) chips.push({ key: `npc_${n.id}`, title: n.name, subtitle: fieldSummary([n.role, n.personality]), onRemove: () => removeItem('npcs', n.id) })
    }
    for (const l of accumulated.lore) {
      if (idSet.has(l.id)) chips.push({ key: `lore_${l.id}`, title: l.hidden ? `${l.name} (hidden)` : l.name, subtitle: l.category ?? 'Lore', onRemove: () => removeItem('lore', l.id) })
    }

    if (msg.phaseId === 'arc') {
      const beats = accumulated.beats.filter((b) => idSet.has(b.id))
      return (
        <div className="flex flex-col gap-2">
          {beats.map((b, i) => {
            const revealed = revealedBeats.has(b.id)
            return (
              <div key={b.id} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-semibold text-sm text-gold-primary">{i + 1}. {b.title}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => toggleBeatReveal(b.id)} className="text-gold-primary/60 hover:text-gold-primary p-1">
                      {revealed ? <Unlock size={13} /> : <Lock size={13} />}
                    </button>
                    <button type="button" onClick={() => removeItem('beats', b.id)} className="text-red-400/70 hover:text-red-300 p-1">
                      <X size={13} />
                    </button>
                  </div>
                </div>
                {revealed && b.summary && <p className="font-narrative text-xs italic text-ink-muted">{b.summary}</p>}
              </div>
            )
          })}
        </div>
      )
    }

    if (chips.length === 0) return <p className="font-narrative italic text-xs text-ink-muted">Nothing came back — try rephrasing your guidance.</p>

    return (
      <div className="flex flex-col gap-2">
        {chips.map((c) => (
          <div key={c.key} className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display font-semibold text-sm text-gold-primary truncate">{c.title}</p>
              {c.subtitle && <p className="font-narrative text-xs text-ink-muted truncate">{c.subtitle}</p>}
            </div>
            <button type="button" onClick={c.onRemove} className="text-red-400/70 hover:text-red-300 p-1 shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    )
  }

  function renderSingle(phaseId: 'world' | 'protagonist') {
    if (phaseId === 'world' && accumulated.world) {
      const w = accumulated.world
      return (
        <div className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex flex-col gap-1">
          <p className="font-display font-bold text-sm text-gold-primary">{w.name || 'Untitled World'}</p>
          {[w.genreTone, w.conflict, w.powerSystem, w.eraTechLevel].filter(Boolean).map((line, i) => (
            <p key={i} className="font-narrative text-xs text-ink-muted">{line}</p>
          ))}
        </div>
      )
    }
    if (phaseId === 'protagonist' && accumulated.protagonist) {
      const p = accumulated.protagonist
      return (
        <div className="rounded-xl border border-gold-accent/30 bg-[#161a28] p-3 flex flex-col gap-1">
          <p className="font-display font-bold text-sm text-gold-primary">{p.name || 'Unnamed Protagonist'}</p>
          {[p.background, p.personality, p.motivation, p.opening].filter(Boolean).map((line, i) => (
            <p key={i} className="font-narrative text-xs text-ink-muted">{line}</p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <GlassScreen ground="dark" className="px-3 sm:px-4 pb-4 pt-2">
      <GlassHeader title="Tale Weaving" subtitle={`Phase ${phaseIdx + 1} of ${TALE_WEAVER_PHASES.length} — ${phase.label}`} onBack={onBack} />

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 py-3">
        {messages.map((msg, i) => {
          if (msg.kind === 'intro') {
            return (
              <div key={i} className="flex flex-col items-center gap-1 py-2">
                <span className="font-display text-xs uppercase tracking-wide text-gold-primary/70">{msg.label}</span>
                <p className="font-narrative italic text-sm text-ink text-center max-w-md">{msg.prompt}</p>
              </div>
            )
          }
          if (msg.kind === 'user') {
            return (
              <p key={i} className="font-narrative italic text-sm text-gold-primary self-end text-right max-w-[80%]">{msg.text}</p>
            )
          }
          if (msg.kind === 'error') {
            return <p key={i} className="font-narrative text-xs text-red-400 italic">{msg.text}</p>
          }
          if (msg.kind === 'single') return <div key={i}>{renderSingle(msg.phaseId)}</div>
          return <div key={i}>{renderBatch(msg)}</div>
        })}
        {busy && (
          <p className="font-narrative italic text-xs text-gold-primary/70 flex items-center gap-1.5">
            <Sparkles size={13} className="animate-pulse" /> Weaving...
          </p>
        )}
      </div>

      <div className="shrink-0 flex flex-col gap-2 pt-2 border-t border-gold-accent/20">
        <div className="flex items-end gap-2">
          <textarea
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleGenerate()
              }
            }}
            placeholder={phase.prompt}
            rows={2}
            disabled={busy}
            className="flex-1 px-3 py-2 rounded-xl bg-[#161a28] border border-gold-accent/30 text-sm text-ink placeholder:text-ink-muted/50 outline-none resize-none disabled:opacity-50"
          />
          <button
            type="button"
            aria-label="Send"
            onClick={handleGenerate}
            disabled={busy}
            className="shrink-0 w-10 h-10 rounded-xl bg-gold-accent/20 border border-gold-accent/40 text-gold-primary flex items-center justify-center disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={handleNext}
          disabled={busy}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gold-accent/25 border border-gold-accent/50 text-gold-primary font-display font-semibold text-sm disabled:opacity-40"
        >
          {isLastPhase ? 'Begin This Tale' : 'Next Phase'} <ChevronRight size={16} />
        </button>
      </div>
    </GlassScreen>
  )
}
