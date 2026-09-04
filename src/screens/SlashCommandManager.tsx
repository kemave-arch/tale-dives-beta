import { useState } from 'react'
import { X, Plus, Pencil, Trash2, Save, Globe, ScrollText, Pause } from 'lucide-react'
import { DASHED_ROW_CLASS, FIELD_CLASS, GlassIconButton, GlassLongTextarea } from '../lib/glassChrome.tsx'
import { newId } from '../lib/store.ts'
import { useConfirm } from '../lib/useConfirm.tsx'
import { useLongTextEditor } from '../lib/useLongTextEditor.tsx'
import type { SlashCommand } from '../types.ts'

interface SlashCommandManagerProps {
  campaignCommands: Record<string, SlashCommand>
  globalCommands: Record<string, SlashCommand>
  onSave: (cmd: SlashCommand, global: boolean, previousGlobal?: boolean) => void
  onDelete: (id: string, global: boolean) => void
  onClose: () => void
}

interface Draft {
  id: string | null
  name: string
  prompt: string
  pauseRoleplay: boolean
  global: boolean
  previousGlobal?: boolean
}

const BLANK_DRAFT: Draft = { id: null, name: '', prompt: '', pauseRoleplay: false, global: false }

// §6.6 Slash & Bang Command Manager (Slash half) — reusable in-fiction
// prompts the player builds up over a campaign (or shares across every Tale
// via the Global checkbox). Selecting one in Chronicle sends `prompt`
// through the normal turn pipeline exactly like typed prose.
export default function SlashCommandManager({ campaignCommands, globalCommands, onSave, onDelete, onClose }: SlashCommandManagerProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const { confirm, dialog: confirmDialog } = useConfirm()
  const { edit: editLongText, dialog: longTextDialog } = useLongTextEditor()

  const campaignList = Object.values(campaignCommands)
  const globalList = Object.values(globalCommands)

  function startCreate() {
    setDraft({ ...BLANK_DRAFT })
  }

  function startEdit(cmd: SlashCommand, global: boolean) {
    setDraft({ id: cmd.id, name: cmd.name, prompt: cmd.prompt, pauseRoleplay: cmd.pauseRoleplay, global, previousGlobal: global })
  }

  function save() {
    if (!draft || !draft.name.trim() || !draft.prompt.trim()) return
    const id = draft.id ?? newId('slash')
    onSave(
      { id, name: draft.name.trim().replace(/\s+/g, '_').toLowerCase(), prompt: draft.prompt.trim(), pauseRoleplay: draft.pauseRoleplay },
      draft.global,
      draft.previousGlobal,
    )
    setDraft(null)
  }

  async function remove(id: string, global: boolean) {
    if (!(await confirm('Delete this slash command?'))) return
    onDelete(id, global)
    setDraft(null)
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="rounded-2xl border border-[#e8ca8a]/25 bg-[#0f0b16]/92 backdrop-blur-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8ca8a]/25 shrink-0">
          <h2 className="font-display font-bold text-sm text-[#e8ca8a] flex items-center gap-1.5">
            <ScrollText size={16} /> Slash Commands
          </h2>
          <GlassIconButton icon={X} label="Close" compact onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {draft ? (
            <div className="flex flex-col gap-3">
              <label className="block">
                <span className="text-[11px] font-display uppercase tracking-[0.14em] text-[#f0d9a4]">Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })}
                  placeholder="meditate"
                  className={`mt-1 ${FIELD_CLASS} font-mono`}
                />
                <span className="text-[10px] text-ink-muted">Invoked as /{draft.name.trim().replace(/\s+/g, '_').toLowerCase() || 'name'}</span>
              </label>
              <label className="block">
                <span className="text-[11px] font-display uppercase tracking-[0.14em] text-[#f0d9a4]">Prompt</span>
                <GlassLongTextarea
                  value={draft.prompt}
                  onOpenModal={async () => {
                    const result = await editLongText('Prompt', draft.prompt, 'What should the AI do when this command is used?', 'What should the AI do when this command is used?')
                    if (result !== null) setDraft((d) => d && { ...d, prompt: result })
                  }}
                  placeholder="Tap to edit prompt in expanded view..."
                  rows={3}
                  className="mt-1"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={draft.pauseRoleplay}
                  onChange={(e) => setDraft((d) => d && { ...d, pauseRoleplay: e.target.checked })}
                  className="accent-[#e8ca8a]"
                />
                <Pause size={13} className="text-[#e8ca8a]/70" />
                Pause roleplay for this turn (sets turn state to PAUSE)
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={draft.global}
                  onChange={(e) => setDraft((d) => d && { ...d, global: e.target.checked })}
                  className="accent-[#e8ca8a]"
                />
                <Globe size={13} className="text-[#e8ca8a]/70" />
                Global — available in every Tale, not just this one
              </label>

              <div className="flex justify-end gap-2 mt-1">
                <GlassIconButton icon={X} label="Cancel" compact onClick={() => setDraft(null)} />
                <GlassIconButton
                  icon={Save}
                  label="Save"
                  tone="action"
                  compact
                  onClick={save}
                  disabled={!draft.name.trim() || !draft.prompt.trim()}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button onClick={startCreate} className={DASHED_ROW_CLASS}>
                <Plus size={14} /> New Command
              </button>

              {campaignList.length > 0 && (
                <div>
                  <p className="text-[11px] font-display uppercase tracking-[0.14em] text-[#f0d9a4] mb-1.5">This Tale</p>
                  <div className="flex flex-col gap-2">
                    {campaignList.map((cmd) => (
                      <SlashRow key={cmd.id} cmd={cmd} onEdit={() => startEdit(cmd, false)} onDelete={() => remove(cmd.id, false)} />
                    ))}
                  </div>
                </div>
              )}

              {globalList.length > 0 && (
                <div>
                  <p className="text-[11px] font-display uppercase tracking-[0.14em] text-[#f0d9a4] mb-1.5 flex items-center gap-1">
                    <Globe size={11} /> Global
                  </p>
                  <div className="flex flex-col gap-2">
                    {globalList.map((cmd) => (
                      <SlashRow key={cmd.id} cmd={cmd} onEdit={() => startEdit(cmd, true)} onDelete={() => remove(cmd.id, true)} />
                    ))}
                  </div>
                </div>
              )}

              {campaignList.length === 0 && globalList.length === 0 && (
                <p className="font-narrative italic text-sm text-ink-muted text-center py-4">No slash commands yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
      {confirmDialog}
      {longTextDialog}
    </div>
  )
}

function SlashRow({ cmd, onEdit, onDelete }: { cmd: SlashCommand; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-xl border border-[#e8ca8a]/25 bg-[#e8ca8a]/[0.05] backdrop-blur-sm px-3 py-2.5 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-semibold text-[#e8ca8a]">/{cmd.name}</span>
          {cmd.pauseRoleplay && <Pause size={11} className="text-ink-muted" />}
        </div>
        <p className="font-narrative text-xs text-ink-muted line-clamp-2 mt-0.5">{cmd.prompt}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <GlassIconButton icon={Pencil} label={`Edit /${cmd.name}`} compact onClick={onEdit} />
        <GlassIconButton icon={Trash2} label={`Delete /${cmd.name}`} tone="danger" compact onClick={onDelete} />
      </div>
    </div>
  )
}
