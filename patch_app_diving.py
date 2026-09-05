import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# 1. Update beginCampaign to navigateTo('diveloading') and playTrack
begin_old = "    navigateTo('chronicle')"
begin_new = "    navigateTo('diveloading')\n    playTrack('TempestDive_ost03.opus')"
content = content.replace(begin_old, begin_new, 1) # Only first match (in beginCampaign)

# 2. Add useEffect to transition from diveloading to storymode
use_effect_str = "  const navigateTo = (nextScreen: Screen, replace = false) => {"
use_effect_new = """  useEffect(() => {
    if (screen === 'diveloading' && game && game.log.length > 0) {
      navigateTo('storymode', true)
    }
  }, [screen, game])

  const navigateTo = (nextScreen: Screen, replace = false) => {"""
content = content.replace(use_effect_str, use_effect_new)

# 3. Add import for DiveLoadingScreen
import_old = "import TaleBrief from './screens/TaleBrief.tsx'"
import_new = "import TaleBrief from './screens/TaleBrief.tsx'\nimport DiveLoadingScreen from './screens/DiveLoadingScreen.tsx'"
content = content.replace(import_old, import_new)

# 4. Add diveloading screen renderer
render_old = "  } else if (screen === 'storymode') {"
render_new = "  } else if (screen === 'diveloading') {\n    content = <DiveLoadingScreen />\n  } else if (screen === 'storymode') {"
content = content.replace(render_old, render_new)

# 5. Add diveloading to Screen type
# type Screen = 'title' | 'mainmenu' | 'newgame' | 'chronicle' | 'codex' | 'settings' | 'worldsetup' | 'talebrief' | 'storymode'
screen_old = "export type Screen = 'title' | 'mainmenu' | 'newgame' | 'chronicle' | 'codex' | 'settings' | 'worldsetup' | 'talebrief' | 'storymode'"
screen_new = "export type Screen = 'title' | 'mainmenu' | 'newgame' | 'chronicle' | 'codex' | 'settings' | 'worldsetup' | 'talebrief' | 'storymode' | 'diveloading'"
content = content.replace(screen_old, screen_new)

with open('src/App.tsx', 'w') as f:
    f.write(content)
