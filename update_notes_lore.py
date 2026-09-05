with open('PROJECT_REVISION_NOTES.md', 'r') as f:
    content = f.read()

new_log_entry = """- **2026-09-05** — Lore-Accurate Fourth Wing Starter Template Adjustments (`src/data/starterTemplates.ts`, `src/lib/store.ts`):
  - **Violet Sorrengail Master Template**:
    - **Attributes**: Configured custom point distribution (`STR: 10`, `INT: 18`, `AGI: 14`) reflecting Violet's frail bone density & physical stature paired with an exceptional scribe intellect and swift dagger reflexes.
    - **Starter Skills**: Seeded lore-accurate abilities (*Poisoner's Edge*, *Anatomical Precision*, *Dagger Parry & Feint*).
    - **Identity Parameters**: Normalized gender (`F`), class archetype (`apprentice_scribe`), class title (`Apprentice Scribe`), physical traits (hypermobile joints, silver-tipped hair), secret (hidden boots with poison daggers and instructor flaw notes), and background history.
  - **Navarre World Master Template**:
    - **Structured Factions**: Added 5 lore-accurate factions (*Riders Quadrant*, *Scribe Quadrant*, *Navarre High Command*, *Poromiel Gryphon Fliers*, *Shadow Venin & Wyvern*) with territories, attitudes, and descriptions.
    - **World Systems**: Enriched background, power system (dragon signet magic & runic arrays), tech level, and narration style.
  - **Store Synchronization**: Updated `src/lib/store.ts` to preserve `factionsList`, `customAttributes`, and `startingSkills` on master template load.
"""

if "- **2026-09-05**" in content:
    content = content.replace("- **2026-09-05**", new_log_entry + "- **2026-09-05**", 1)
else:
    content = new_log_entry + content

with open('PROJECT_REVISION_NOTES.md', 'w') as f:
    f.write(content)
