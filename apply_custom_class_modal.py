with open('src/screens/NewGame.tsx', 'r') as f:
    content = f.read()

# Add modal states near skillModalOpen
state_target = "  // Skill Modal State\n  const [skillModalOpen, setSkillModalOpen] = useState(false)"
state_replacement = """  // Custom Class Modal State
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [customDraftName, setCustomDraftName] = useState('')
  const [customDraftArchetype, setCustomDraftArchetype] = useState(PRESET_CLASSES[0].id)

  // Skill Modal State
  const [skillModalOpen, setSkillModalOpen] = useState(false)"""

content = content.replace(state_target, state_replacement)

# Replace handleCustomClassChange with handleSelectClass and openCustomClassModal
change_target = """  function handleCustomClassChange(typed: string) {
    setCustomClassName(typed)
    const matched = PRESET_CLASSES.find((c) => c.name.toLowerCase() === typed.trim().toLowerCase())
    if (matched) {
      if (classId !== matched.id) {
        setClassId(matched.id)
        if (CLASS_STARTER_SKILLS[matched.id]) {
          setStartingSkills(CLASS_STARTER_SKILLS[matched.id])
        }
        autoDistributeForClass(matched.id)
      }
    } else {
      setClassId(typed.trim().toLowerCase().replace(/\\s+/g, '_') || 'adventurer')
    }
  }"""

change_replacement = """  const activePreset = PRESET_CLASSES.find((c) => c.id === classId)
  const isCustom = !activePreset || activePreset.name.toLowerCase() !== customClassName.trim().toLowerCase()

  function openCustomClassModal() {
    setCustomDraftName(isCustom ? customClassName : '')
    setCustomDraftArchetype(classId && PRESET_CLASSES.some((c) => c.id === classId) ? classId : PRESET_CLASSES[0].id)
    setCustomModalOpen(true)
  }

  function handleSelectClass(value: string) {
    if (value === 'custom') {
      openCustomClassModal()
    } else {
      const preset = PRESET_CLASSES.find((c) => c.id === value)
      if (preset) {
        setClassId(preset.id)
        setCustomClassName(preset.name)
        if (CLASS_STARTER_SKILLS[preset.id]) {
          setStartingSkills(CLASS_STARTER_SKILLS[preset.id])
        }
        autoDistributeForClass(preset.id)
      }
    }
  }"""

content = content.replace(change_target, change_replacement)

# Update currentData() function
currentdata_target = """  function currentData(): ProtagonistData {
    const trimmedName = customClassName.trim()
    const matched = PRESET_CLASSES.find(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase() || c.id === classId,
    )
    const finalClassId = matched ? matched.id : (trimmedName.toLowerCase().replace(/\s+/g, '_') || 'adventurer')
    const finalClassName = matched ? matched.name : (trimmedName || 'Adventurer')

    return {
      id: templateId,
      name: name || 'The Wanderer',
      gender: gender.trim() || undefined,
      age: age.trim() ? Number(age) : undefined,
      classId: finalClassId,
      className: finalClassName,"""

currentdata_replacement = """  function currentData(): ProtagonistData {
    const matched = PRESET_CLASSES.find((c) => c.id === classId)
    const finalClassId = classId || 'warrior'
    const finalClassName = customClassName.trim() || (matched ? matched.name : 'Adventurer')

    return {
      id: templateId,
      name: name || 'The Wanderer',
      gender: gender.trim() || undefined,
      age: age.trim() ? Number(age) : undefined,
      classId: finalClassId,
      className: finalClassName,"""

content = content.replace(currentdata_target, currentdata_replacement)

# Replace the JSX for Archetype / Class
jsx_target = """      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <GlassField label="Archetype / Class" hint="Custom class or pick preset">
            <input
              type="text"
              value={customClassName}
              onChange={(e) => handleCustomClassChange(e.target.value)}
              placeholder="e.g. Sellsword, Spellblade..."
              className={FIELD_CLASS}
            />
          </GlassField>
        </div>"""

jsx_replacement = """      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <GlassField label="Archetype / Class" hint="Choose a class preset or Custom Class">
            <div className="flex gap-2">
              <select
                value={isCustom ? 'custom' : classId}
                onChange={(e) => handleSelectClass(e.target.value)}
                className={SELECT_CLASS + " cursor-pointer flex-1"}
              >
                {PRESET_CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="custom">
                  {isCustom && customClassName.trim() ? `Custom (${customClassName.trim()})` : 'Custom Class...'}
                </option>
              </select>
              {isCustom && (
                <button
                  type="button"
                  onClick={openCustomClassModal}
                  className="px-2.5 py-1.5 rounded-lg border border-[#e8ca8a]/30 bg-[#e8ca8a]/10 hover:bg-[#e8ca8a]/20 text-[#f5dfa0] text-xs font-display flex items-center gap-1 shrink-0"
                  title="Edit Custom Class"
                >
                  <Edit2 size={13} />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </GlassField>
        </div>"""

content = content.replace(jsx_target, jsx_replacement)

# Add Custom Class Modal next to Skill Modal
modal_target = "      {/* Add / Edit Skill Modal */}"
modal_replacement = """      {/* Custom Class Setup Modal */}
      {customModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setCustomModalOpen(false)}
        >
          <div
            className={`${GLASS_SURFACE} rounded-2xl w-full max-w-md flex flex-col p-5 shadow-2xl bg-[#120e1b]/95 border-[#f0ca65]/40`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#e8ca8a]/20">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#f0ca65]" />
                <h3 className="font-display font-semibold text-sm uppercase tracking-[0.12em] text-[#fae5b5]">
                  Custom Class Setup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCustomModalOpen(false)}
                className="p-1 rounded-full text-[#e8ca8a]/60 hover:text-[#f5dfa0] hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-4 py-4">
              <GlassField label="Custom Class Name" hint="e.g. Shadow Assassin, Star Knight">
                <input
                  autoFocus
                  type="text"
                  value={customDraftName}
                  onChange={(e) => setCustomDraftName(e.target.value)}
                  placeholder="e.g. Shadow Assassin, Spellblade, Star Knight..."
                  className={FIELD_CLASS}
                />
              </GlassField>

              <GlassField label="Base Archetype (Stat Curve)" hint="Select base archetype for vitals & attribute growth">
                <select
                  value={customDraftArchetype}
                  onChange={(e) => setCustomDraftArchetype(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {PRESET_CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </GlassField>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e8ca8a]/20">
              <GlassButton onClick={() => setCustomModalOpen(false)}>Cancel</GlassButton>
              <GlassButton
                tone="action"
                onClick={() => {
                  const finalName = customDraftName.trim() || 'Custom Hero'
                  const archetypeId = customDraftArchetype
                  setCustomClassName(finalName)
                  setClassId(archetypeId)
                  autoDistributeForClass(archetypeId)
                  if (CLASS_STARTER_SKILLS[archetypeId]) {
                    setStartingSkills(CLASS_STARTER_SKILLS[archetypeId])
                  }
                  setCustomModalOpen(false)
                }}
              >
                Save Custom Class
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Skill Modal */}"""

content = content.replace(modal_target, modal_replacement)

with open('src/screens/NewGame.tsx', 'w') as f:
    f.write(content)
print("Updated NewGame.tsx successfully")
