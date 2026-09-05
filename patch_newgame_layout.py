import re

with open('src/screens/NewGame.tsx', 'r') as f:
    content = f.read()

# 1 & 4. Gender as a dropdown, class as text + preset button.
# Replace the flex block for Archetype/Class and Gender.
# Wait, currently it looks like this:
old_class_gender = '''      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <GlassField label="Archetype / Class" hint="Input custom class or pick preset">
            <input
              type="text"
              value={customClassName}
              onChange={(e) => handleCustomClassChange(e.target.value)}
              placeholder="e.g. Sellsword, Spellblade..."
              className={FIELD_CLASS}
              list="preset-classes-list"
            />
            <datalist id="preset-classes-list">
              {PRESET_CLASSES.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </GlassField>
        </div>
        <div className="w-32 shrink-0">
          <GlassField label="Gender" hint="">
            <input
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              placeholder="female, male..."
              className={FIELD_CLASS}
            />
          </GlassField>
        </div>
      </div>'''

# The user wants "make a small preset button near the field". And "text input text type instead".
new_class_gender = '''      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <GlassField label="Archetype / Class" hint="Custom class or pick preset">
            <div className="flex gap-2">
              <input
                type="text"
                value={customClassName}
                onChange={(e) => {
                  setCustomClassName(e.target.value)
                  setClassId(e.target.value.trim().toLowerCase().replace(/\s+/g, '_') || 'adventurer')
                }}
                placeholder="e.g. Sellsword, Spellblade..."
                className={FIELD_CLASS}
              />
              <button
                type="button"
                onClick={() => setViewMode('presets')}
                className="w-10 shrink-0 rounded-lg bg-[#e8ca8a]/10 hover:bg-[#e8ca8a]/25 border border-[#e8ca8a]/30 flex items-center justify-center text-[#f5dfa0]"
                title="Browse Presets"
              >
                <Search size={14} />
              </button>
            </div>
          </GlassField>
        </div>
        <div className="w-20 shrink-0">
          <GlassField label="Gender" hint="">
            <select
              value={gender || 'N/A'}
              onChange={(e) => setGender(e.target.value === 'N/A' ? '' : e.target.value)}
              className={FIELD_CLASS + " appearance-none cursor-pointer"}
              style={{ backgroundImage: 'none' }}
            >
              <option value="N/A">N/A</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </GlassField>
        </div>
      </div>'''

content = content.replace(old_class_gender, new_class_gender)

# 2. Remove the small gain values `+0`.
# Replace: <span className="font-mono text-[10px] text-[#e8ca8a]/50">+{attrs[attr] - BASE_ATTR_VALUE}</span>
# with nothing.
content = content.replace('<span className="font-mono text-[10px] text-[#e8ca8a]/50">+{attrs[attr] - BASE_ATTR_VALUE}</span>', '')

# 3. Make Vitals more compact. Remove "Shadow Referee Validated" text.
# Let's find the derived vitals preview.
old_vitals = '''      {/* Derived Vitals Preview */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display font-bold text-[10px] uppercase tracking-[0.15em] text-[#fae5b5] flex items-center gap-1.5">
            Derived Vitals Preview
            <button
              type="button"
              onClick={() => setActiveTooltip(activeTooltip === 'vitals' ? null : 'vitals')}
              className="text-[#e8ca8a]/40 hover:text-[#f5dfa0]"
            >
              <HelpCircle size={10} />
            </button>
          </span>
          <span className="font-mono text-[9px] text-emerald-400/60 uppercase tracking-widest">Shadow Referee Validated</span>
        </div>

        {activeTooltip === 'vitals' && (
          <div className="px-3 py-2 rounded-lg border border-[#f0ca65]/30 bg-[#190d29]/90 text-[11px] font-narrative text-[#f5dfa0] mb-1">
            <span className="block font-semibold mb-1">Health (HP) = {BASE_HP_MP_ST} + (STR × {HP_PER_STR})</span>
            <span className="block font-semibold mb-1">Mana (MP) = {BASE_HP_MP_ST} + (INT × {MP_PER_INT})</span>
            <span className="block font-semibold">Stamina (ST) = {BASE_HP_MP_ST} + (AGI × {ST_PER_AGI})</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {/* HP */}
          <div className="flex flex-col gap-1 items-center justify-center p-2.5 rounded-lg border border-rose-500/20 bg-rose-950/20">
            <div className="flex items-center gap-1.5 text-rose-400">
              <Heart size={12} />
              <span className="font-display font-bold text-[10px] tracking-wider uppercase">HP Max</span>
            </div>
            <span className="font-mono font-bold text-xl text-rose-200">{derivedPools(attrs.STR, attrs.INT, attrs.AGI).hp}</span>
          </div>
          {/* MP */}
          <div className="flex flex-col gap-1 items-center justify-center p-2.5 rounded-lg border border-sky-500/20 bg-sky-950/20">
            <div className="flex items-center gap-1.5 text-sky-400">
              <Wand2 size={12} />
              <span className="font-display font-bold text-[10px] tracking-wider uppercase">MP Max</span>
            </div>
            <span className="font-mono font-bold text-xl text-sky-200">{derivedPools(attrs.STR, attrs.INT, attrs.AGI).mp}</span>
          </div>
          {/* ST */}
          <div className="flex flex-col gap-1 items-center justify-center p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Wind size={12} />
              <span className="font-display font-bold text-[10px] tracking-wider uppercase">ST Max</span>
            </div>
            <span className="font-mono font-bold text-xl text-emerald-200">{derivedPools(attrs.STR, attrs.INT, attrs.AGI).st}</span>
          </div>
        </div>
      </div>'''

new_vitals = '''      {/* Derived Vitals Preview */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-display font-bold text-[10px] uppercase tracking-[0.15em] text-[#fae5b5] flex items-center gap-1.5">
            Derived Vitals
            <button
              type="button"
              onClick={() => setActiveTooltip(activeTooltip === 'vitals' ? null : 'vitals')}
              className="text-[#e8ca8a]/40 hover:text-[#f5dfa0]"
            >
              <HelpCircle size={10} />
            </button>
          </span>
        </div>

        {activeTooltip === 'vitals' && (
          <div className="px-3 py-2 rounded-lg border border-[#f0ca65]/30 bg-[#190d29]/90 text-[11px] font-narrative text-[#f5dfa0] mb-1">
            <span className="block font-semibold mb-1">Health (HP) = {BASE_HP_MP_ST} + (STR × {HP_PER_STR})</span>
            <span className="block font-semibold mb-1">Mana (MP) = {BASE_HP_MP_ST} + (INT × {MP_PER_INT})</span>
            <span className="block font-semibold">Stamina (ST) = {BASE_HP_MP_ST} + (AGI × {ST_PER_AGI})</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {/* HP */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-rose-500/20 bg-rose-950/20">
            <div className="flex items-center gap-1 text-rose-400">
              <Heart size={10} />
              <span className="font-display font-bold text-[9px] tracking-wider uppercase">HP</span>
            </div>
            <span className="font-mono font-bold text-sm text-rose-200">{derivedPools(attrs.STR, attrs.INT, attrs.AGI).hp}</span>
          </div>
          {/* MP */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-sky-500/20 bg-sky-950/20">
            <div className="flex items-center gap-1 text-sky-400">
              <Wand2 size={10} />
              <span className="font-display font-bold text-[9px] tracking-wider uppercase">MP</span>
            </div>
            <span className="font-mono font-bold text-sm text-sky-200">{derivedPools(attrs.STR, attrs.INT, attrs.AGI).mp}</span>
          </div>
          {/* ST */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20">
            <div className="flex items-center gap-1 text-emerald-400">
              <Wind size={10} />
              <span className="font-display font-bold text-[9px] tracking-wider uppercase">ST</span>
            </div>
            <span className="font-mono font-bold text-sm text-emerald-200">{derivedPools(attrs.STR, attrs.INT, attrs.AGI).st}</span>
          </div>
        </div>
      </div>'''

content = content.replace(old_vitals, new_vitals)

# 5. Make the Save as New Preset available in the last section of the Subtabs instead.
# For NewGame, it's `skillsFields`.
# Current placement:
old_preset_action = '''          {/* Preset Saving Action Row */}
          {(onSavePreset || onSaveAsNewPreset) && (
            <div className="flex gap-2 pt-2 border-t border-[#e8ca8a]/15">
              {templateId && onSavePreset && (
                <GlassButton onClick={() => onSavePreset(currentData())} icon={Save} className="flex-1">
                  Save Preset
                </GlassButton>
              )}
              {onSaveAsNewPreset && (
                <GlassButton onClick={() => onSaveAsNewPreset({ ...currentData(), id: null })} icon={Plus} className="flex-1">
                  Save as New Preset
                </GlassButton>
              )}
            </div>
          )}'''

new_preset_action = '' # We remove it from here.
content = content.replace(old_preset_action, new_preset_action)

# Add it to the end of skillsFields.
# Look for: `          </GlassButton>\n        </div>\n      </div>\n    </div>\n  )`
skills_field_end = '''          </GlassButton>
        </div>
      </div>
'''
skills_field_new = '''          </GlassButton>
        </div>
      </div>

      {(onSavePreset || onSaveAsNewPreset) && (
        <div className="flex gap-2 pt-2 lg:hidden">
          {templateId && onSavePreset && (
            <GlassButton onClick={() => onSavePreset(currentData())} icon={Save} className="flex-1">
              Save Preset
            </GlassButton>
          )}
          {onSaveAsNewPreset && (
            <GlassButton onClick={() => onSaveAsNewPreset({ ...currentData(), id: null })} icon={Plus} className="flex-1">
              Save as New Preset
            </GlassButton>
          )}
        </div>
      )}
'''
content = content.replace(skills_field_end, skills_field_new)

# Wait, if lg is active, where does it go? The user says "Make the Save as New Preset available in the last section of the Subtabs in both World and Protagonist setup instead."
# If I hide it with `lg:hidden` in the subtab, how do they save on Desktop?
# Let's remove `lg:hidden` and just let it render inside the skills fields on both Mobile and PC, because skills is in the 2nd column on PC anyway.

skills_field_new = '''          </GlassButton>
        </div>
      </div>

      {(onSavePreset || onSaveAsNewPreset) && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-[#e8ca8a]/15">
          {templateId && onSavePreset && (
            <GlassButton onClick={() => onSavePreset(currentData())} icon={Save} className="flex-1">
              Save Preset
            </GlassButton>
          )}
          {onSaveAsNewPreset && (
            <GlassButton onClick={() => onSaveAsNewPreset({ ...currentData(), id: null })} icon={Plus} className="flex-1">
              Save as New Preset
            </GlassButton>
          )}
        </div>
      )}
'''
content = content.replace(skills_field_end, skills_field_new)

with open('src/screens/NewGame.tsx', 'w') as f:
    f.write(content)

