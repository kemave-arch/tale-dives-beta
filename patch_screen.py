import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace("type Screen = 'title' | 'mainmenu' | 'storymode' | 'worldsetup' | 'newgame' | 'talebrief' | 'chronicle' | 'codex'", "type Screen = 'title' | 'mainmenu' | 'storymode' | 'worldsetup' | 'newgame' | 'talebrief' | 'chronicle' | 'codex' | 'diveloading'")

with open('src/App.tsx', 'w') as f:
    f.write(content)
