with open('src/screens/NewGame.tsx', 'r') as f:
    content = f.read()

target = '''              <input
                type="text"
                value={customClassName}
                onChange={(e) => handleCustomClassChange(e.target.value)} //                  setCustomClassName(e.target.value)
                  setClassId(e.target.value.trim().toLowerCase().replace(/\\s+/g, '_') || 'adventurer')
                }}
                placeholder="e.g. Sellsword, Spellblade..."
                className={FIELD_CLASS}
              />'''

replacement = '''              <input
                type="text"
                value={customClassName}
                onChange={(e) => handleCustomClassChange(e.target.value)}
                placeholder="e.g. Sellsword, Spellblade..."
                className={FIELD_CLASS}
              />'''

content = content.replace(target, replacement)

with open('src/screens/NewGame.tsx', 'w') as f:
    f.write(content)
