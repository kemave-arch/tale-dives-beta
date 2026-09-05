import re

with open('src/screens/NewGame.tsx', 'r') as f:
    content = f.read()

content = content.replace(
'''  onSavePreset?: (protagonist: ProtagonistData) => void
  onSaveAsNewPreset?: (protagonist: ProtagonistData) => void
}''',
'''  onSavePreset?: (protagonist: ProtagonistData) => void
  onSaveAsNewPreset?: (protagonist: ProtagonistData) => void
  onDeletePreset?: (id: string) => void
}''')

content = content.replace(
'''  onSavePreset,
  onSaveAsNewPreset,
}: NewGameProps) {''',
'''  onSavePreset,
  onSaveAsNewPreset,
  onDeletePreset,
}: NewGameProps) {''')

with open('src/screens/NewGame.tsx', 'w') as f:
    f.write(content)

