# Tale Weaver Architecture & Phase Reference Guide (`TalesWeaveInfo.md`)

This document provides a concise, exhaustive specification of the **Tale Weaver** system in *Tale Dives* (`src/screens/TaleWeaver.tsx`, `src/lib/taleWeaving.ts`, `src/lib/taleWeaverParser.ts`, and `src/api/taleWeaverContract.ts`).

Tale Weaver is the guided multi-phase worldbuilding and campaign-authoring engine for Inspired Story Mode. It allows the player to iteratively co-author or AI-generate an entire story canvas across 7 distinct phases, preview and edit every field, attach AI-generated artwork, save/load reusable presets, and synthesize everything directly into a playable `Campaign` with initialized Codex registries.

---

## 1. Architectural Overview & Data Lifecycle

```
[Phase Stepper: 1 -> 7]
       │
       ▼
[User Guidance Input / AI Weave Request]
       │
       ▼
[Gemini API: buildTaleWeaverSystemInstructions + buildTaleWeaverPhasePrompt]
       │
       ▼
[XML Response: <tw_response><tw_world|hero|region|loc|faction|npc|lore|beat|event|stakes>...</tw_response>]
       │
       ▼
[Parser: parseTaleWeaverXmlResponse() -> TaleWeaverDraft]
       │
       ▼
[Accumulated State: TaleWeaverAccumulated (src/lib/taleWeaving.ts)]
       │
       ▼ (Manual Edits, Re-weaving, or Presets)
[Launch: onBeginTale(accumulated) in src/App.tsx]
       │
       ▼
[Synthesized Campaign, Player, WorldData, and Codex Registries]
```

### Key Modules
1. **`src/lib/taleWeaving.ts`**: Defines the phase configuration (`TALE_WEAVER_PHASES`), the accumulated draft state (`TaleWeaverAccumulated`), and preset persistence keys.
2. **`src/api/taleWeaverContract.ts`**: Defines the XML wire grammar (`TALE_WEAVER_GRAMMAR`) and prompt generation builders (`buildTaleWeaverPhasePrompt`).
3. **`src/lib/taleWeaverParser.ts`**: Parses the raw LLM XML stream into typed draft structures with fallback recovery.
4. **`src/screens/TaleWeaver.tsx`**: The glassmorphic 7-phase UI containing live field viewers, modal/inline editors, image generation controls, preset manager, and the Tale Overview modal.
5. **`src/App.tsx` (`beginInspiredTale`)**: Translates `TaleWeaverAccumulated` directly into runtime types (`Campaign`, `Player`, `WorldData`, `LocationEntry`, `FactionEntry`, `NpcEntry`, `LoreEntry`, `TaleBeat`, `NarrativeEvent`).

---

## 2. Detailed Phase Specifications

---

### Phase 1: World Foundation (`world`)

#### Purpose & Scope
Establishes the macro-universe: genre, tone, overarching background lore, central conflict, power systems, era/technology level, and optional canon source boundaries (for inspired adaptation tales).

#### LLM Wire Tags & References
- **Target Tag**: `<tw_world n="..." g="..." c="..." bg="..." pw="..." era="..." fac="..." st="..." sa="..." sc="..." />`
- **Context References Sent to LLM**: User-provided thematic prompt or selected archetype inspiration preset.
- **Draft Interface**: `TaleWeaverWorldDraft` stored in `accumulated.world`.

#### Known Input Fields, Labels & Codex Variable Mappings

| UI Section / Field Label | UI Input Control | Accumulator Variable (`TaleWeaverAccumulated`) | Target Codex / Campaign Field | Data Type | Notes & Codex Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **World Name** | Text Input | `world.name` | `Campaign.world.name` | `string` | World display name; saved to World Library |
| **Genre & Tone** | Text Input | `world.genreTone` | `Campaign.world.genreTone` | `string` | Pacing, atmosphere, and narrative mood guide |
| **Central Conflict** | Textarea | `world.conflict` | `Campaign.world.conflict` | `string` | Primary tension driving world events |
| **World Background / History** | Textarea | `world.background` | `Campaign.world.background` | `string` | Lore foundation; feeds campaign synopsis fallback |
| **Power System / Magic Rules** | Textarea | `world.powerSystem` | `Campaign.world.powerSystem` | `string` | Magic, technology, or superpower laws |
| **Era & Tech Level** | Text Input | `world.eraTechLevel` | `Campaign.world.eraTechLevel` | `string` | Historical / technological framing |
| **Key Factions Overview** | Textarea | `world.keyFactions` | `Campaign.world.keyFactions` | `string` | High-level summary of powers; informs Phase 4 |
| **Source Work Title** | Text Input | `world.sourceTitle` | `Campaign.world.sourceTitle` | `string` (optional) | Used for canon image generation & consistency |
| **Source Author / Creator** | Text Input | `world.sourceAuthor` | `Campaign.world.sourceAuthor` | `string` (optional) | Cited in canon image generation prompts |
| **Source Scope / Canon Boundary** | Text Input | `world.sourceScope` | `Campaign.world.sourceScope` | `string` (optional) | Limits the world to specific books/seasons |
| **Illustrate World Visual Style** | Image Generator Modal | `world.coverImageKey` | Client-side Image Store | `string` (Blob Key) | Stored in IndexedDB via `lib/imageStore.ts` |

---

### Phase 2: Protagonist (`protagonist`)

#### Purpose & Scope
Authors the player's persona: name, origin background, personality traits, core motivation, physical characteristics/flaws, secrets, and the opening scene narrative hook.

#### LLM Wire Tags & References
- **Target Tag**: `<tw_hero n="..." bg="..." per="..." mot="..." phys="..." sec="..." op="..." />`
- **Context References Sent to LLM**: Reads `accumulated.world` (`name`, `genreTone`, `powerSystem`, `sourceTitle`, etc.) as ground truth to ground the protagonist firmly within the established setting.
- **Draft Interface**: `TaleWeaverHeroDraft` stored in `accumulated.protagonist`.

#### Known Input Fields, Labels & Codex Variable Mappings

| UI Section / Field Label | UI Input Control | Accumulator Variable (`TaleWeaverAccumulated`) | Target Codex / Campaign Field | Data Type | Notes & Codex Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Character Name** | Text Input | `protagonist.name` | `Campaign.player.name` & `ProtagonistData.name` | `string` | Primary name; sets `Campaign.title` (`"${name}'s Tale"`) |
| **Background / History** | Textarea | `protagonist.background` | `Campaign.player.background` | `string` | Origin history preserved across chapter flushes |
| **Personality / Demeanor** | Text Input | `protagonist.personality` | `Campaign.player.personality` | `string` | Guides narrator's dialogue voice and tone |
| **Core Motivation / Drive** | Text Input | `protagonist.motivation` | `Campaign.player.motivation` | `string` | What the character actively desires or pursues |
| **Physical Trait / Flaw** | Text Input | `protagonist.physicalTrait` | `Campaign.player.physicalTrait` | `string` | Distinguishing physical trait or physical limitation |
| **Secret** | Text Input | `protagonist.secret` | `Campaign.player.secret` | `string` | Concealed truth narrator plants quiet hooks around |
| **Opening Scene / Hook** | Textarea | `protagonist.opening` | `ProtagonistData.opening` & `Campaign.synopsis` | `string` | Starting narrative beat; initializes Turn 1 prompt |
| **Illustrate Character Portrait**| Image Generator Modal | `protagonist.portraitKey` | Client-side Image Store | `string` (Blob Key) | Displayed on character sheet and chronicle |

---

### Phase 3: Regions & Locations (`places`)

#### Purpose & Scope
Builds the physical geography: overarching regions (with visual maps) and specific point-of-interest landmarks (cities, fortresses, ruins, dungeons, wilds) complete with normalized map coordinates, danger levels, and local sub-areas.

#### LLM Wire Tags & References
- **Target Tags**:
  - Region: `<tw_region id="..." n="..." d="..." />`
  - Location: `<tw_loc id="..." n="..." reg="..." t="..." dng="..." d="..." x="..." y="...">` containing `<tw_area n="..." d="..." />` children.
- **Context References Sent to LLM**: Grounded by `world` (setting, tone, scale) and `protagonist` (starting environment).
- **Draft Interfaces**: `TaleWeaverRegionDraft[]` in `accumulated.regions` and `TaleWeaverLocationDraft[]` in `accumulated.locations`.

#### Known Input Fields, Labels & Codex Variable Mappings

##### Regions (`accumulated.regions[]`)
| UI Section / Field Label | UI Input Control | Accumulator Variable | Target Codex / Campaign Field | Data Type | Notes & Codex Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Region Name** | Text Input | `region.name` | `Campaign.regions[id].name` | `string` | Named territorial grouping |
| **Region ID** | Auto / Text | `region.id` | `RegionEntry` Dictionary Key | `string` | Stable ID referenced by `location.regionId` |
| **Region Description** | Textarea | `region.desc` | `Campaign.regions[id].description` | `string` | Geographic & environmental overview |
| **Illustrate Region Map** | Image Generator Modal | `region.mapImageKey` | `Campaign.regions[id].mapImageKey` | `string` (Blob Key) | Top-down visual map rendered in Codex |

##### Locations (`accumulated.locations[]`)
| UI Section / Field Label | UI Input Control | Accumulator Variable | Target Codex / Campaign Field | Data Type | Notes & Codex Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Location Name** | Text Input | `location.name` | `Campaign.locations[id].name` | `string` | Point of interest name |
| **Location ID** | Auto / Text | `location.id` | `LocationEntry` Dictionary Key | `string` | Stable Codex ID |
| **Region** | Select Dropdown | `location.regionId` | `Campaign.locations[id].regionId` | `string` | Links location to its parent `RegionEntry` |
| **Location Type** | Select / Text | `location.locationType` | `Campaign.locations[id].locationType` | `LocationType` | e.g. Settlement, Fortress, Wilds, Dungeon, Ruins, Landmark |
| **Danger Rating** | Select Dropdown | `location.danger` | `Campaign.locations[id].dangerLevel` | `LocationDangerLevel` | Safe, Low, Moderate, High, Lethal |
| **Description** | Textarea | `location.desc` | `Campaign.locations[id].description` | `string` | Environmental description of the landmark |
| **Sub-Areas** | Form / Textarea | `location.areas` | `Campaign.locations[id].areas` | `AreaEntry[]` | Named zones within the location (`id`, `name`, `description`) |
| **Map Coordinates X / Y** | Number Inputs | `location.mapX`, `location.mapY` | `LocationEntry.mapX`, `LocationEntry.mapY` | `number` (0–100) | Normalized 2D coordinates for region map pins |
| **Illustrate Location** | Image Generator Modal | `location.imageKey` | `Campaign.locations[id].imageKey` | `string` (Blob Key) | Illustrated landscape / venue image |

---

### Phase 4: Factions & Powers (`factions`)

#### Purpose & Scope
Authors the political, military, religious, and economic organizations shaping world events, their territories, and their initial diplomatic standing toward the protagonist.

#### LLM Wire Tags & References
- **Target Tag**: `<tw_faction id="..." n="..." att="..." ter="..." d="..." />`
- **Context References Sent to LLM**: Grounded by `world` conflicts and existing `regions` / `locations`.
- **Draft Interface**: `TaleWeaverFactionDraft[]` stored in `accumulated.factions`.

#### Known Input Fields, Labels & Codex Variable Mappings

| UI Section / Field Label | UI Input Control | Accumulator Variable | Target Codex / Campaign Field | Data Type | Notes & Codex Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Faction Name** | Text Input | `faction.name` | `Campaign.factions[id].name` | `string` | Name of faction / organization |
| **Faction ID** | Auto / Text | `faction.id` | `FactionEntry` Dictionary Key | `string` | Stable Codex ID |
| **Starting Attitude** | Select Dropdown | `faction.attitude` | `Campaign.factions[id].repTier` & `tags` | `string` | Allied (+2), Friendly (+1), Neutral (0), Unfriendly (-1), Hostile (-2) |
| **Territory / Base of Power** | Text Input | `faction.territory` | `Campaign.factions[id].territory` | `string` | Associated region or stronghold |
| **Description / Agenda** | Textarea | `faction.desc` | `Campaign.factions[id].description` | `string` | Faction motives, structure, and ethos |

---

### Phase 5: Cast of Characters (`cast`)

#### Purpose & Scope
Generates the key NPCs of the tale: companions, rivals, patrons, mentors, and nemeses. Includes baseline narrative relationship tiers (Affection and Trust) that plug into the independent relationship ladders.

#### LLM Wire Tags & References
- **Target Tag**: `<tw_npc id="..." n="..." r="..." per="..." app="..." aff="..." tr="..." />`
- **Context References Sent to LLM**: Informed by `world`, `protagonist`, `factions`, and `places`.
- **Draft Interface**: `TaleWeaverNpcDraft[]` stored in `accumulated.npcs`.

#### Known Input Fields, Labels & Codex Variable Mappings

| UI Section / Field Label | UI Input Control | Accumulator Variable | Target Codex / Campaign Field | Data Type | Notes & Codex Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Character Name** | Text Input | `npc.name` | `Campaign.npcs[id].name` | `string` | Full name of NPC |
| **Character ID** | Auto / Text | `npc.id` | `NpcEntry` Dictionary Key | `string` | Stable Codex ID |
| **Role / Title** | Text Input | `npc.role` | `Campaign.npcs[id].role` | `string` | e.g. "Guildmaster", "Childhood Rival", "Court Sage" |
| **Personality / Demeanor** | Textarea | `npc.personality` | `Campaign.npcs[id].personality` | `string` | Behavioral cues and conversational habits |
| **Physical Appearance** | Textarea | `npc.appearance` | `Campaign.npcs[id].appearance` | `string` | Visual appearance; basis for portrait prompts |
| **Initial Affection Tier** | Select Dropdown | `npc.aff` | `Campaign.npcs[id].affection` | `CompetencyTier` (1–5) | Mapped via `AFFECTION_STAGES` (`Cold` → `Devoted`) |
| **Initial Trust Tier** | Select Dropdown | `npc.trust` | `Campaign.npcs[id].trust` | `CompetencyTier` (1–5) | Mapped via `TRUST_WORDS` (`Suspicious` → `Unshakable`) |
| **Illustrate Portrait** | Image Generator Modal | `npc.portraitKey` | `Campaign.npcs[id].portraitKey` | `string` (Blob Key) | Square portrait in NPC dossier |

---

### Phase 6: Lore & Secrets (`lore`)

#### Purpose & Scope
Creates world lore entries across categories (Magic, History, Myth, Creatures, Artifacts, Secrets). Supports concealment gating: entries can be flagged as hidden secrets with teaser clues until uncovered through gameplay.

#### LLM Wire Tags & References
- **Target Tag**: `<tw_lore id="..." n="..." cat="..." era="..." hid="true|false" tea="..." d="..." />`
- **Context References Sent to LLM**: Grounded by `world` power systems and historical conflicts.
- **Draft Interface**: `TaleWeaverLoreDraft[]` stored in `accumulated.lore`.

#### Known Input Fields, Labels & Codex Variable Mappings

| UI Section / Field Label | UI Input Control | Accumulator Variable | Target Codex / Campaign Field | Data Type | Notes & Codex Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Topic / Entry Name** | Text Input | `lore.name` | `Campaign.lore[id].name` | `string` | Lore subject name |
| **Lore ID** | Auto / Text | `lore.id` | `LoreEntry` Dictionary Key | `string` | Stable Codex ID |
| **Category** | Select / Text | `lore.category` | `Campaign.lore[id].category` | `string` | General, History, Magic, Myth, Artifact, Secret, Creature |
| **Era / Time Period** | Text Input | `lore.era` | `Campaign.lore[id].era` | `string` | e.g. "Ancient Era", "Age of Ruin", "Present Day" |
| **Lore Description / Content** | Textarea | `lore.content` | `Campaign.lore[id].content` | `string` | Full body text revealed in Codex |
| **Hidden / Secret Toggle** | Checkbox / Toggle | `lore.hidden` | `Campaign.lore[id].discovery.state` | `boolean` / `'hidden'` | Conceals entry until triggered in-game |
| **Discovery Teaser** | Textarea | `lore.teaser` | `Campaign.lore[id].discovery.teaser` | `string` | Gated clue displayed while entry remains hidden |

---

### Phase 7: Story Arc, Events & Stakes (`arc`)

#### Purpose & Scope
Structures the narrative trajectory and outcome parameters:
1. **Pre-Authored Story Beats (`beats`)**: The sequential main quest spine.
2. **Narrative Events (`narrativeEvents`)**: Reactive complication scenes triggered by player actions (visiting places, meeting NPCs, flags, quest completion).
3. **Death & Ending Stakes (`stakes`)**: Permadeath vs. Soft Fail recovery rules and outcome guidance for Victory, Defeat, and Bittersweet endings.

#### LLM Wire Tags & References
- **Target Tags**:
  - Story Beat: `<tw_beat id="..." t="..." sum="..." />`
  - Narrative Event: `<tw_event id="..." t="..." trig="..." cond="..." guid="..." />`
  - Stakes & Endings: `<tw_stakes death="soft_fail|permadeath" di="..." win="..." lose="..." neu="..." />`
- **Context References Sent to LLM**: Slices all previous phases (World, Protagonist, Factions, Places, Cast, Lore) to weave an interconnected dramatic arc.
- **Draft Interfaces**:
  - `accumulated.beats: TaleWeaverBeatDraft[]`
  - `accumulated.narrativeEvents: TaleWeaverNarrativeEventDraft[]`
  - `accumulated.deathRule?: 'soft_fail' | 'permadeath'`
  - `accumulated.deathInstructions?: string`
  - `accumulated.endGameRules?: { win?: string; lose?: string; neutral?: string }`

#### Known Input Fields, Labels & Codex Variable Mappings

##### Section A: Main Story Beats (`accumulated.beats[]`)
| UI Section / Field Label | UI Input Control | Accumulator Variable | Target Codex / Campaign Field | Data Type | Notes & Codex Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Beat Title** | Text Input | `beat.title` | `Campaign.beats[i].title` | `string` | Stage title sent to LLM turn context |
| **Beat ID** | Auto / Text | `beat.id` | `Campaign.beats[i].id` | `string` | Stable beat ID |
| **Beat Objective / Summary** | Textarea | `beat.summary` | `Campaign.beats[i].summary` | `string` | Spoiler-bearing goal revealed when beat is active |
| **Initial Status** | System Default | *(None)* | `Campaign.beats[i].status` | `'pending'` | Advanced sequentially by the Narrator LLM |

##### Section B: Narrative Events (`accumulated.narrativeEvents[]`)
| UI Section / Field Label | UI Input Control | Accumulator Variable | Target Codex / Campaign Field | Data Type | Notes & Codex Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Event Title** | Text Input | `event.title` | `Campaign.narrativeEvents[id].title` | `string` | Event descriptor |
| **Event ID** | Auto / Text | `event.id` | `Campaign.narrativeEvents[id].id` | `string` | Stable dictionary key |
| **Trigger Type** | Select Dropdown | `event.trigger` | `NarrativeEvent.trigger` | `RevealTrigger` | `story`, `location_visit`, `npc_met`, `quest_complete`, `flag`, `manual` |
| **Activation Condition** | Text Input | `event.condition` | `NarrativeEvent.condition` | `string` | Specific flag name, location ID, or NPC ID |
| **Narrator Guidance** | Textarea | `event.guidance` | `NarrativeEvent.guidance` | `string` | Prose steering instructions applied when triggered |
| **Initial Status** | System Default | *(None)* | `NarrativeEvent.status` | `'dormant'` | Evaluated client-side every turn at 0 LLM cost |

##### Section C: Death & End Game Stakes (`accumulated.deathRule`, `endGameRules`)
| UI Section / Field Label | UI Input Control | Accumulator Variable | Target Codex / Campaign Field | Data Type | Notes & Codex Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Death Rule** | Select Dropdown | `accumulated.deathRule` | `Campaign.deathRule` | `'soft_fail'` \| `'permadeath'` | `soft_fail` auto-chains recovery; `permadeath` ends game |
| **Death / Defeat Instructions** | Text Input | `accumulated.deathInstructions`| `Campaign.deathInstructions` | `string` | Steering prose for defeat scene narration |
| **Victory Guidance (Win)** | Text Input | `accumulated.endGameRules.win` | `Campaign.endGameRules.win` | `string` | Narration guidance for glorious victory |
| **Defeat Guidance (Lose)** | Text Input | `accumulated.endGameRules.lose`| `Campaign.endGameRules.lose` | `string` | Narration guidance for tragic loss |
| **Bittersweet Guidance (Neutral)**| Text Input | `accumulated.endGameRules.neutral`| `Campaign.endGameRules.neutral`| `string` | Narration guidance for complex / pyrrhic ending |

---

## 3. Campaign Synthesis & Codex Initialization (`beginInspiredTale`)

When the player clicks **Dive In** from the Tale Overview modal, `onBeginTale(accumulated)` is invoked in `src/App.tsx`. The synthesis executes the following pipeline:

1. **Protagonist Initialization**:
   - `accumulated.protagonist` is mapped to `ProtagonistData` and `Player`.
   - `Player.attrs` are initialized to baseline `{ STR: 3, INT: 3, AGI: 3 }`.
   - `Player.copper` is set to standard starting wealth (`10,000` base copper = 1 gold).
   - `Player.conditions` is initialized to `[]` (narrative conditions engine).
   - Persisted into Protagonist Library via `upsertProtagonist`.
2. **World Initialization**:
   - `accumulated.world` is mapped to `WorldData` with `mode: 'inspired'`.
   - Persisted into World Library via `upsertWorld`.
3. **Places Codex**:
   - `accumulated.regions` becomes `Campaign.regions: Dict<RegionEntry>`.
   - `accumulated.locations` becomes `Campaign.locations: Dict<LocationEntry>`.
   - Each location is registered as `discovery: { state: 'known' }`, `standing: 'neutral'`. Sub-areas are parsed into `AreaEntry[]`.
4. **Factions Codex**:
   - `accumulated.factions` becomes `Campaign.factions: Dict<FactionEntry>`.
   - Faction attitudes are converted to canonical `repTier` integers (-2 to +2).
5. **NPCs Codex**:
   - `accumulated.npcs` becomes `Campaign.npcs: Dict<NpcEntry>`.
   - Affection and Trust words are parsed into `CompetencyTier` (1–5) on independent ladders.
   - `stage` is initialized to `'Stranger'`, `deeds` to `[]`, `memSummary` to `''`.
6. **Lore Codex**:
   - `accumulated.lore` becomes `Campaign.lore: Dict<LoreEntry>`.
   - Hidden entries are initialized with `discovery: { state: 'hidden', revealTrigger: 'manual', teaser: l.teaser }`.
7. **Story Arc & Stakes**:
   - `accumulated.beats` becomes `Campaign.beats: TaleBeat[]` (`status: 'pending'`).
   - `accumulated.narrativeEvents` becomes `Campaign.narrativeEvents: Dict<NarrativeEvent>` (`status: 'dormant'`).
   - `deathRule`, `deathInstructions`, and `endGameRules` are attached directly to `Campaign`.
8. **Campaign Launch**:
   - Constructs `Campaign` (schema version `CURRENT_SCHEMA_VERSION = 2`), saves to active storage via `store.saveCampaign()`, and transitions player into the game canvas.

---

## 4. Reusable Draft Preset Engine

Tale Weaver includes a client-side draft preset engine allowing users to snapshot and restore full setups:
- **Persistence Key**: LocalStorage `tale_weaver_presets_v1` (`TaleWeaverPreset[]`).
- **Data Model**:
  ```ts
  interface TaleWeaverPreset {
    id: string
    name: string
    createdAt: number
    accumulated: TaleWeaverAccumulated
  }
  ```
- **UI Actions**:
  - **Save Preset**: Available in Tale Overview modal; snapshots all 7 phases with a custom title.
  - **Load Preset**: Restores full `TaleWeaverAccumulated` state and updates UI stepper indicators.
  - **Delete Preset**: Removes entry from LocalStorage.

---

## 5. Visual Asset Generation Reference

Tale Weaver integrates directly with `TaleWeaverImageGenerator` (`lib/imageStore.ts` and `lib/imageGeneration.ts`):
- **Aspect Ratios**:
  - World Cover: `16:9`
  - Region Maps: `4:3`
  - Location Landscapes: `9:16`
  - Character Portraits (Hero & NPCs): `1:1`
- **Canon Steering**: If `sourceTitle` or `sourceScope` is present, image generation prompts append canon grounding citations to prevent visual drift.
- **Storage**: Binary WebP blobs are stored locally in IndexedDB; only lightweight stable keys (`world.coverImageKey`, `r.mapImageKey`, `l.imageKey`, `n.portraitKey`) are held in state.
