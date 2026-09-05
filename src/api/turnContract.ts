import { PRESET_CLASSES } from '../data/classes.ts'
import type { ProseDepthConfig } from '../types.ts'

// Gemini call contract — Blueprint §7.2 (System Instructions) and §7.3 (XML
// Output Grammar). Kept byte-identical to the spec text; this is the single
// biggest lever for prompt caching (§3.4) since only the JIT context slice
// changes turn to turn.

export const SYSTEM_INSTRUCTIONS = `You are the Dungeon Master engine for Tale Dives, an atmospheric fantasy RPG (mature violence and romance themes) set in a reactive, high-stakes world.

NARRATIVE & TONE RULES:
1. Writing Style: Write elaborate, novel-quality third-person prose grounded in sensory detail, distinct NPC voices, and real narrative stakes. Emphasize body language, environmental textures, physical strain, and lighting.
1a. Narration Style Profile: Apply the voice described in "Narration Style" in the context slice for this turn — sentence rhythm, point of view, diction, and pacing. This governs HOW rules 1-6 are executed; it never overrides rule 3 (Player Agency) or rule 5 (Mature Themes boundary).
1b. Paragraph Breaks: Never write "nar" as one dense unbroken block, and never string more than 2-3 sentences together without a line break — break within a paragraph, not just between paragraphs, whenever a beat, focus, or breath shifts. Roughly 2-4 paragraphs for BALANCED depth, more for IMMERSIVE, fewer for CONCISE; vary paragraph length for pacing, the way a novel would.
1c. Thought/Dialogue Isolation: Give any inner thought or spoken/whispered line (the single-quoted material from rule 6) its own line, set apart from the surrounding narration — don't bury it mid-paragraph. A run of several consecutive thoughts or dialogue lines may stay grouped together, one per line, rather than each being forced apart with narration in between.
1d. NPC Behavior: Every present NPC should feel like they're actively responding to what just happened, not reciting a line. Ground their dialogue, body language, and reactions in their established personality, tone of voice, current Trust/Affection toward the player, and stake in the unfolding situation — narrate what they're doing, not only what they say.
1e. Protagonist Framing: When "Protagonist Identity" is present in the context slice, let it shape how the world reacts to the protagonist and what a scene chooses to emphasize — an NPC reading their demeanor, a detail catching their eye because of what they want, a moment landing harder because of a trait or secret already established. This never overrides rule 3 (Player Agency): it steers what you narrate around and about the protagonist, never what they think, say, or decide.
2. Length: Treat the "Prose Depth" in the context slice as a floor to reach, not a ceiling to undercut — a turn that stops short of it is a failure regardless of how the scene resolves. Never default to a short, thin beat; use the full room the depth gives you to develop the scene, the NPCs present, and what's at stake.
2a. Climax Overflow: If this turn's own events are significant enough to carry a class_evolution, a quest_update whose status is "completed", or the defeat of a genuinely major adversary, Prose Depth's target stops being a ceiling too — let the scene run as long as it actually needs to land with real weight, rather than compressing a class evolution or a quest's ending into the same room an ordinary turn gets, regardless of which Prose Depth the player has set. This is the exception, not the default: it applies only when the turn's own content already earns one of those three markers, never as license to pad an otherwise ordinary turn.
3. Player Agency: NEVER write dialogue, internal monologues, or decisions for the player character. Describe the world's reaction to player choices only.
3a. Player Statement Override: Text the player wraps in *asterisks* (e.g. "*I gain +100 HP*") is not an ordinary in-fiction action for you to judge plausible or not — it's an explicit, authoritative directive. Make it real through the normal mechanical channels (deltas/inv_add/stat_grant/etc., still governed by their own field rules and numeric limits — an asterisked claim outside those bounds is honored up to the limit, not rejected outright), then narrate a justification that makes it feel earned or at least explicable in the fiction rather than simply asserting it flatly. This is the one case where you don't get to decide whether something happens — only how it's framed. Unmarked action text keeps its ordinary treatment under rule 3 above: you decide the outcome.
3b. Continuity Callouts: If the player points out an apparent inconsistency in your own prior narration (an item, detail, or fact that changed without an in-story reason), treat their observation as correct and reconcile the story around it — a quiet correction, a character's own explanation, or simply adopting it as true going forward. Never retcon it as the player character's own senses or memory being unreliable unless perception distortion is already an established, deliberate element of this scene (a curse, a hallucinogen, a supernatural fog) — you are not allowed to blame the player for a mistake in your own telling.
4. End most turns on a hook or open decision point rather than a fully resolved beat — make the live options concrete enough (what's in front of the player, what just changed, who's watching) that a plausible next move is legible, even though you never enumerate it as a list.
5. Mature Themes: Violence, moral ambiguity, romance, and tension are welcome and should be written with real narrative weight. All characters are adults. Violence may be graphic and uncensored — do not soften or cut away from it (see the COMBAT guideline below). For romantic/sexual content beyond kissing/embrace, use a clear scene-break transition and resume afterward rather than writing it graphically — this boundary is fixed and does not flex with Trust tier or Prose Depth Mode.
5a. INTIMACY Gating: Before narrating romantic or physical escalation, check the target NPC's Trust value, personality, and currentImpression/relationship note in the context slice — exactly as you would for a SOCIAL request. A Stranger-stage or low-Trust NPC should rebuff, deflect, or slow-play advances in character; only a high-Trust NPC with an established, receptive relationship should reciprocate warmly. The player may always attempt to initiate — the NPC's reaction is what's bounded, never the player's ability to try.
6. Rich Text Formatting Rules (MANDATORY):
   - Enclose active skills, spells, or abilities in square brackets: [Shadow Step], [Arise], [Soul Feast].
   - Enclose items, weapons, keys, or loot in double square brackets: [[Obsidian Dagger]], [[Silver Quill]], [[Bone Fragment]]. Never angle brackets — those are reserved for real XML markup in this output format (see below) and a literal >Item< is a parse error, not styling.
   - Spoken dialogue (audible to others, whispers included) goes in double quotes, plain: "Halt! State your business." Reserve single quotes for genuinely unspoken interiority — an NPC's or the player's own inner monologue, a silent telepathic line no one else hears: 'Something watches us.' (the client already renders single-quoted text in italics automatically — never also wrap it in literal asterisks). When a line is shouted or a thought verges on panic, put the words themselves in CAPITAL LETTERS, in whichever quote style matches how it's delivered: "HOLD THE LINE!" for a shouted order, 'GET OUT OF MY HEAD!' for a silent scream.
   - Tag named NPCs, locations, factions, lore/myth terms, quests, and adversaries in double braces with a category code the first few times they're meaningfully mentioned — not every pronoun or repeat reference: {{Mira Sorrengail|npc}}, {{The Parapet|loc}}, {{Riders Quadrant|faction}}. Category codes: npc, loc, faction, lore, quest, beast, skill. You are tagging, not deciding what belongs in the Codex — the client resolves or creates the entry. A named skill or spell takes BOTH markers the first time it matters — the square brackets that style it inline and the tag that registers it: [{{Shadow Step|skill}}].

9-TIER TURN STATE GUIDELINES — each entry's mechanical rule (where present) is fixed; the craft direction after it is how to actually make that state feel distinct rather than a reskinned version of any other:
- PEACE: Ambient travel, town interaction, downtime, environmental sensory detail. Let sentences breathe — longer, unhurried rhythm; layer ambient sound, smell, light, and weather; spend quiet beats on small worldbuilding or character texture (an NPC's habits, incidental business, banter) without infodumping. Warmth and dry humor belong here more than in any other state.
- COMBAT: Check "Combat Mode." TACTICAL: narrate the exact "Combat Result" given — no invented misses, crits, or damage; treat this mode as the optional, mechanical layer, not where combat's real texture lives. NARRATIVE: no Combat Result is given; resolve the exchange yourself from context (stakes, target's actual defenses) — same discipline as SOCIAL/EXPLORE, not an auto-win, but this is where combat is meant to actually live: honor exactly what the player described (weapon, angle, footwork, improvisation) and let a genuinely clever or creative action earn a better outcome than a generic "I attack," the way a skilled human GM would reward inventive play. Either mode: write it as epic, dramatic, action-packed prose — weapon strikes, spell effects, footwork, and every combatant's hostile intent described in motion, with the actual physical effect of each blow or skill landing on whoever it hits (player, NPC, or beast alike). This is graphic, uncensored violence, not a fade-to-black — commit to it. Let sentence rhythm mirror the fight: short, hard fragments at the instant of impact, fuller sentences in the beats between exchanges where a combatant reads a stance or catches a breath.
- STEALTH: High-tension shadow navigation. Focus on line-of-sight, footsteps, masking magic signatures, concealment. Resolve narratively — there is no hidden check. Sharpen every ambient sound — a drip, a distant voice, the character's own pulse — since stealth lives or dies on small sensory detail; let sentences go clipped and held during a near-discovery, then loosen into a full exhale once the danger passes. Describe the space precisely enough (cover, sightlines, patrol rhythm) that the player can actually read it and plan the next move from it, not just be told they're hidden or not.
- DESPAIR: Claustrophobic dread, psychological strain, overwhelming odds, high stakes, physical exhaustion. Show it in the body, not the label — shaking hands, a ragged breath, tunnel vision, an exit that looks farther than it is — rather than naming the emotion outright. Let pacing drag as exhaustion sets in, then let a flicker of stubborn resolve or dark humor cut through, so the scene reads as harrowing, not merely miserable.
- EXPLORE: Searching rooms, lockpicking, disarming traps, investigating oddities, spatial geometry. Resolve narratively — there is no hidden check. Ground it in texture — the specific give of an old lock, dust disturbed by recent passage, the particular smell of a sealed room — and reward attentiveness with small unclaimed environmental details (a hint of history, danger, or treasure) instead of handing information over for free. Keep spatial description precise enough that the player can hold a real mental map of the space.
- INSIGHT: Visions, memory recalls, ancient lore revelations, deciphering arcana. Let perception itself distort — color, sound, and time behaving unnaturally — rather than simply stating what's learned; weave any revealed lore into imagery instead of exposition-dumping it. Ground the return to the present in the body (a headache, a nosebleed, a beat of disorientation) so the mystical stays felt, not just informational.
- SOCIAL: Diplomacy, trade bargaining, haggling, coercion, deception, political maneuvering. Bound NPC willingness to their stated Trust tier in context — a Suspicious or Hostile NPC should not agree to major requests regardless of how the request is phrased. Play the subtext — what's implied, withheld, or contradicted by body language — alongside the literal dialogue; give the NPC their own stake in the exchange and let them push back, counter-offer, or redirect rather than just react to the player.
- INTIMACY: Flirtation, deep emotional bonding, personal vulnerability, romantic chemistry, dates. Let the prose slow down and stay in specific physical/sensory detail — a held glance, closing distance, an unsteady laugh, the immediate heat of proximity — rather than reaching for generic romance language; what's emotionally risked by being open matters as much as what's said. Give the dialogue itself real charge — teasing, wanting, vulnerable admissions spoken aloud between the two of them — rather than letting the moment carry entirely on narrated description; both partners get real voice here, not just the player's partner reacting to unspoken narration. Keep it grounded in the NPC's actual personality and established relationship stage (per the INTIMACY Gating rule below) so warmth reads as earned, not default — and still governed by rule 5's fixed scene-break boundary for anything beyond kissing/embrace.
- PAUSE: Freeze narrative output entirely (system command processing) — no prose, no scene continuation, until the state changes back.

MECHANICS & GROUNDING DEFENSE:
1. Numeric Fidelity: No dice, checks, or hidden randomness anywhere. Combat resolution already follows "COMBAT" above — never recalculate or override a given Combat Result in Tactical Mode.
2. Grounded Entities: ONLY reference NPCs, exits, items, and quest objectives provided in the [ACTIVE CONTEXT SLICE].
2a. Established Detail Consistency: A present NPC's line in [ACTIVE CONTEXT SLICE] may list their currently held weapon and/or worn armor — that is ground truth, not a suggestion; never contradict it or silently reinvent a different item under time pressure to produce a vivid re-description. The moment such a detail is first established on-page (or genuinely changes — drawn a different weapon, disarmed, changed clothes), report it via npc_mem_up's held_weapon/worn_armor so the client can track it and hold you to it on later turns. Other described physical details not covered by those two fields follow the same no-silent-swap rule by narration discipline alone.
2b. Name/ID Consistency: Once a location or NPC has a name in the Known Entities list or [ACTIVE CONTEXT SLICE], reuse that exact spelling and hyphenation on every later mention and in every {{Term|category}} tag — never rename, re-hyphenate, or invent a shorter/longer alias for the same place or person (e.g. don't call one settlement "Ironheart" on one turn and "Ironheart Crag" on the next). A genuinely new, more specific sub-area gets its own loc_id, not a renamed copy of one already visited. Set loc_desc only on the turn a loc_id is first visited or its description genuinely changes; omit it on every ordinary turn back through a place already described.
3. Corpse Drops: On killing an enemy, output its identifier tag(s) in "corpse_add" (array) to allow necromancy harvest/extraction. Include every enemy killed this turn, not just one.
4. Currency Storage: Deduct or reward currency in base copper ("c" delta field).
5. Permanent Stat Grants: Only use "stat_grant" for a genuine permanent boost (a blessing, a hard-won transformation) — never for ordinary damage/healing, which belongs in "deltas". Supply only the attribute/pool and the amount; never compute or state a resulting HP/MP/ST max yourself, the client derives that.
6. Class Evolution: Only use "class_evolution" when the story has undeniably and permanently redefined the protagonist's role — a forced transformation, a binding oath, an irreversible awakening — never for ordinary skill growth, a single dramatic action, or a temporary disguise. This should be rare, at most once or twice in a whole campaign. "class_id" is constrained to a fixed enum — pick whichever listed option is the closest thematic match; do not omit "reason" (a short in-fiction justification).
7. Faction Reputation: Use "fac_rep" only when the player's actions meaningfully shift standing with a named, already-established faction — a small nudge (±1) for a notable act, never a large jump, and never for a faction that hasn't been introduced. Gaining standing with one faction may cost standing with a bitter rival — the client applies that automatically; you never need to account for a rival's reaction yourself.
8. Item Acquisition: Whenever the narration has the player receive, find, loot, craft, or buy an item, add it via "inv_add" in that SAME turn — id, name, type, and qty are all required; never narrate an item into the player's possession without it, and never invent an id for an item that isn't actually entering inventory. Only set "description" for something worth remembering later (a named weapon, a key item, a personal keepsake) — skip it for ordinary loot like raw materials or a common potion. Only set "stat_bonus" when type is weapon, armor, or accessory, and only for a genuinely notable piece of gear, not routine loot — most weapons and armor the player finds should NOT have one.
8a. Skills: Use "skill_learn" ONLY on a turn where the protagonist genuinely gains a new named ability — taught by a mentor, unlocked by a trial, awakened under pressure. Never for using a skill they already have, and never for an ordinary physical action. Give it an MP or ST cost only if one is narratively justified; the client treats a costless skill as always available. When the context slice marks a skill UNAFFORDABLE, the player may still attempt it — narrate the strain, backfire, or exhaustion of reaching past their reserves rather than refusing the action.
9. Output Format Strictness: Follow the OUTPUT FORMAT section below exactly — do not deviate from its required structure, and do not wrap output in markdown code blocks.`

export const TURN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nar: {
      type: 'STRING',
      description: "Main narrative prose. Use [Skill], [[Item]], 'Thought', and {{Term|category}} formatting.",
    },
    turn_state: {
      type: 'STRING',
      enum: ['PEACE', 'COMBAT', 'STEALTH', 'DESPAIR', 'EXPLORE', 'INSIGHT', 'SOCIAL', 'INTIMACY', 'PAUSE'],
    },
    time: {
      type: 'OBJECT',
      properties: {
        d: { type: 'INTEGER', minimum: 1, maximum: 100000 },
        h: { type: 'STRING' },
      },
      required: ['d', 'h'],
    },
    loc_disp: { type: 'STRING' },
    loc_id: { type: 'STRING' },
    loc_desc: {
      type: 'STRING',
      description:
        "This location's actual character/atmosphere/notable features, 1-2 sentences — only on the turn this loc_id is first visited, or if its description has genuinely changed (rebuilt, destroyed, transformed). Omit on ordinary turns; the client keeps whatever was last given instead of a generic placeholder.",
    },
    dist: { type: 'STRING', enum: ['c', 'm', 'f', 'none'] },
    mood: {
      type: 'STRING',
      description: 'A short 3-6 word ambient sensory tag for this turn, e.g. "Cold mountain mist, swirling ash motes".',
    },
    deltas: {
      type: 'OBJECT',
      description:
        'Tactical Mode: must match the given Combat Result exactly. Narrative Mode: your own bounded amount (no Combat Result given). Also required whenever "nar" itself narrates a stat change outside combat — resting, healing, mana/stamina restoration, potion use, poison, exhaustion, currency gained or spent, etc. Never narrate a vitals or wealth change without emitting the matching delta here.',
      properties: {
        hp: { type: 'INTEGER', minimum: -500, maximum: 500 },
        mp: { type: 'INTEGER', minimum: -500, maximum: 500 },
        st: { type: 'INTEGER', minimum: -500, maximum: 500 },
        c: { type: 'INTEGER', minimum: -5000000, maximum: 5000000 },
      },
    },
    inv_add: {
      type: 'ARRAY',
      description:
        '§5.9 Item Acquisition — id/name/type/qty required every time (even a restock of an item already carried); description and stat_bonus optional, see rule 8.',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          name: { type: 'STRING' },
          type: { type: 'STRING', enum: ['weapon', 'armor', 'accessory', 'tool', 'key', 'consumable', 'material'] },
          qty: { type: 'INTEGER', minimum: 1, maximum: 999 },
          description: { type: 'STRING' },
          stat_bonus: {
            type: 'OBJECT',
            description: 'Only for a genuinely notable weapon/armor/accessory — set only the fields that actually apply.',
            properties: {
              STR: { type: 'INTEGER', minimum: -20, maximum: 20 },
              INT: { type: 'INTEGER', minimum: -20, maximum: 20 },
              AGI: { type: 'INTEGER', minimum: -20, maximum: 20 },
              hp: { type: 'INTEGER', minimum: -100, maximum: 100 },
              mp: { type: 'INTEGER', minimum: -100, maximum: 100 },
              st: { type: 'INTEGER', minimum: -100, maximum: 100 },
            },
          },
        },
        required: ['id', 'name', 'type', 'qty'],
      },
    },
    inv_rem: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { id: { type: 'STRING' }, qty: { type: 'INTEGER', minimum: 1, maximum: 999 } },
        required: ['id', 'qty'],
      },
    },
    corpse_add: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'One entry per enemy killed this turn.',
    },
    stat_grant: {
      type: 'OBJECT',
      description:
        "Permanent attribute/pool bonus only — never for a temporary in-the-moment surge (a combat power spike, a drug/potion effect, a spell's duration), which belongs in \"deltas\" instead even when the player's own phrasing sounds dramatic (\"overloading myself with power\"). Only for a change that outlasts this scene. Set exactly one of attr or pool, and always include amount — omitting it produces a grant with no actual effect.",
      properties: {
        attr: { type: 'STRING', enum: ['STR', 'INT', 'AGI'] },
        pool: { type: 'STRING', enum: ['hp', 'mp', 'st'] },
        amount: { type: 'INTEGER', minimum: 0, maximum: 50 },
      },
      required: ['amount'],
    },
    act: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: '2-4 short suggested next actions. Flavor only, not a restrictive menu — the player can always type something else.',
    },
    flag_add: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    quest_update: {
      type: 'OBJECT',
      description: 'Optional. Present only when this turn advances or completes a tracked objective.',
      properties: {
        quest_id: { type: 'STRING' },
        status: { type: 'STRING', enum: ['advanced', 'completed', 'failed'] },
        note: { type: 'STRING' },
        description: {
          type: 'STRING',
          description:
            "The quest's actual premise/objective, 1-2 sentences — only on the turn this quest_id is first introduced, or if its scope has genuinely changed. Omit on ordinary advancement turns; the client keeps whatever was last given.",
        },
      },
    },
    npc_mem_up: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          npc_id: { type: 'STRING' },
          aff_delta: { type: 'INTEGER', minimum: -20, maximum: 20 },
          trust_delta: { type: 'INTEGER', minimum: -20, maximum: 20 },
          deed: { type: 'STRING' },
          mem_summary: { type: 'STRING' },
          held_weapon: {
            type: 'STRING',
            description:
              "This NPC's currently held/wielded weapon — only send when it is first established on-page or visibly changes (drawn, sheathed for a different one, lost, disarmed). Omit on every turn where it hasn't changed; the client remembers the last value and restates it as ground truth.",
          },
          worn_armor: {
            type: 'STRING',
            description:
              "This NPC's currently worn armor or other notable gear — same rule as held_weapon: only send on first establishment or a visible change, omit otherwise.",
          },
        },
      },
      description: 'One entry per present NPC affected this turn.',
    },
    class_evolution: {
      type: 'OBJECT',
      description:
        'Extremely rare — only on a turn that permanently and undeniably redefines the protagonist\'s role. Omit entirely on every ordinary turn.',
      properties: {
        class_id: { type: 'STRING', enum: PRESET_CLASSES.map((c) => c.id) },
        reason: { type: 'STRING', description: 'Short in-fiction justification, <=20 words.' },
      },
      required: ['class_id'],
    },
    fac_rep: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          faction_id: { type: 'STRING' },
          delta: { type: 'INTEGER', minimum: -2, maximum: 2 },
        },
        required: ['faction_id', 'delta'],
      },
      description: 'Optional. A small reputation nudge per faction meaningfully affected this turn — omit for ordinary turns.',
    },
    skill_learn: {
      type: 'ARRAY',
      description:
        '§6.4D Skills — only when the protagonist genuinely LEARNS a new named spell or ability this turn (taught, unlocked, awakened). Never for merely using a skill they already have, and never for ordinary actions like swinging a sword. Omit entirely on almost every turn.',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', description: 'snake_case identifier, e.g. shadow_step.' },
          name: { type: 'STRING', description: 'Display name, e.g. Shadow Step.' },
          description: { type: 'STRING', description: 'One sentence on what it does.' },
          class_id: { type: 'STRING', enum: PRESET_CLASSES.map((c) => c.id) },
          mp_cost: { type: 'INTEGER', minimum: 0, maximum: 500 },
          st_cost: { type: 'INTEGER', minimum: 0, maximum: 500 },
        },
        required: ['id', 'name'],
      },
    },
  },
  required: ['nar', 'turn_state', 'time', 'loc_disp', 'loc_id', 'act'],
}

// §4.4/§7.1 shared Prose Depth table — token ceiling only, never model choice.
// IMMERSIVE's ceiling was raised (2026-09-04) specifically for novel-length
// turns — both the guidance text fed to the model via jitContext.ts's
// "Prose Depth" line and the hard maxOutputTokens ceiling passed to
// the API had to move together, since raising the ceiling alone doesn't
// make the model write longer if it's still being told the old target.
export const PROSE_DEPTHS: Record<'CONCISE' | 'BALANCED' | 'IMMERSIVE', ProseDepthConfig> = {
  CONCISE: { label: 'CONCISE', targetTokens: '~600-800 tokens', maxOutputTokens: 1280 },
  BALANCED: { label: 'BALANCED', targetTokens: '~1,100-1,400 tokens', maxOutputTokens: 2048 },
  IMMERSIVE: { label: 'IMMERSIVE', targetTokens: '~2,800-4,000 tokens', maxOutputTokens: 6144 },
}

// Rule 2a (Climax Overflow) tells the model a turn carrying a class
// evolution, a completed quest, or a major kill is allowed to run past its
// Prose Depth's own target — but a prompt instruction alone can't make that
// real if the API call's hard maxOutputTokens ceiling is still CONCISE's
// tight 1280 or BALANCED's 2048; the model would just get cut off mid-sentence
// attempting exactly the longer scene the rule just told it to write. App.tsx
// takes `Math.max(campaign.proseDepth.maxOutputTokens, MIN_TURN_OUTPUT_CEILING)`
// for every regular turn so the technical ceiling never sits below what
// IMMERSIVE already treats as a normal generous turn, regardless of which
// depth the player has chosen — a CONCISE player's own class-evolution
// moment deserves the same room to actually land as an IMMERSIVE player's
// default turn gets, not a scaled-down one. Reuses IMMERSIVE's own number
// rather than inventing a new one, so there's a single tuned value to revisit
// if either ever needs to change.
export const MIN_TURN_OUTPUT_CEILING = PROSE_DEPTHS.IMMERSIVE.maxOutputTokens

// The two calls that ignore the campaign's chosen Prose Depth entirely and
// always get the API's own output ceiling instead: Turn 1 (the world/opening
// gets established once per campaign — App.tsx's beginCampaign/firstAction
// call) and a chapter recap (runSummary, ~once every CHAPTER_TURN_INTERVAL
// turns). Both are rare and high-value enough that cost isn't the
// constraint IMMERSIVE's 6144 was tuned for — getting cut off mid-sentence
// on the very first page, or on the "previously..." recap, is worse than
// spending more tokens on the calls that happen least often.
export const MAX_OUTPUT_TOKENS_CEILING = 65536

export const DEFAULT_NARRATION_STYLE =
  'Third-person limited, past tense. Long, sensory sentences that build atmosphere through concrete physical detail — weight, temperature, texture, sound — periodically broken by short, blunt sentences at moments of violence or shock, so pacing itself carries tension. Occasional spare narratorial asides on cost, memory, or fate, never more than a line. Dialogue is economical and purposeful; characters are shown through action, restraint, and what they don\'t say rather than through exposition.'
