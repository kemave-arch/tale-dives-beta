with open('src/screens/NewGame.tsx', 'r') as f:
    content = f.read()

bad_str = """              <input
                type="text"
                value={customClassName}
                onChange={(e) => handleCustomClassChange(e.target.value)} //                  setCustomClassName(e.target.value)
                  setClassId(e.target.value.trim().toLowerCase().replace(/\\s+/g, '_') || 'adventurer')
                }}
                placeholder="e.g. Sellsword, Spellblade..."
                className={FIELD_CLASS}
              />"""

good_str = """              <input
                type="text"
                value={customClassName}
                onChange={(e) => handleCustomClassChange(e.target.value)}
                placeholder="e.g. Sellsword, Spellblade..."
                className={FIELD_CLASS}
              />"""

content = content.replace(bad_str, good_str)

with open('src/screens/NewGame.tsx', 'w') as f:
    f.write(content)
