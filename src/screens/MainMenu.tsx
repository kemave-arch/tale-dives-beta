import { useRef, useState } from 'react'
import {
  BookOpen, Globe, UserCircle, Plus, Upload, Download, Trash2, Play, Sparkles, Star, Settings as SettingsIcon, Pencil,
  ArrowLeft, Volume2, VolumeX,
} from 'lucide-react'
import type { Campaign, Dict, ProtagonistData, WorldData } from '../types.ts'
import { CyclingBackground } from '../lib/cyclingBackground.tsx'
// DashedCard/DASHED_ROW_CLASS started here and now live in glassChrome, so
// the Codex and Slash manager share the same add-affordance rather than each
// growing a near-copy.
import { DASHED_ROW_CLASS, DashedCard, GLASS_SURFACE, GlassIconButton, GlassTabs } from '../lib/glassChrome.tsx'

const TABS = [
  { id: 'tales', label: 'Tales', icon: BookOpen },
  { id: 'worlds', label: 'Worlds', icon: Globe },
  { id: 'protagonists', label: 'Protagonists', icon: UserCircle },
] as const

interface MainMenuProps {
  worlds: Dict<WorldData>
  protagonists: Dict<ProtagonistData>
  campaigns: Dict<Campaign>
  onResume: (id: string) => void
  onNewSession: (worldId?: string, protagonistId?: string) => void
  onDeleteCampaign: (id: string) => void
  onExportCampaign: (id: string) => void
  onImportCampaign: (file: File) => void
  onNewWorld: () => void
  onEditWorld: (id: string) => void
  onSetDefaultWorld: (id: string) => void
  onDeleteWorld: (id: string) => void
  onNewProtagonist: () => void
  onEditProtagonist: (id: string) => void
  onSetDefaultProtagonist: (id: string) => void
  onDeleteProtagonist: (id: string) => void
  onOpenSettings: () => void
  // Same soundtrack controls as Title, so the toggle is reachable from
  // wherever the player happens to be rather than only the entry screen.
  onBackToTitle: () => void
  musicMuted: boolean
  onToggleMusicMute: () => void
}

export default function MainMenu({
  worlds,
  protagonists,
  campaigns,
  onResume,
  onNewSession,
  onDeleteCampaign,
  onExportCampaign,
  onImportCampaign,
  onNewWorld,
  onEditWorld,
  onSetDefaultWorld,
  onDeleteWorld,
  onNewProtagonist,
  onEditProtagonist,
  onSetDefaultProtagonist,
  onDeleteProtagonist,
  onOpenSettings,
  onBackToTitle,
  musicMuted,
  onToggleMusicMute,
}: MainMenuProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('tales')
  const importRef = useRef<HTMLInputElement>(null)

  const taleList = Object.values(campaigns).sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
  const worldList = Object.values(worlds)
  const protagonistList = Object.values(protagonists)

  return (
    <div className="relative min-h-dvh text-[#f5dfa0]">
      <CyclingBackground fixed />
      {/* The art carries its own wordmark/logo already (see Title), so this
          screen's chrome is just the tab nav, lists, and a Settings icon —
          no repeated "TALE DIVES" heading. A uniform scrim (rather than
          Title's bottom-only gradient) keeps the whole scrollable list
          legible, not just the last screenful. */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(4,3,7,0.62), rgba(4,3,7,0.72) 30%, rgba(4,3,7,0.8))' }} />

      <div
        className="relative z-10 px-4 pb-16"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
      >
        {/* Back on the left, soundtrack + Settings on the right, all four
            sharing GlassIconButton so they read as one row of controls. The
            tagline takes the slack between them and truncates rather than
            wraps, so the row stays a single line at phone widths. */}
        <header className="flex items-center gap-3 mb-5">
          <GlassIconButton icon={ArrowLeft} label="Back to title" onClick={onBackToTitle} />
          <p className="flex-1 min-w-0 truncate font-narrative italic text-sm text-[#e8ca8a]/80">
            Choose a tale, or begin a new one
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <GlassIconButton
              icon={musicMuted ? VolumeX : Volume2}
              label={musicMuted ? 'Unmute music' : 'Mute music'}
              onClick={onToggleMusicMute}
            />
            <GlassIconButton icon={SettingsIcon} label="Settings" onClick={onOpenSettings} />
          </div>
        </header>

        <GlassTabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />

        {tab === 'tales' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {taleList.map((tale) => (
              <div key={tale.id} className={`${GLASS_SURFACE} rounded-2xl p-4 flex flex-col gap-2`}>
                <h3 className="font-display font-bold text-base text-[#f0ca65]">{tale.title}</h3>
                {tale.synopsis && <p className="font-narrative text-xs text-[#e8ca8a]/70 line-clamp-2">{tale.synopsis}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="font-mono text-[10px] text-[#e8ca8a]/50">
                    {tale.lastPlayed ? new Date(tale.lastPlayed).toLocaleDateString() : ''}
                  </span>
                  <div className="flex gap-1">
                    <GlassIconButton icon={Play} label="Resume" tone="action" onClick={() => onResume(tale.id)} />
                    <GlassIconButton icon={Sparkles} label="New Session" onClick={() => onNewSession(tale.worldId, tale.protagonistId)} />
                    <GlassIconButton icon={Download} label="Export" onClick={() => onExportCampaign(tale.id)} />
                    <GlassIconButton icon={Trash2} label="Delete" tone="danger" onClick={() => onDeleteCampaign(tale.id)} />
                  </div>
                </div>
              </div>
            ))}

            <DashedCard icon={Plus} label="New Story" onClick={() => onNewSession()} />
            <DashedCard icon={Upload} label="Import Tale" onClick={() => importRef.current?.click()}>
              <span className="font-mono text-[10px] text-[#e8ca8a]/50">.json</span>
            </DashedCard>
            <input
              ref={importRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onImportCampaign(file)
                e.target.value = ''
              }}
            />
          </div>
        )}

        {tab === 'worlds' && (
          <div className="flex flex-col gap-2">
            {worldList.map((world) => (
              <div key={world.id} className={`${GLASS_SURFACE} rounded-xl px-3 py-2 flex items-center gap-2.5`}>
                <Globe size={16} className="text-[#e8ca8a]/70 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-sm text-[#f0ca65] truncate">{world.name}</h3>
                  {world.background && <p className="font-narrative text-xs text-[#e8ca8a]/70 truncate">{world.background}</p>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <GlassIconButton
                    compact
                    icon={Star}
                    label={world.isDefault ? 'Default world' : 'Set as default'}
                    tone={world.isDefault ? 'action' : 'default'}
                    onClick={() => onSetDefaultWorld(world.id!)}
                  />
                  <GlassIconButton compact icon={Pencil} label="Edit" onClick={() => onEditWorld(world.id!)} />
                  <GlassIconButton compact icon={Trash2} label="Delete" tone="danger" onClick={() => onDeleteWorld(world.id!)} />
                </div>
              </div>
            ))}
            <button onClick={onNewWorld} className={DASHED_ROW_CLASS}>
              <Plus size={14} /> New World
            </button>
          </div>
        )}

        {tab === 'protagonists' && (
          <div className="flex flex-col gap-2">
            {protagonistList.map((p) => (
              <div key={p.id} className={`${GLASS_SURFACE} rounded-xl px-3 py-2 flex items-center gap-2.5`}>
                <UserCircle size={16} className="text-[#e8ca8a]/70 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-sm text-[#f0ca65] truncate">{p.name}</h3>
                  <p className="font-narrative text-xs text-[#e8ca8a]/70 truncate">{p.className}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <GlassIconButton
                    compact
                    icon={Star}
                    label={p.isDefault ? 'Default protagonist' : 'Set as default'}
                    tone={p.isDefault ? 'action' : 'default'}
                    onClick={() => onSetDefaultProtagonist(p.id!)}
                  />
                  <GlassIconButton compact icon={Pencil} label="Edit" onClick={() => onEditProtagonist(p.id!)} />
                  <GlassIconButton compact icon={Trash2} label="Delete" tone="danger" onClick={() => onDeleteProtagonist(p.id!)} />
                </div>
              </div>
            ))}
            <button onClick={onNewProtagonist} className={DASHED_ROW_CLASS}>
              <Plus size={14} /> New Protagonist
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
