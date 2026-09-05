import re

with open('src/screens/NewGame.tsx', 'r') as f:
    content = f.read()

action_row = '''          {/* Preset Saving Action Row */}
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

content = content.replace(action_row, '')

skills_field_end = '''                  <button
                    type="button"
                    onClick={() => deleteSkill(idx)}
                    className="p-1 rounded text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10"
                    title="Delete Ability"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )'''

skills_field_new = '''                  <button
                    type="button"
                    onClick={() => deleteSkill(idx)}
                    className="p-1 rounded text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10"
                    title="Delete Ability"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(onSavePreset || onSaveAsNewPreset) && (
        <div className="flex gap-2 mt-2 pt-4 border-t border-[#e8ca8a]/15">
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
    </div>
  )'''

if "Save Preset" not in content[content.find("const skillsFields ="):content.find("return (")]:
    content = content.replace(skills_field_end, skills_field_new)

with open('src/screens/NewGame.tsx', 'w') as f:
    f.write(content)
