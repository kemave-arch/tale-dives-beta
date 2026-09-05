with open('src/screens/WorldSetup.tsx', 'r') as f:
    content = f.read()

# Let's find where the main form scrollable container ends in WorldSetup.tsx
# The form container ends before {/* Fixed Sticky Action Footer */}

target = '''          {/* PC Multi-Column Layout (>= lg) */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-8 relative items-start">
            {/* Column 1: Overview */}
            <div className="pr-4">{overviewFields}</div>
            {/* Vertical Ornate Center Divider */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-[#e8ca8a]/30 to-transparent pointer-events-none" />
            {/* Column 2: Depth & Factions */}
            <div className="pl-4">{depthFields}</div>
          </div>
        </div>
      </div>'''

replacement = '''          {/* PC Multi-Column Layout (>= lg) */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-8 relative items-start">
            {/* Column 1: Overview */}
            <div className="pr-4">{overviewFields}</div>
            {/* Vertical Ornate Center Divider */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-[#e8ca8a]/30 to-transparent pointer-events-none" />
            {/* Column 2: Depth & Factions */}
            <div className="pl-4">{depthFields}</div>
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
      </div>'''

content = content.replace(target, replacement)

# Make sure Save icon is imported
if "Save," not in content:
    content = content.replace("  Plus,\n", "  Plus,\n  Save,\n")

with open('src/screens/WorldSetup.tsx', 'w') as f:
    f.write(content)
