with open('PROJECT_REVISION_NOTES.md', 'r') as f:
    content = f.read()

new_log_entry = """- **2026-09-05** — Violet Sorrengail Template Adjustments (`src/data/starterTemplates.ts`, `src/screens/NewGame.tsx`):
  - Updated preset protagonist Violet Sorrengail's starter template to map to the new field formats (`gender: 'F'`, `classId: 'apprentice_scribe'`, `className: 'Apprentice Scribe'`).
  - Updated `NewGame.tsx` state initialization to normalize legacy gender values (`Female` / `Male`) to the dropdown options (`F` / `M`).
"""

if "- **2026-09-05**" in content:
    content = content.replace("- **2026-09-05**", new_log_entry + "- **2026-09-05**", 1)
else:
    content = new_log_entry + content

with open('PROJECT_REVISION_NOTES.md', 'w') as f:
    f.write(content)
