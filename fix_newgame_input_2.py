import re

with open('src/screens/NewGame.tsx', 'r') as f:
    content = f.read()

pattern = r'onChange=\{\(e\) => handleCustomClassChange\(e\.target\.value\)\} //.*?\}\}'

replacement = 'onChange={(e) => handleCustomClassChange(e.target.value)}'

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/screens/NewGame.tsx', 'w') as f:
    f.write(content)
