with open('src/screens/NewGame.tsx', 'r') as f:
    content = f.read()

# Fix onDeletePreset(selectedPreset.id) type error
content = content.replace(
    'onDeletePreset(selectedPreset.id)',
    'if (selectedPreset.id) onDeletePreset(selectedPreset.id)'
)

with open('src/screens/NewGame.tsx', 'w') as f:
    f.write(content)
