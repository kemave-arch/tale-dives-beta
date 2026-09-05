import re

with open('src/screens/WorldSetup.tsx', 'r') as f:
    content = f.read()

# Subtitle of World Background
content = content.replace(
    'label="World Background"',
    'label="World Background" hint="Describe the setting, genre, tone, and core conflicts"'
)
content = content.replace(
    '<span className={LABEL_CLASS}>World Background</span>',
    '<span className={LABEL_CLASS}>World Background <span className="font-narrative text-[10px] text-ink-muted/50 normal-case tracking-normal ml-2">Describe the setting, genre, tone, and core conflicts</span></span>'
)


# Remove Genre & Tone block
genre_block = '''          <GlassField
            label="Genre & Tone"
            hint="The atmosphere of the story"
            examples={GENRE_TONE_EXAMPLES}
            onPickExample={(val) => setGenreTone(val)}
          >
            <GlassTextarea
              value={genreTone}
              onChange={(e) => setGenreTone(e.target.value)}
              placeholder="e.g. Grimdark dark fantasy, High-fantasy epic, Victorian gothic horror..."
              rows={2}
            />
          </GlassField>'''
content = content.replace(genre_block, '')

# Remove Core Regional Conflict block
conflict_block = '''          <GlassField
            label="Core Regional Conflict"
            hint="What's driving the tension?"
            examples={CONFLICT_EXAMPLES}
            onPickExample={(val) => setConflict(val)}
          >
            <GlassTextarea
              value={conflict}
              onChange={(e) => setConflict(e.target.value)}
              placeholder="e.g. A civil war between two noble houses, An encroaching blight from the north..."
              rows={2}
            />
          </GlassField>'''
content = content.replace(conflict_block, '')

with open('src/screens/WorldSetup.tsx', 'w') as f:
    f.write(content)

