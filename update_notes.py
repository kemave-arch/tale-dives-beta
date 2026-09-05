with open('PROJECT_REVISION_NOTES.md', 'r') as f:
    content = f.read()

new_log_entry = """- **2026-09-05** — Protagonist & World Setup Refactor, Attribute Table, Preset Relocation, and "DIVE IN" Loading Flow:
  - **Gender Enum Dropdown**: Converted Gender field in `NewGame.tsx` to a dropdown (`M`, `F`, `N/A`) aligned inline alongside the Archetype/Class input.
  - **Dense Attribute Table**: Refactored Attributes in `NewGame.tsx` into a compact 3-column table (`STR`, `INT`, `AGI`) with stacked ▲/▼ buttons and removed gain values below stat numbers to conserve vertical space.
  - **Compact Vitals**: Reduced vertical padding in Vitals, removed the "Shadow Referee Validated" text label, and cleaned up layout density.
  - **World Setup Cleanup**: Removed redundant "Genre & Tone" and "Core Regional Conflict" inputs from `WorldSetup.tsx`, updating the "World Background" hint to incorporate genre, tone, and conflict guidance directly into the main background prompt.
  - **Preset Action Row Relocation**: Moved the "Save Preset" and "Save as New Preset" buttons to the bottom of the scrollable form area in both `NewGame.tsx` and `WorldSetup.tsx`.
  - **"DIVE IN" Flow**: Renamed the "Start" CTA button in `TaleBrief.tsx` to "DIVE IN". Created `DiveLoadingScreen.tsx` (using `m_title-bg2.webp` on mobile and `pc_title-bg2.webp` on desktop). Updated `App.tsx` state machine to immediately switch soundtrack to `TempestDive_ost03.opus`, display `DiveLoadingScreen`, and transition to `storymode` (Story Viewer) as soon as the first LLM turn response arrives.
  - **Verification**: Verified via `compile_applet` (all TypeScript type checks and Vite build passed clean).
"""

# Find the start of the log entries
if "- **2026-09-05**" in content:
    content = content.replace("- **2026-09-05**", new_log_entry + "- **2026-09-05**", 1)
else:
    content = new_log_entry + content

with open('PROJECT_REVISION_NOTES.md', 'w') as f:
    f.write(content)
