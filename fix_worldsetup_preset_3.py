import re

with open('src/screens/WorldSetup.tsx', 'r') as f:
    content = f.read()

pattern = r'(\{depthFields\}</div>\s*</div>\s*</div>\s*</div>\s*\{\/\* Fixed Sticky Action Footer \*\/\})'

replacement = '''{depthFields}</div>
          </div>

          {(onSavePreset || onSaveAsNewPreset) && (
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

content = re.sub(pattern, replacement, content)

with open('src/screens/WorldSetup.tsx', 'w') as f:
    f.write(content)
