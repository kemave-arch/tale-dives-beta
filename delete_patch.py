import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Find upsertWorld
upsert_world_idx = content.find('function upsertWorld')

if upsert_world_idx != -1:
    delete_funcs = """
  function deleteWorld(id: string) {
    setWorlds((w) => {
      const copy = { ...w }
      delete copy[id]
      return copy
    })
  }

  function deleteProtagonist(id: string) {
    setProtagonists((p) => {
      const copy = { ...p }
      delete copy[id]
      return copy
    })
  }

  """
    new_content = content[:upsert_world_idx] + delete_funcs + content[upsert_world_idx:]
    
    # Also pass these to WorldSetup and NewGame
    new_content = new_content.replace('onSaveAsNewPreset={(worldData) => upsertWorld(worldData, null)}', 
                                      'onSaveAsNewPreset={(worldData) => upsertWorld(worldData, null)}\n        onDeletePreset={deleteWorld}')
    new_content = new_content.replace('onSaveAsNewPreset={(protagonist) => upsertProtagonist(protagonist, null)}', 
                                      'onSaveAsNewPreset={(protagonist) => upsertProtagonist(protagonist, null)}\n        onDeletePreset={deleteProtagonist}')
    
    with open('src/App.tsx', 'w') as f:
        f.write(new_content)
    print("Patched App.tsx")
