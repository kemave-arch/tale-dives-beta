with open('src/screens/WorldSetup.tsx', 'r') as f:
    content = f.read()

# 1. Update Lucide icon imports
old_icons = """  Layers,
  Plus,"""
new_icons = """  Layers,
  MapPin,
  Plus,"""
content = content.replace(old_icons, new_icons)

# 2. Update type imports
old_types = "import type { WorldData, WorldFaction } from '../types.ts'"
new_types = "import type { WorldData, WorldFaction, WorldLocation } from '../types.ts'"
content = content.replace(old_types, new_types)

# 3. Update TABS
old_tabs = """const TABS = [
  { id: 'overview' as const, label: 'Overview', icon: Info },
  { id: 'depth' as const, label: 'Depth', icon: Layers },
]"""
new_tabs = """const TABS = [
  { id: 'overview' as const, label: 'Overview', icon: Info },
  { id: 'depth' as const, label: 'Depth', icon: Layers },
  { id: 'locations' as const, label: 'Locations', icon: MapPin },
]"""
content = content.replace(old_tabs, new_tabs)

# 4. Replace mobileTab state with activeTab state + locationsList state + locations modal state
old_states = """  const [viewMode, setViewMode] = useState<'gateway' | 'editor' | 'presets'>(() => (initial ? 'editor' : 'gateway'))
  const [mobileTab, setMobileTab] = useState<'overview' | 'depth'>('overview')"""

new_states = """  const [viewMode, setViewMode] = useState<'gateway' | 'editor' | 'presets'>(() => (initial ? 'editor' : 'gateway'))
  const [activeTab, setActiveTab] = useState<'overview' | 'depth' | 'locations'>('overview')"""

content = content.replace(old_states, new_states)

# Add locationsList state and location modal state after faction state
old_faction_state = """  const [editingFaction, setEditingFaction] = useState<{ index: number; faction: WorldFaction } | null>(null)
  const [newFactionModalOpen, setNewFactionModalOpen] = useState(false)
  const [factionDraftName, setFactionDraftName] = useState('')
  const [factionDraftAttitude, setFactionDraftAttitude] = useState<'allied' | 'friendly' | 'neutral' | 'hostile' | 'rival'>('neutral')
  const [factionDraftTerritory, setFactionDraftTerritory] = useState('')
  const [factionDraftDesc, setFactionDraftDesc] = useState('')"""

new_faction_and_loc_state = """  const [editingFaction, setEditingFaction] = useState<{ index: number; faction: WorldFaction } | null>(null)
  const [newFactionModalOpen, setNewFactionModalOpen] = useState(false)
  const [factionDraftName, setFactionDraftName] = useState('')
  const [factionDraftAttitude, setFactionDraftAttitude] = useState<'allied' | 'friendly' | 'neutral' | 'hostile' | 'rival'>('neutral')
  const [factionDraftTerritory, setFactionDraftTerritory] = useState('')
  const [factionDraftDesc, setFactionDraftDesc] = useState('')

  // Structured Locations list
  const [locationsList, setLocationsList] = useState<WorldLocation[]>(() => {
    if (initial?.locationsList && initial.locationsList.length > 0) return initial.locationsList
    return []
  })

  // Location Edit Modal state
  const [editingLocation, setEditingLocation] = useState<{ index: number; location: WorldLocation } | null>(null)
  const [newLocationModalOpen, setNewLocationModalOpen] = useState(false)
  const [locationDraftName, setLocationDraftName] = useState('')
  const [locationDraftRegion, setLocationDraftRegion] = useState('')
  const [locationDraftType, setLocationDraftType] = useState('Landmark')
  const [locationDraftDanger, setLocationDraftDanger] = useState('Safe')
  const [locationDraftFaction, setLocationDraftFaction] = useState('')
  const [locationDraftDesc, setLocationDraftDesc] = useState('')"""

content = content.replace(old_faction_state, new_faction_and_loc_state)

# 5. Add Location CRUD helper functions
old_faction_helpers_end = """  function deleteFaction(index: number) {
    const nextList = factionsList.filter((_, i) => i !== index)
    setFactionsList(nextList)
  }"""

new_faction_and_loc_helpers = """  function deleteFaction(index: number) {
    const nextList = factionsList.filter((_, i) => i !== index)
    setFactionsList(nextList)
  }

  function openAddLocation() {
    setLocationDraftName('')
    setLocationDraftRegion('')
    setLocationDraftType('Landmark')
    setLocationDraftDanger('Safe')
    setLocationDraftFaction('')
    setLocationDraftDesc('')
    setEditingLocation(null)
    setNewLocationModalOpen(true)
  }

  function openEditLocation(index: number) {
    const loc = locationsList[index]
    if (!loc) return
    setEditingLocation({ index, location: loc })
    setLocationDraftName(loc.name)
    setLocationDraftRegion(loc.region || '')
    setLocationDraftType(loc.locationType || 'Landmark')
    setLocationDraftDanger(loc.dangerLevel || 'Safe')
    setLocationDraftFaction(loc.factionOwner || '')
    setLocationDraftDesc(loc.description || '')
    setNewLocationModalOpen(true)
  }

  function saveLocationDraft() {
    if (!locationDraftName.trim()) return
    const updated: WorldLocation = {
      id: editingLocation?.location.id ?? `loc_${Date.now()}`,
      name: locationDraftName.trim(),
      region: locationDraftRegion.trim() || undefined,
      locationType: locationDraftType.trim() || undefined,
      dangerLevel: locationDraftDanger,
      factionOwner: locationDraftFaction.trim() || undefined,
      description: locationDraftDesc.trim() || undefined,
    }

    let nextList: WorldLocation[]
    if (editingLocation !== null) {
      nextList = locationsList.map((loc, i) => (i === editingLocation.index ? updated : loc))
    } else {
      nextList = [...locationsList, updated]
    }
    setLocationsList(nextList)
    setNewLocationModalOpen(false)
    setEditingLocation(null)
  }

  function deleteLocation(index: number) {
    const nextList = locationsList.filter((_, i) => i !== index)
    setLocationsList(nextList)
  }"""

content = content.replace(old_faction_helpers_end, new_faction_and_loc_helpers)

# 6. Update handleSelectPreset and startCleanWorld to handle locationsList
old_preset = """    if (t.factionsList && t.factionsList.length > 0) {
      setFactionsList(t.factionsList)
    } else if (t.keyFactions) {
      setFactionsList(
        t.keyFactions
          .split(/[,;\\n]+/)
          .map((f) => f.trim())
          .filter(Boolean)
          .map((fName, idx) => ({
            id: `fac_${idx}`,
            name: fName,
            attitude: 'neutral' as const,
          })),
      )
    } else {
      setFactionsList([])
    }"""

new_preset = """    if (t.factionsList && t.factionsList.length > 0) {
      setFactionsList(t.factionsList)
    } else if (t.keyFactions) {
      setFactionsList(
        t.keyFactions
          .split(/[,;\\n]+/)
          .map((f) => f.trim())
          .filter(Boolean)
          .map((fName, idx) => ({
            id: `fac_${idx}`,
            name: fName,
            attitude: 'neutral' as const,
          })),
      )
    } else {
      setFactionsList([])
    }

    if (t.locationsList && t.locationsList.length > 0) {
      setLocationsList(t.locationsList)
    } else {
      setLocationsList([])
    }"""

content = content.replace(old_preset, new_preset)

# In startCleanWorld:
old_clean = "setFactionsList([])"
new_clean = "setFactionsList([])\n    setLocationsList([])"
content = content.replace(old_clean, new_clean)

# In currentData:
old_currentdata = "factionsList: factionsList.length > 0 ? factionsList : undefined,"
new_currentdata = "factionsList: factionsList.length > 0 ? factionsList : undefined,\n      locationsList: locationsList.length > 0 ? locationsList : undefined,"
content = content.replace(old_currentdata, new_currentdata)

# 7. Add locationsFields JSX right after depthFields
old_depth_end = "  )"

locations_jsx = """  )

  const locationsFields = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-[#f5dfa0] flex items-center gap-1.5">
          <MapPin size={15} className="text-[#f0ca65]" />
          Key Locations ({locationsList.length})
        </h3>
        <button
          type="button"
          onClick={openAddLocation}
          title="Add Location"
          className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#f0ca65]/35 bg-[#f0ca65]/10 text-[#f0ca65] hover:bg-[#f0ca65]/25 hover:text-white text-xs font-display transition-colors cursor-pointer"
        >
          <Plus size={13} />
          <span>Add Location</span>
        </button>
      </div>

      <p className="font-narrative text-xs text-[#e8ca8a]/80 italic">
        Define key cities, fortresses, ruins, or landmarks. Locations created here are automatically seeded directly into the Story's Locations Codex on Turn 1!
      </p>

      {locationsList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e8ca8a]/20 p-5 text-center">
          <p className="font-narrative italic text-xs text-[#e8ca8a]/70">
            No locations seeded yet. Click "Add Location" above to define key landmarks for your world!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {locationsList.map((loc, idx) => (
            <div
              key={loc.id ?? idx}
              className="flex flex-col gap-1.5 p-3 rounded-xl border border-[#e8ca8a]/20 bg-[#120e1b]/70 hover:border-[#e8ca8a]/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-bold text-sm text-[#f5dfa0]">{loc.name}</span>
                  {loc.region && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-[#e8ca8a]/30 bg-[#e8ca8a]/10 text-[#e8ca8a]">
                      {loc.region}
                    </span>
                  )}
                  {loc.locationType && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-[#f0ca65]/30 bg-[#f0ca65]/10 text-[#f0ca65]">
                      {loc.locationType}
                    </span>
                  )}
                  {loc.dangerLevel && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                        loc.dangerLevel === 'Lethal' || loc.dangerLevel === 'Deadly' || loc.dangerLevel === 'High'
                          ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                          : loc.dangerLevel === 'Moderate'
                          ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                          : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {loc.dangerLevel}
                    </span>
                  )}
                  {loc.factionOwner && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-300">
                      {loc.factionOwner}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditLocation(idx)}
                    className="p-1 rounded text-[#e8ca8a]/70 hover:text-[#f5dfa0] hover:bg-white/5"
                    title="Edit Location"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteLocation(idx)}
                    className="p-1 rounded text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10"
                    title="Delete Location"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {loc.description && (
                <p className="font-narrative text-xs text-[#e8ca8a]/85 line-clamp-2">
                  {loc.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )"""

content = content.replace('  const depthFields = (', '  const depthFields = (\n')
# We replace the closing of depthFields
depth_end_pattern = """      </div>
    </div>
  )"""
content = content.replace(depth_end_pattern, depth_end_pattern + locations_jsx, 1)

# 8. Update main layout body to use GlassTabs for subtabs and show activeTab panel
old_main_body = """      {/* Mobile subtabs (< lg) outside scroll area */}
      <div className="lg:hidden px-4 pb-2 shrink-0">
        <div className="max-w-md mx-auto">
          <GlassTabs tabs={TABS} value={mobileTab} onChange={(id) => setMobileTab(id as 'overview' | 'depth')} className="w-full" />
        </div>
      </div>

      {/* Main Form Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 lg:py-4">
        <div className="max-w-md md:max-w-3xl lg:max-w-6xl mx-auto flex flex-col gap-5">
          {/* Mobile subtabs (< lg) */}
          <div className="lg:hidden">
            {mobileTab === 'overview' ? overviewFields : depthFields}
          </div>

          {/* PC Multi-Column Layout (>= lg) */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-8 relative items-start">
            {/* Column 1: Overview */}
            <div className="pr-4">{overviewFields}</div>

            {/* Vertical Ornate Center Divider */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-[#e8ca8a]/30 to-transparent pointer-events-none" />

            {/* Column 2: Depth & Factions */}
            <div className="pl-4">{depthFields}</div>
          </div>"""

new_main_body = """      {/* Subtabs strip */}
      <div className="px-4 pb-2 shrink-0">
        <div className="max-w-md md:max-w-3xl lg:max-w-6xl mx-auto">
          <GlassTabs tabs={TABS} value={activeTab} onChange={(id) => setActiveTab(id as 'overview' | 'depth' | 'locations')} className="w-full" />
        </div>
      </div>

      {/* Main Form Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <div className="max-w-md md:max-w-3xl lg:max-w-6xl mx-auto flex flex-col gap-5">
          {activeTab === 'overview' && overviewFields}
          {activeTab === 'depth' && depthFields}
          {activeTab === 'locations' && locationsFields}"""

content = content.replace(old_main_body, new_main_body)

# 9. Add Location Edit Modal right after Faction Edit Modal
old_faction_modal_end = "      {/* Add / Edit Faction Modal */}"

location_modal_jsx = """      {/* Add / Edit Location Modal */}
      {newLocationModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setNewLocationModalOpen(false)}
        >
          <div
            className={`${GLASS_SURFACE} rounded-2xl w-full max-w-lg flex flex-col p-5 shadow-2xl bg-[#120e1b]/95 border-[#f0ca65]/40 max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e8ca8a]/20">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-[#f0ca65]" />
                <h3 className="font-display font-semibold text-sm uppercase tracking-[0.12em] text-[#fae5b5]">
                  {editingLocation !== null ? 'Edit Location' : 'Add Key Location'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNewLocationModalOpen(false)}
                className="p-1 rounded-full text-[#e8ca8a]/60 hover:text-[#f5dfa0] hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 py-4">
              <GlassField label="Location Name *" hint="e.g. Basgiath War College">
                <input
                  autoFocus
                  type="text"
                  value={locationDraftName}
                  onChange={(e) => setLocationDraftName(e.target.value)}
                  placeholder="e.g. Basgiath War College..."
                  className={FIELD_CLASS}
                />
              </GlassField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GlassField label="Region / Territory" hint="e.g. Navarre Highlands">
                  <input
                    type="text"
                    value={locationDraftRegion}
                    onChange={(e) => setLocationDraftRegion(e.target.value)}
                    placeholder="e.g. Navarre Highlands..."
                    className={FIELD_CLASS}
                  />
                </GlassField>

                <GlassField label="Location Type" hint="Category">
                  <select
                    value={locationDraftType}
                    onChange={(e) => setLocationDraftType(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="City">City</option>
                    <option value="Fortress / College">Fortress / College</option>
                    <option value="Dungeon">Dungeon</option>
                    <option value="Wilderness">Wilderness</option>
                    <option value="Chokepoint">Chokepoint</option>
                    <option value="Landmark">Landmark</option>
                    <option value="Hidden Settlement">Hidden Settlement</option>
                    <option value="Ruins">Ruins</option>
                  </select>
                </GlassField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <GlassField label="Danger Level">
                  <select
                    value={locationDraftDanger}
                    onChange={(e) => setLocationDraftDanger(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="Safe">Safe</option>
                    <option value="Low">Low</option>
                    <option value="Moderate">Moderate</option>
                    <option value="High">High</option>
                    <option value="Deadly">Deadly</option>
                    <option value="Lethal">Lethal</option>
                  </select>
                </GlassField>

                <GlassField label="Faction Owner / Affiliation" hint="Optional">
                  <input
                    type="text"
                    value={locationDraftFaction}
                    onChange={(e) => setLocationDraftFaction(e.target.value)}
                    placeholder="e.g. Riders Quadrant..."
                    className={FIELD_CLASS}
                  />
                </GlassField>
              </div>

              <GlassField label="Description & History" hint="Key details for narration">
                <textarea
                  rows={3}
                  value={locationDraftDesc}
                  onChange={(e) => setLocationDraftDesc(e.target.value)}
                  placeholder="Describe what makes this location significant in your world..."
                  className={`${FIELD_CLASS} resize-none`}
                />
              </GlassField>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8ca8a]/20">
              <GlassButton onClick={() => setNewLocationModalOpen(false)}>Cancel</GlassButton>
              <GlassButton tone="action" onClick={saveLocationDraft}>
                {editingLocation !== null ? 'Save Changes' : 'Add Location'}
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Faction Modal */}"""

content = content.replace(old_faction_modal_end, location_modal_jsx)

with open('src/screens/WorldSetup.tsx', 'w') as f:
    f.write(content)

print("Updated WorldSetup.tsx successfully")
