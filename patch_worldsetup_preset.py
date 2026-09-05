import re

with open('src/screens/WorldSetup.tsx', 'r') as f:
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

depth_field_end = '''          </button>
        </div>
      </div>
    </div>
  )'''

depth_field_new = '''          </button>
        </div>
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

content = content.replace(depth_field_end, depth_field_new)

with open('src/screens/WorldSetup.tsx', 'w') as f:
    f.write(content)
