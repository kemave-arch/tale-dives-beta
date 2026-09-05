with open('src/screens/WorldSetup.tsx', 'r') as f:
    content = f.read()

target = '</div>\n        </div>\n      </div>\n      {/* Fixed Sticky Action Footer */}'

replacement = '''          {(onSavePreset || onSaveAsNewPreset) && (
            <div className="flex gap-2 pt-4 border-t border-[#e8ca8a]/15">
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
      </div>
      {/* Fixed Sticky Action Footer */}'''

content = content.replace(target, replacement)

with open('src/screens/WorldSetup.tsx', 'w') as f:
    f.write(content)
