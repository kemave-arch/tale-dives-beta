with open('PROJECT_REVISION_NOTES.md', 'r') as f:
    content = f.read()

new_log_entry = """- **2026-09-05** — Class Preset Button Removal (`src/screens/NewGame.tsx`):
  - Removed the browse/search button adjacent to the Archetype / Class input per focus mode request, allowing the text input to span the full width of its field.
"""

if "- **2026-09-05**" in content:
    content = content.replace("- **2026-09-05**", new_log_entry + "- **2026-09-05**", 1)
else:
    content = new_log_entry + content

with open('PROJECT_REVISION_NOTES.md', 'w') as f:
    f.write(content)
