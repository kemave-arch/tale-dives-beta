import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Remove the injected useEffect
use_effect_block = """  useEffect(() => {
    if (screen === 'diveloading' && game && game.log.length > 0) {
      navigateTo('storymode', true)
    }
  }, [screen, game])

  const navigateTo = (nextScreen: Screen, replace = false) => {"""

content = content.replace(use_effect_block, "  const navigateTo = (nextScreen: Screen, replace = false) => {")

# Find a good place for it (e.g. after const [pendingProtagonist, setPendingProtagonist])
hook_placement = """  const [pendingProtagonist, setPendingProtagonist] = useState<ProtagonistData | null>(null)"""
hook_new = hook_placement + """

  useEffect(() => {
    if (screen === 'diveloading' && game && game.log.length > 0) {
      navigateTo('storymode', true)
    }
  }, [screen, game])"""

content = content.replace(hook_placement, hook_new)

with open('src/App.tsx', 'w') as f:
    f.write(content)
