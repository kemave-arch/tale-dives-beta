with open('src/screens/WorldSetup.tsx', 'r') as f:
    content = f.read()

# Fix dual hint
content = content.replace(
    'label="World Background" hint="Describe the setting, genre, tone, and core conflicts"\n        hint="The setting\'s primary geography, history, tone, and conflict"',
    'label="World Background"\n        hint="Describe the setting, genre, tone, and core conflicts"'
)

# Fix onDeletePreset(selectedPreset.id) type error by guarding id
content = content.replace(
    'onDeletePreset(selectedPreset.id)',
    'if (selectedPreset.id) onDeletePreset(selectedPreset.id)'
)

# Remove unused imports if present
content = content.replace('  Save,\n', '')

with open('src/screens/WorldSetup.tsx', 'w') as f:
    f.write(content)
