# ImagePromptTest: Tale Dives Image Generation Guide

Welcome! This guide breaks down how image generation works in **Tale Dives**, which parts of the game own images, the exact prompts used under the hood, and how game data turns into final AI art prompts.

---

## 1. Automatic Image Generation Policy: LOCKED DOWN 🔒

> **Current Policy:** Automatic image generation is **completely disabled** across all game phases and story turns (`AUTOMATIC_IMAGE_GENERATION_ENABLED = false`).
> 
> Images are **NEVER** generated silently in the background when you weave phases, advance turns, meet an NPC, or enter a new location.
> 
> **Only manual actions are allowed:** Image generation ONLY runs when a player explicitly clicks:
> 1. **"Weave Portrait" / "Weave Image" / "Weave Map"**
> 2. **"Confirm & Weave"** (Standard Gemini key)
> 3. **"Premium"** (Paid Champagne Gold key)

---

## 2. The 3 Game Aspects That Own Generated Images

There are **3 types of game entities** that can have their own generated illustrations:

| Game Aspect | Image Type | Where It Appears in Game | Stored In Field | Aspect Ratio |
| :--- | :--- | :--- | :--- | :--- |
| **1. Characters (NPCs & Protagonist)** | Character Portrait | Codex NPC list, Tale Weaver Phase 2 (Hero) & Phase 5 (Cast), and dialogue portrait chips in Story Mode. | `portraitKey` | `1:1` (Square, waist-up portrait) |
| **2. Locations** | Environmental Concept Art | Codex Locations tab, Tale Weaver Phase 3 (Places), and location backdrop/popup card in Story Mode. | `imageKey` | `16:9` (Widescreen landscape) |
| **3. Regions** | Regional Map | Codex Regions tab, Tale Weaver Phase 3 (Places). | `mapImageKey` | `16:9` (Widescreen map view) |

---

## 3. The Prompts & Related Fields

All prompt builders live in `src/lib/imageGeneration.ts`.

### Shared Foundation: The World Directive
Every image prompt pulls background context from the game's **World Foundation** (set in Tale Weaver Phase 1 or World Setup).

**Related World Fields:**
- `world.genreTone`: The overall atmosphere (e.g., *"Dark gothic fantasy, gritty, brooding"*).
- `world.eraTechLevel`: The technological era (e.g., *"Late medieval with early alchemy, iron and timber"*).
- `world.powerSystem`: How magic or power works (e.g., *"Blood-oaths and glowing rune carving"*).

When combined into the prompt, it produces a single line:
```
tone: <genreTone>; technology/era: <eraTechLevel>; power system: <powerSystem>
```
*(If no world data exists yet, it safely falls back to "an original fictional setting".)*

---

### Aspect 1: Character Portraits (`buildNpcPortraitPrompt`)

#### Related Fields:
- **`name`** (from `npc.name` or `protagonist.name`): Character's name.
- **`role`** (from `npc.role` or `protagonist.drive`): Function or profession (e.g., *"Disgraced Royal Guard"*, *"Hedge Witch"*).
- **`appearance`** (from `npc.appearance` or `protagonist.appearance`): Physical look, clothing, scars, eyes, hair, equipment.
- **`world`**: The World Directive described above.

#### Exact Prompt Template:
```text
Create a single character portrait illustration for the RPG character "${name}".

World:
${style || "an original fictional setting"}

Role:
${role || "important RPG character"}

Appearance:
${appearance || "Create a distinctive original character with memorable visual identity."}

Character presentation:
- Waist-up portrait.
- Character is the clear focal point.
- Keep facial features, hairstyle, clothing, accessories, and silhouette clearly readable.
- Give the character a strong personality and presence.
- Use a simple atmospheric background that supports the character without distracting from them.
- Preserve coherent anatomy and believable proportions.
- Clothing and equipment should fit the stated world, era, role, and power system.

Art direction:
High-quality RPG character concept art,
cinematic lighting, polished illustration,
expressive face, strong silhouette.

Do not place readable text, labels, or logos in the artwork. No nameplates, UI, borders, or decorative interface elements.
```

---

### Aspect 2: Location Concept Art (`buildLocationImagePrompt`)

#### Related Fields:
- **`name`** (from `location.name`): Place name (e.g., *"The Sunken Bell Tower"*).
- **`description`** (from `location.description`): Physical architecture, lighting, weather, geography, and mood.
- **`world`**: The World Directive.

#### Exact Prompt Template:
```text
Create a single high-quality environmental illustration for the RPG location "${name}".

World:
${style || "an original fictional setting"}

Location:
${description || "A distinctive and memorable location with a strong sense of place."}

Composition:
- Focus primarily on the environment and architecture.
- Establish clear foreground, middle ground, and background.
- Make the location visually distinctive and immediately recognizable.
- Use lighting, atmosphere, weather, terrain, and environmental storytelling appropriate to the world.
- Avoid generic stock scenery.

Art direction:
Cinematic RPG concept art, polished game illustration,
strong composition, cohesive color and lighting,
detailed environment.

Do not place readable text, labels, or logos in the artwork. No UI, captions, borders, or decorative interface elements.
```

---

### Aspect 3: Regional Maps (`buildRegionMapPrompt`)

#### Related Fields:
- **`name`** (from `region.name`): Region name (e.g., *"The Mistveil Marches"*).
- **`description`** (from `region.description`): Terrain overview, geography, and travel hazards.
- **`locationNames`** (gathered automatically from all locations belonging to this region): A comma-separated list of child landmarks.
- **`world`**: The World Directive.

#### Exact Prompt Template:
```text
Create a top-down illustrated regional map for the RPG region "${name}".

World:
${style || "an original fictional setting"}

Region:
${description || "A distinctive region with varied terrain, settlements, and landmarks."}

Required locations:
${locations}

Map design:
- Top-down geographic composition.
- Clearly distinguish terrain, settlements, roads, rivers, mountains, forests, ruins, coastlines, and other appropriate features.
- Each required location should have a visually distinct landmark or geographic feature.
- Keep the geography coherent and believable.
- Make the map readable as a game-world exploration map.
- Use an elegant illustrated RPG map aesthetic appropriate to the world.

Important:
Do not generate readable text labels.
Do not create a legend.
Do not create UI panels.
Do not add decorative borders.
Do not add a title.
```

---

## 4. Three Real Examples: How Prompts Get Built

Here are 3 concrete examples showing how actual in-game data gets transformed into the exact text sent to Gemini.

---

### Example 1: Character Portrait (NPC)

#### In-Game Data:
- **Name:** `Lady Vivienne Vance`
- **Role:** `Spymistress of the Gilded Crow`
- **Appearance:** `Mid-thirties, piercing amber eyes, raven hair pinned with silver needles, wearing high-collared charcoal velvet travel robes trimmed with dark fur and hidden dagger sheaths.`
- **World Foundation:**
  - `genreTone`: *Gothic political fantasy, paranoid, candlelit intrigue*
  - `eraTechLevel`: *Late medieval Renaissance with alchemy*
  - `powerSystem`: *Whisper-craft and subtle poison brewing*

#### Generated Final AI Prompt Sent to Gemini:
```text
Create a single character portrait illustration for the RPG character "Lady Vivienne Vance".

World:
tone: Gothic political fantasy, paranoid, candlelit intrigue; technology/era: Late medieval Renaissance with alchemy; power system: Whisper-craft and subtle poison brewing

Role:
Spymistress of the Gilded Crow

Appearance:
Mid-thirties, piercing amber eyes, raven hair pinned with silver needles, wearing high-collared charcoal velvet travel robes trimmed with dark fur and hidden dagger sheaths.

Character presentation:
- Waist-up portrait.
- Character is the clear focal point.
- Keep facial features, hairstyle, clothing, accessories, and silhouette clearly readable.
- Give the character a strong personality and presence.
- Use a simple atmospheric background that supports the character without distracting from them.
- Preserve coherent anatomy and believable proportions.
- Clothing and equipment should fit the stated world, era, role, and power system.

Art direction:
High-quality RPG character concept art,
cinematic lighting, polished illustration,
expressive face, strong silhouette.

Do not place readable text, labels, or logos in the artwork. No nameplates, UI, borders, or decorative interface elements.
```

---

### Example 2: Location Environment

#### In-Game Data:
- **Name:** `The Sunken Bell Tower of Oakhaven`
- **Description:** `A partially submerged ancient stone bell tower rising from stagnant black marshwaters. Glowing green witch-moss clings to cracked masonry, with dead willow trees and morning fog obscuring the horizon.`
- **World Foundation:**
  - `genreTone`: *Dark, melancholic folklore fantasy*
  - `eraTechLevel`: *Early medieval iron age*
  - `powerSystem`: *Ancient lingering nature spirits*

#### Generated Final AI Prompt Sent to Gemini:
```text
Create a single high-quality environmental illustration for the RPG location "The Sunken Bell Tower of Oakhaven".

World:
tone: Dark, melancholic folklore fantasy; technology/era: Early medieval iron age; power system: Ancient lingering nature spirits

Location:
A partially submerged ancient stone bell tower rising from stagnant black marshwaters. Glowing green witch-moss clings to cracked masonry, with dead willow trees and morning fog obscuring the horizon.

Composition:
- Focus primarily on the environment and architecture.
- Establish clear foreground, middle ground, and background.
- Make the location visually distinctive and immediately recognizable.
- Use lighting, atmosphere, weather, terrain, and environmental storytelling appropriate to the world.
- Avoid generic stock scenery.

Art direction:
Cinematic RPG concept art, polished game illustration,
strong composition, cohesive color and lighting,
detailed environment.

Do not place readable text, labels, or logos in the artwork. No UI, captions, borders, or decorative interface elements.
```

---

### Example 3: Regional Map

#### In-Game Data:
- **Name:** `The Weeping Reach`
- **Description:** `A desolate lowland river delta dominated by tidal marshes, crumbling limestone sea-cliffs, and dense pine barrens prone to sudden sea squalls.`
- **Locations in this region:** `["Fort Daggerpoint", "The Sunken Bell Tower of Oakhaven", "Blackmoss Crossing"]`
- **World Foundation:**
  - `genreTone`: *Dark maritime fantasy*
  - `eraTechLevel`: *Age of Sail / Late Medieval*
  - `powerSystem`: *Tidal sorcery*

#### Generated Final AI Prompt Sent to Gemini:
```text
Create a top-down illustrated regional map for the RPG region "The Weeping Reach".

World:
tone: Dark maritime fantasy; technology/era: Age of Sail / Late Medieval; power system: Tidal sorcery

Region:
A desolate lowland river delta dominated by tidal marshes, crumbling limestone sea-cliffs, and dense pine barrens prone to sudden sea squalls.

Required locations:
Fort Daggerpoint, The Sunken Bell Tower of Oakhaven, Blackmoss Crossing

Map design:
- Top-down geographic composition.
- Clearly distinguish terrain, settlements, roads, rivers, mountains, forests, ruins, coastlines, and other appropriate features.
- Each required location should have a visually distinct landmark or geographic feature.
- Keep the geography coherent and believable.
- Make the map readable as a game-world exploration map.
- Use an elegant illustrated RPG map aesthetic appropriate to the world.

Important:
Do not generate readable text labels.
Do not create a legend.
Do not create UI panels.
Do not add decorative borders.
Do not add a title.
```

---

## 5. Technical Details for Customizing & Improving Prompts

- **The Active Model:** `gemini-3.1-flash-lite-image` (via `@google/genai` SDK using `responseModalities: ["IMAGE"]`).
- **Prompt Preview in UI:** Whenever you click an image button in Tale Weaver or Codex, the app automatically opens the prompt editor with the full constructed text so you can tweak words or style tags before generating!
- **Idea Starters for Future Improvements:**
  - Lighting keywords: *"chiaroscuro lighting"*, *"volumetric god-rays"*, *"dramatic rim light"*.
  - Rendering styles: *"painterly concept art"*, *"oil painting on canvas"*, *"gritty graphic novel"*.
  - Color palettes: *"muted desaturated tones with vibrant gold highlights"*.
  - Camera angles: *"low-angle heroic shot"* (for warriors) or *"eye-level portrait"*.
