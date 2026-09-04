import { useRef, useState } from 'react'
import {
  BookOpen, Globe, UserCircle, Plus, Upload, Download, Trash2, Play, Sparkles, Star, Settings as SettingsIcon, Pencil,
  ArrowLeft, Volume2, VolumeX, Archive, Music2, Image as ImageIcon,
} from 'lucide-react'
import type { Campaign, Dict, ProtagonistData, WorldData } from '../types.ts'
import type { TrackMetadata } from '../data/soundtrackManifest.ts'
import { CyclingBackground } from '../lib/cyclingBackground.tsx'
// DashedCard/DASHED_ROW_CLASS started here and now live in glassChrome, so
// the Codex and Slash manager share the same add-affordance rather than each
// growing a near-copy.
import { AmbientSparks, DashedCard, GLASS_SURFACE, GlassIconButton, GlassTabs } from '../lib/glassChrome.tsx'
import { ProtagonistDetailModal, WorldDetailModal } from '../components/PresetDetailModal.tsx'
import VaultSoundtrackView from '../components/VaultSoundtrackView.tsx'
import VaultArtGalleryView from '../components/VaultArtGalleryView.tsx'

const MAIN_TABS = [
  { id: 'tales', label: 'Tales', icon: BookOpen },
  { id: 'vault', label: 'Vault', icon: Archive },
] as const

const VAULT_SUBTABS = [
  { id: 'worlds', label: 'Worlds', icon: Globe, accent: 'cyan' as const },
  { id: 'protagonists', label: 'Protagonist', icon: UserCircle, accent: 'purple' as const },
  { id: 'ost', label: 'OST', icon: Music2, accent: 'gold' as const },
  { id: 'art', label: 'Art', icon: ImageIcon, accent: 'cyan' as const },
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
  musicPlaying?: boolean
  musicCurrentTrack?: TrackMetadata | null
  musicCurrentTime?: number
  musicDuration?: number
  onPlayTrack?: (filenameOrIndex: string | number) => void
  onTogglePlayPause?: () => void
  onNextTrack?: () => void
  onPrevTrack?: () => void
  onResumeSoundtrack?: () => void
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
  musicPlaying = false,
  musicCurrentTrack = null,
  musicCurrentTime = 0,
  musicDuration = 0,
  onPlayTrack = () => {},
  onTogglePlayPause = () => {},
  onNextTrack = () => {},
  onPrevTrack = () => {},
  onResumeSoundtrack = () => {},
}: MainMenuProps) {
  const [tab, setTab] = useState<(typeof MAIN_TABS)[number]['id']>('tales')
  const [vaultTab, setVaultTab] = useState<(typeof VAULT_SUBTABS)[number]['id']>('worlds')
  const [selectedWorld, setSelectedWorld] = useState<WorldData | null>(null)
  const [selectedProtagonist, setSelectedProtagonist] = useState<ProtagonistData | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const taleList = Object.values(campaigns).sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
  const worldList = Object.values(worlds)
  const protagonistList = Object.values(protagonists)

  return (
    <div className="relative h-dvh max-h-dvh flex flex-col text-[#f5dfa0] overflow-hidden">
      <CyclingBackground fixed />
      {/* The art carries its own wordmark/logo already (see Title), so this
          screen's chrome is just the tab nav, lists, and a Settings icon —
          no repeated "TALE DIVES" heading. A uniform scrim (rather than
          Title's bottom-only gradient) keeps the whole scrollable list
          legible, not just the last screenful. */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(4,3,7,0.62), rgba(4,3,7,0.72) 30%, rgba(4,3,7,0.8))' }} />
      {/* Ambient glowing spark effects */}
      <AmbientSparks />

      <div
        className="relative z-10 px-4 pb-3 flex-1 flex flex-col min-h-0 overflow-hidden max-w-7xl mx-auto w-full"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        {/* Back on the left, soundtrack + Settings on the right */}
        <header className="shrink-0 flex items-center gap-3 mb-2.5">
          <GlassIconButton icon={ArrowLeft} label="Back to title" onClick={onBackToTitle} />
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-sm sm:text-base text-[#fae5b5] tracking-wider uppercase">
              Tale Dives
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <GlassIconButton
              icon={musicMuted ? VolumeX : Volume2}
              label={musicMuted ? 'Unmute music' : 'Mute music'}
              onClick={onToggleMusicMute}
            />
            <GlassIconButton icon={SettingsIcon} label="Settings" onClick={onOpenSettings} />
          </div>
        </header>

        {/* Primary Main Screen Tabs: Tales & Vault with enlarged font size */}
        <div className="shrink-0 mb-2">
          <GlassTabs tabs={MAIN_TABS} value={tab} onChange={setTab} size="lg" />
        </div>

        {/* Informative Guide below Main Tabs */}
        <div className="shrink-0 mb-3 px-3 py-1.5 rounded-xl bg-[#120e1b]/60 border border-[#e8ca8a]/20 backdrop-blur-sm text-center">
          {tab === 'tales' ? (
            <p className="font-narrative italic text-xs sm:text-sm text-[#fae5b5] leading-snug">
              Choose a chronicled tale to resume, or begin an unwritten journey.
            </p>
          ) : (
            <p className="font-narrative italic text-xs sm:text-sm text-[#fae5b5] leading-snug">
              Forge and archive custom realms and protagonist archetypes for future adventures.
            </p>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 flex flex-col">
          {tab === 'tales' && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
                {taleList.map((tale) => (
                  <div key={tale.id} className={`${GLASS_SURFACE} bg-[#120e1b]/80 border-[#e8ca8a]/30 rounded-2xl p-4 flex flex-col gap-2.5 transition-colors hover:border-[#f0ca65]/50`}>
                    <h3 className="font-display font-bold text-base text-[#fae5b5] tracking-wide">{tale.title}</h3>
                    {tale.synopsis && <p className="font-narrative text-xs text-[#fbf4e2] line-clamp-2 leading-relaxed">{tale.synopsis}</p>}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#e8ca8a]/15">
                      <span className="font-mono text-[11px] text-[#d8c49e]">
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
                  <span className="font-mono text-[11px] text-[#d8c49e]">.json</span>
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
            </div>
          )}

          {tab === 'vault' && (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              {/* Vault Subtabs */}
              <div className="shrink-0 flex justify-center">
                <div className="w-full max-w-sm sm:max-w-xl md:max-w-2xl">
                  <GlassTabs
                    tabs={VAULT_SUBTABS}
                    value={vaultTab}
                    onChange={setVaultTab}
                    size="sm"
                    responsiveScale
                  />
                </div>
              </div>

              {vaultTab === 'worlds' && (
                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pb-4">
                    {worldList.map((world) => (
                      <div
                        key={world.id}
                        onClick={() => setSelectedWorld(world)}
                        className={`${GLASS_SURFACE} bg-[#091824]/85 border-[#38bdf8]/35 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-3 transition-all duration-200 hover:border-[#38bdf8]/80 hover:bg-[#0c2234]/95 hover:shadow-[0_8px_24px_rgba(56,189,248,0.2)] cursor-pointer group`}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8] shrink-0 group-hover:scale-105 transition-transform">
                                <Globe size={18} />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-display font-bold text-sm sm:text-base text-[#e0f2fe] group-hover:text-white truncate">
                                  {world.name}
                                </h3>
                                <span className="font-mono text-[10px] text-[#7dd3fc]/70 uppercase tracking-wider">
                                  {world.mode === 'inspired' ? 'Inspired Realm' : 'Original Realm'}
                                </span>
                              </div>
                            </div>

                            {world.isDefault && (
                              <span className="rounded bg-[#38bdf8]/20 text-[#7dd3fc] border border-[#38bdf8]/35 px-2 py-0.5 text-[9.5px] font-mono shrink-0">
                                default
                              </span>
                            )}
                          </div>

                          {world.background && (
                            <p className="font-narrative text-xs text-[#bae6fd]/90 line-clamp-2 leading-relaxed mt-0.5">
                              {world.background}
                            </p>
                          )}
                        </div>

                        <div
                          className="pt-2.5 border-t border-[#38bdf8]/20 flex items-center justify-between gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="font-mono text-[10px] text-[#38bdf8]/75 truncate">
                            {world.genreTone || 'Fantasy Realm'}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
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
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={onNewWorld}
                      className="rounded-2xl border border-dashed border-[#38bdf8]/40 hover:border-[#38bdf8]/80 bg-[#38bdf8]/5 hover:bg-[#38bdf8]/15 text-[#7dd3fc] font-display text-xs sm:text-sm font-semibold p-4 min-h-[110px] flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#38bdf8]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus size={18} className="text-[#38bdf8]" />
                      </div>
                      <span>New World</span>
                    </button>
                  </div>
                </div>
              )}

              {vaultTab === 'protagonists' && (
                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pb-4">
                    {protagonistList.map((p) => {
                      const details = [p.className, p.gender, p.age !== undefined ? `Age ${p.age}` : null].filter(Boolean).join(' • ')
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProtagonist(p)}
                          className={`${GLASS_SURFACE} bg-[#190d29]/85 border-[#c084fc]/35 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-3 transition-all duration-200 hover:border-[#c084fc]/80 hover:bg-[#23123a]/95 hover:shadow-[0_8px_24px_rgba(192,132,252,0.2)] cursor-pointer group`}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-[#c084fc]/15 border border-[#c084fc]/30 flex items-center justify-center text-[#c084fc] shrink-0 group-hover:scale-105 transition-transform">
                                  <UserCircle size={18} />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-display font-bold text-sm sm:text-base text-[#f3e8ff] group-hover:text-white truncate">
                                    {p.name}
                                  </h3>
                                  <span className="font-mono text-[10px] text-[#d8b4fe]/70 uppercase tracking-wider">
                                    {p.className || 'Protagonist'}
                                  </span>
                                </div>
                              </div>

                              {p.isDefault && (
                                <span className="rounded bg-[#c084fc]/20 text-[#d8b4fe] border border-[#c084fc]/35 px-2 py-0.5 text-[9.5px] font-mono shrink-0">
                                  default
                                </span>
                              )}
                            </div>

                            {details && (
                              <p className="font-narrative text-xs text-[#e9d5ff]/90 truncate mt-0.5">
                                {details}
                              </p>
                            )}
                            {(p.motivation || p.background || p.opening) && (
                              <p className="font-narrative italic text-[11px] text-[#e9d5ff]/75 line-clamp-2 leading-relaxed">
                                {p.motivation || p.background || p.opening}
                              </p>
                            )}
                          </div>

                          <div
                            className="pt-2.5 border-t border-[#c084fc]/20 flex items-center justify-between gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="font-mono text-[10px] text-[#c084fc]/75 truncate">
                              {p.personality || 'Hero Archetype'}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
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
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      onClick={onNewProtagonist}
                      className="rounded-2xl border border-dashed border-[#c084fc]/40 hover:border-[#c084fc]/80 bg-[#c084fc]/5 hover:bg-[#c084fc]/15 text-[#d8b4fe] font-display text-xs sm:text-sm font-semibold p-4 min-h-[110px] flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#c084fc]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus size={18} className="text-[#c084fc]" />
                      </div>
                      <span>New Protagonist</span>
                    </button>
                  </div>
                </div>
              )}

              {vaultTab === 'ost' && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <VaultSoundtrackView
                    currentTrack={musicCurrentTrack}
                    isPlaying={musicPlaying}
                    muted={musicMuted}
                    currentTime={musicCurrentTime}
                    duration={musicDuration}
                    onPlayTrack={onPlayTrack}
                    onTogglePlayPause={onTogglePlayPause}
                    onNextTrack={onNextTrack}
                    onPrevTrack={onPrevTrack}
                    onToggleMute={onToggleMusicMute}
                    onResumeSoundtrack={onResumeSoundtrack}
                  />
                </div>
              )}

              {vaultTab === 'art' && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <VaultArtGalleryView />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preset Detail Views */}
      {selectedWorld && (
        <WorldDetailModal
          world={selectedWorld}
          isDefault={selectedWorld.isDefault}
          onClose={() => setSelectedWorld(null)}
          onSetDefault={selectedWorld.id ? () => onSetDefaultWorld(selectedWorld.id!) : undefined}
          onEdit={selectedWorld.id ? () => {
            onEditWorld(selectedWorld.id!)
            setSelectedWorld(null)
          } : undefined}
          onDelete={selectedWorld.id ? () => {
            onDeleteWorld(selectedWorld.id!)
            setSelectedWorld(null)
          } : undefined}
          onUseInStory={selectedWorld.id ? () => {
            onNewSession(selectedWorld.id!)
            setSelectedWorld(null)
          } : undefined}
        />
      )}

      {selectedProtagonist && (
        <ProtagonistDetailModal
          protagonist={selectedProtagonist}
          isDefault={selectedProtagonist.isDefault}
          onClose={() => setSelectedProtagonist(null)}
          onSetDefault={selectedProtagonist.id ? () => onSetDefaultProtagonist(selectedProtagonist.id!) : undefined}
          onEdit={selectedProtagonist.id ? () => {
            onEditProtagonist(selectedProtagonist.id!)
            setSelectedProtagonist(null)
          } : undefined}
          onDelete={selectedProtagonist.id ? () => {
            onDeleteProtagonist(selectedProtagonist.id!)
            setSelectedProtagonist(null)
          } : undefined}
          onUseInStory={selectedProtagonist.id ? () => {
            onNewSession(undefined, selectedProtagonist.id!)
            setSelectedProtagonist(null)
          } : undefined}
        />
      )}
    </div>
  )
}
