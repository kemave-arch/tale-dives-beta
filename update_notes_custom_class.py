with open('PROJECT_REVISION_NOTES.md', 'r') as f:
    content = f.read()

new_log_entry = """- **2026-09-05** — Archetype / Class Enum Dropdown & Custom Class Setup Modal (`src/screens/NewGame.tsx`):
  - **Archetype/Class Enum Dropdown**: Restored Archetype/Class as a standard `<select>` dropdown populated with all preset class archetypes (Warrior, Mage, Assassin, Paladin, Necromancer, etc.) plus a "Custom Class..." option.
  - **Custom Class Modal**: Selecting "Custom Class..." opens a modal prompting for:
    1. Custom Class Name (text input).
    2. Base Archetype (Stat Curve) dropdown (selecting from the preset class enum values).
  - **Vitals Curve Integration**: Sets `classId` to the chosen base archetype (supplying the vitals/attribute weight curve under the hood) while setting `className` to the user's custom class name. An adjacent "Edit" button allows re-configuring custom class details at any point.
  - **Verification**: Verified clean TypeScript compilation (`compile_applet`).
"""

if "- **2026-09-05**" in content:
    content = content.replace("- **2026-09-05**", new_log_entry + "- **2026-09-05**", 1)
else:
    content = new_log_entry + content

with open('PROJECT_REVISION_NOTES.md', 'w') as f:
    f.write(content)
