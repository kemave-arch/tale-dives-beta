export interface FormExampleItem {
  name: string
  description: string
  value?: string
}

export interface FormExamplesConfig {
  title: string
  subtitle?: string
  items: FormExampleItem[]
}

export const GENRE_TONE_EXAMPLES: FormExamplesConfig = {
  title: 'Genre & Tone Examples',
  subtitle: 'Select an example to populate your setting tone, or use them as inspiration:',
  items: [
    {
      name: 'Grimdark Low Fantasy',
      description: 'Bleak moral ambiguity, visceral combat consequences, mud and blood, unforgiving human conflict.',
      value: 'Grimdark low fantasy, morally grey stakes & visceral survival',
    },
    {
      name: 'Cultivation & Xianxia',
      description: 'Qi circulation, sect politics, heavenly tribulations, martial dao breakthroughs, immortal realms.',
      value: 'Xianxia Cultivation, martial dao & realm ascension',
    },
    {
      name: 'Romance Fantasy / Romantasy',
      description: 'High-stakes romantic tension, enemies-to-lovers dynamics, bonded companions, emotional depth amidst peril.',
      value: 'Romance fantasy, high-stakes passion & slow-burn tension',
    },
    {
      name: 'Epic High Fantasy',
      description: 'Ancient prophecies, sweeping realm-wide wars, mythical beasts, lost kingdoms, wondrous artifacts.',
      value: 'Epic High Fantasy, grand realms & mythical wonders',
    },
    {
      name: 'Cyberpunk Noir & Future Tech',
      description: 'Neon-lit rain, corporate syndicates, cybernetic augmentations, sentient AI, shadowy undercities.',
      value: 'Cyberpunk noir, chrome augmentations & corporate espionage',
    },
    {
      name: 'Steampunk & Gaslamp Fantasy',
      description: 'Clockwork automatons, airship armadas, soot-stained factories, Victorian arcane secret societies.',
      value: 'Steampunk & Gaslamp, clockwork wonders & airship fleets',
    },
    {
      name: 'Gothic & Cosmic Horror',
      description: 'Creeping psychological dread, eldritch deities, decaying manors, forbidden occult manuscripts.',
      value: 'Gothic & Cosmic Horror, creeping dread & eldritch mysteries',
    },
    {
      name: 'Cozy & Hearthside Fantasy',
      description: 'Low-stress daily routine, tavern keeping, village warmth, gentle progress, culinary and craft joys.',
      value: 'Cozy Fantasy, warm hearthside & low-stress exploration',
    },
    {
      name: 'Military & Tactical Warfare',
      description: 'Frontline battalion clashes, siege logistics, martial formations, clashing banners and empires.',
      value: 'Military Fantasy, tactical warfare & gritty battlefield logistics',
    },
    {
      name: 'Courtly & Political Intrigue',
      description: 'Noble houses, shifting loyalties, whispered conspiracies, high-stakes diplomacy, subtle poisoncraft.',
      value: 'Courtly Intrigue, whispered conspiracies & power politics',
    },
  ],
}

export const CONFLICT_EXAMPLES: FormExamplesConfig = {
  title: 'Core Conflict Examples',
  subtitle: 'Select an overarching regional struggle driving events:',
  items: [
    {
      name: 'Ancient Sealed Threat Awakening',
      description: 'A dormant deity or catastrophic seal is cracking, threatening extinction unless reforged or destroyed.',
      value: 'An ancient slumbering god begins to awaken beneath the world crust, triggering seismic cataclysms and cultist rebellions.',
    },
    {
      name: 'Empire vs. Rebel Insurgency',
      description: 'An iron-fisted imperium ruthlessly suppresses underground freedom fighters and outlawed magic users.',
      value: 'An oppressive solar empire hunts down the last underground resistance while draining regional ley-lines.',
    },
    {
      name: 'Succession Crisis & Civil War',
      description: 'The monarch has died without an undisputed heir; rival siblings and duke coalitions mobilize armies.',
      value: 'A fractured succession crisis pitting three royal siblings and their mercenary legions against one another.',
    },
    {
      name: 'Resource Depletion & Fading Magic',
      description: 'The world’s primary mana source or life-giving crystal is dimming, sparking desperate border invasions.',
      value: 'The central World-Tree is withering, forcing neighboring kingdoms into desperate resource wars over the remaining fertile valleys.',
    },
    {
      name: 'Corrupting Plague / Taint Incursion',
      description: 'A spreading dark blight mutates wildlife, corrupts magic users, and breaches the frontier borders.',
      value: 'A creeping abyssal taint breaches ancient border fortifications, mutating beasts and corrupting the minds of spellcasters.',
    },
    {
      name: 'Rival Martial Sects Blood Feud',
      description: 'Competing schools and mountain clans contest ancient relics and celestial ascension territory.',
      value: 'A century-long blood feud between nine martial sects vying for control of a newly unearthed celestial immortal tomb.',
    },
  ],
}

export const POWER_SYSTEM_EXAMPLES: FormExamplesConfig = {
  title: 'Power System Examples',
  subtitle: 'Select an example to populate how powers operate in this realm:',
  items: [
    {
      name: 'Hard Elemental Alchemy',
      description: 'Strict elemental laws, measurable fuel or stamina costs, rigid affinities, severe backlash on overdraw.',
      value: 'Hard magic system with strict elemental laws, measurable mana cost, and severe physical backlash on exhaustion.',
    },
    {
      name: 'Cultivation & Qi Cores',
      description: 'Dantian energy centers, Qi meridians, spiritual roots, martial breakthroughs, and realm ascension.',
      value: 'Cultivation system with dantian core condensation, spiritual root affinities, and perilous realm breakthroughs.',
    },
    {
      name: 'Cyberware & Nanotech Augments',
      description: 'Nanotech blood infusions, cybernetic neural links, overclocked reflexes with neural burnout risk.',
      value: 'Cybernetic augmentation: sub-dermal neural processors, nanite healing suites, and overclocked kinetic servos.',
    },
    {
      name: 'Divine Pacts & Patronage',
      description: 'Power channeled directly from celestial or abyssal patrons, subject to strict sacred vows and tithes.',
      value: 'Divine pacts: powers granted by capricious gods and entity covenants, requiring constant devotion and sacrifice.',
    },
    {
      name: 'Mythic Beast & Dragon Bonding',
      description: 'Telepathic resonance with mythical creatures granting shared senses and unique channeled abilities.',
      value: 'Beast bonding: telepathic links with bonded creatures granting unique manifest abilities and elemental channeling.',
    },
    {
      name: 'Pure Skill & Mortal Steel',
      description: 'Zero supernatural phenomena — peak physical conditioning, ruthless tactical discipline, master weaponsmanship.',
      value: 'No supernatural powers — grounded mortal combat where tactical terrain, stamina, and weapon mastery dictate survival.',
    },
    {
      name: 'Rune Inscription & Artifact Crafting',
      description: 'Carving geometric glyphs into flesh, stone, or steel to channel dormant environmental ley-lines.',
      value: 'Rune inscription: geometric glyphs etched onto gear and skin to harness latent ambient leylines.',
    },
  ],
}

export const ERA_TECH_EXAMPLES: FormExamplesConfig = {
  title: 'Era & Tech Level Examples',
  subtitle: 'Select an era or technology baseline for this setting:',
  items: [
    {
      name: 'Medieval High Fantasy',
      description: 'Castles, plate armor, bows and swords, horse travel, enchanted lanterns, zero gunpowder.',
      value: 'Medieval high fantasy, sword-and-sorcery, enchanted masonry, zero gunpowder',
    },
    {
      name: 'Early Modern Flintlock Fantasy',
      description: 'Rapiers, flintlock pistols, cannons, galleon warships, printing presses alongside battle magic.',
      value: 'Early modern flintlock fantasy, rapiers, black powder muskets & naval galleons',
    },
    {
      name: 'Steampunk / Industrial Magitech',
      description: 'Steam locomotives, airships, lightning coils, coal factories, mechanical prosthetics.',
      value: 'Industrial steampunk, coal-fired airships, steam trains & clockwork automatons',
    },
    {
      name: 'Ancient Bronze / Mythic Age',
      description: 'Bronze armor, spear phalanxes, chariot warfare, city-states, mythic demigods walking among mortals.',
      value: 'Mythic Bronze Age, chariot warfare, spear phalanxes & demigod champions',
    },
    {
      name: 'Dystopian Cyberpunk Megacity',
      description: 'Holographic billboards, neural interfaces, flying hovercraft, sub-orbital transports, energy blades.',
      value: 'Dystopian cyberpunk, neural cyberware, holo-grid networks & energy weapons',
    },
  ],
}

export const KEY_FACTIONS_EXAMPLES: FormExamplesConfig = {
  title: 'Key Factions Examples',
  subtitle: 'Select notable factions driving the setting’s political and military tension:',
  items: [
    {
      name: 'Imperium vs. Rebel Guilds',
      description: 'The central authoritarian empire versus an allied coalition of smuggler guilds and freedom fighters.',
      value: 'The Solar Imperium (Legionnaires & Inquisitors) vs. The Free Coven Smugglers',
    },
    {
      name: 'Rival Royal Houses',
      description: 'Two aristocratic bloodlines locked in dynastic competition for the high throne.',
      value: 'House Valerius (Iron & Heavy Cavalry) vs. House Ravenscar (Arcane Navy & Spies)',
    },
    {
      name: 'Holy Church vs. Arcane Academies',
      description: 'Religious inquisitors seeking to regulate or purge independent wizard guilds.',
      value: 'The Radiant Orthodoxy (Templars) vs. The Grand Citadel Academy of Mages',
    },
    {
      name: 'Corporate Syndicates vs. Street Runners',
      description: 'Omnipresent megacorporations exploiting slums defended by underground mercenary clans.',
      value: 'Aegis Bio-Corp & Kuroda Dynamics vs. The Undercity Ghost Syndicate',
    },
  ],
}

export const WORLD_BACKGROUND_EXAMPLES: FormExamplesConfig = {
  title: 'World Background Examples',
  subtitle: 'Select a world backdrop and geographical setting:',
  items: [
    {
      name: 'Floating Cloud Archipelago',
      description: 'A shattered world where islands drift over a toxic sea, connected by zip-lines, airships, and gliders.',
      value: 'A fractured continent of floating sky-islands suspended over a lethal storm-sea, anchored by ancient gravity spires.',
    },
    {
      name: 'Walled Realm & Wild Untamed Frontiers',
      description: 'Civilization huddles behind towering runic bulwarks while monstrous titans roam the wild expanses.',
      value: 'Great fortress cities protected by crystalline barrier shields against the feral chimera beasts of the outer wilds.',
    },
    {
      name: 'Frozen Northern Tundra & Glacial Kingdoms',
      description: 'Endless blizzards, geothermal hot springs, mammoth hunts, and ancient ice-bound tombs.',
      value: 'A harsh sub-zero subcontinent where nomadic clans survive around geothermal geysers while hunting frost behemoths.',
    },
    {
      name: 'Dense Sprawling Arcane Megacity',
      description: 'A multi-tiered metropolis built atop ancient catacombs, bustling with millions of diverse inhabitants.',
      value: 'A towering seven-tiered metropolis where the elite live in sky-villas while the poor survive in the flooded under-levels.',
    },
  ],
}

export const NARRATION_STYLE_EXAMPLES: FormExamplesConfig = {
  title: 'Narration Style Examples',
  subtitle: 'Select a prose tone and narrative cadence:',
  items: [
    {
      name: 'Visceral & High-Stakes Action',
      description: 'Short, breath-tight sentences during danger; sharp, banter-driven dialogue with simmering romantic tension; tactile physical strain.',
      value: 'Visceral close POV with high-stakes urgency; short, breath-tight sentences during danger; sharp, banter-driven dialogue with simmering romantic tension; tactile physical strain over abstraction.',
    },
    {
      name: 'Atmospheric & Poetic Grimdark',
      description: 'Sensory weight, textured physical detail (rust, cold, iron), measured pacing, and dry, sardonic dialogue.',
      value: 'Third-person limited, gritty and immersive. Sensory focus on weight, cold, iron, and blood. Measured atmospheric pacing broken by sudden, brutal violence.',
    },
    {
      name: 'Witty & Irreverent First-Person',
      description: 'Caustic internal monologue, dark humor under crisis, rapid comedic banter, and self-deprecating observations.',
      value: 'First-person close POV with caustic internal wit, fast-paced dialogue, cynical banter, and sharp tactical improvisation.',
    },
    {
      name: 'Grand Epic & Mythic Serenity',
      description: 'Elevated archaic vocabulary, sweeping landscape descriptions, philosophical depth, and noble oaths.',
      value: 'Epic high-register prose with rich mythic resonance, sweeping visual scope, and dignified character interactions.',
    },
  ],
}

export const PROTAGONIST_BACKGROUND_EXAMPLES: FormExamplesConfig = {
  title: 'Protagonist Background Examples',
  subtitle: 'Select an origin story and past history:',
  items: [
    {
      name: 'Disgraced Noble Scion',
      description: 'Stripped of ancestral title and lands following a political setup; now surviving on the margins.',
      value: 'Disgraced scion of a fallen aristocratic dynasty, stripped of family inheritance and forced to rebuild from exile.',
    },
    {
      name: 'Street-Smart Undercity Thief',
      description: 'Raised in back alleys and pickpocket rings, relying on agile wits and keen reflexes to survive.',
      value: 'Orphaned street survivor raised in the cutthroat undercity, possessing an intimate knowledge of locks, poisons, and shadows.',
    },
    {
      name: 'Battlefield Veteran / Ex-Soldier',
      description: 'Hardened by years of frontline campaigns; carries combat experience and quiet trauma.',
      value: 'Decorated former squad sergeant who walked away from an unjust war, carrying lethal weapon discipline and scars.',
    },
    {
      name: 'Reclusive Arcane Scholar',
      description: 'Trained in dusty libraries and forbidden archives before being thrust into the perilous outside world.',
      value: 'Former archive curator exiled for translating forbidden occult texts, seeking ancient relics to prove their theories.',
    },
    {
      name: 'Escaped Gladiator / Thrall',
      description: 'Fought for survival in blood arenas before breaking their chains, skilled in brutal weapon arts.',
      value: 'Former pit fighter who won their freedom in the arena sands, possessing formidable pain tolerance and instinct.',
    },
  ],
}

export const PERSONALITY_EXAMPLES: FormExamplesConfig = {
  title: 'Personality Trait Examples',
  subtitle: 'Select a personality trait archetype to populate your protagonist:',
  items: [
    {
      name: 'Sharp & Calculating',
      description: 'Analytical, observant, rarely reveals emotion, always calculates contingencies and exit strategies.',
      value: 'Sharp and calculating, disguising razor-sharp observation behind quiet composure',
    },
    {
      name: 'Guarded & Skeptical',
      description: 'Trusts very slowly, questions every motive, vigilant survivor with a dry, cynical protective edge.',
      value: 'Guarded and skeptical, constantly measuring exits and questioning sweet promises',
    },
    {
      name: 'Warm-hearted & Fiercely Loyal',
      description: 'Deeply empathetic, protective of companions, acts as moral anchor and beacon in grim moments.',
      value: 'Warm-hearted and fiercely protective, lifting allies up even when facing overwhelming odds',
    },
    {
      name: 'Reckless & Bold',
      description: 'Dives headfirst into danger, improvises brilliantly under pressure, despises stagnation and fear.',
      value: 'Reckless and daring, thriving when plans collapse and pure instinct takes over',
    },
    {
      name: 'Quietly Stubborn',
      description: 'Unyielding inner resolve, absorbs punishment without yielding, patient determination that outlasts foes.',
      value: 'Quietly stubborn, refusing to break or compromise regardless of the pressure applied',
    },
    {
      name: 'Wry & Silver-tongued',
      description: 'Diffuses deadly tension with caustic wit, natural negotiator who hides vulnerability behind a grin.',
      value: 'Wry and silver-tongued, deflecting danger with quick wit and disarming charm',
    },
    {
      name: 'Idealistic & Honorable',
      description: 'Unshakable ethical compass, defends the powerless, refuses to compromise principles for convenience.',
      value: 'Idealistic and honorable, steadfast in defending justice even at personal cost',
    },
    {
      name: 'Pragmatic Survivor',
      description: 'Lacks heroic illusions, focuses strictly on what keeps them alive and ahead of impending threats.',
      value: 'Pragmatic survivor, doing whatever it takes to endure without sentimentality',
    },
  ],
}

export const MOTIVATION_EXAMPLES: FormExamplesConfig = {
  title: 'Motivation & Ambition Examples',
  subtitle: 'Select a driving motivation for your protagonist:',
  items: [
    {
      name: 'Protect Someone Cherished',
      description: 'Shield a vulnerable sibling, lover, or adopted ward from the brutality of the realm.',
      value: 'Protect someone cherished at all costs, ensuring they never suffer the cruelties of this world',
    },
    {
      name: 'Uncover a Buried Truth',
      description: 'Solve the mystery of an erased lineage, forgotten massacre, or clandestine family secret.',
      value: 'Uncover the hidden truth behind an erased past and demand answers from those responsible',
    },
    {
      name: 'Revenge & Retribution',
      description: 'Tear down the tyrant, traitor, or institution that dismantled their home and life.',
      value: 'Exact retribution against the figures responsible for destroying everything they held dear',
    },
    {
      name: 'Earn Freedom & Autonomy',
      description: 'Shatter a binding magical contract, debt of servitude, or suffocating dynastic destiny.',
      value: 'Break free from shackles of servitude and claim complete sovereignty over their own fate',
    },
    {
      name: 'Prove Worth Against Doubt',
      description: 'Defy every low expectation, prove that weakness was an illusion, and surpass all critics.',
      value: 'Prove their worth to a world that wrote them off, shattering every expectation set against them',
    },
    {
      name: 'Master the Pinnacle of Skill',
      description: 'Reach the apex of their martial art, arcane discipline, or craft through relentless perfection.',
      value: 'Ascend to the absolute pinnacle of their discipline and uncover forgotten legendary heights',
    },
    {
      name: 'Reshape the Realm',
      description: 'Overthrow a decaying, corrupt power structure to build a fair society for the oppressed.',
      value: 'Overturn a corrupt and oppressive system to forge a just future for the realm',
    },
    {
      name: 'Peace & Lasting Security',
      description: 'Amass sufficient strength, wealth, and territory so nobody can ever threaten their peace again.',
      value: 'Secure lasting peace and unassailable safety so they never live in fear again',
    },
  ],
}

export const PHYSICAL_TRAIT_EXAMPLES: FormExamplesConfig = {
  title: 'Physical Trait & Flaw Examples',
  subtitle: 'Select a distinguishing physical characteristic, quirk, or condition:',
  items: [
    {
      name: 'Piercing Heterochromia Eyes',
      description: 'Mismatched eye colors that faintly shimmer under magical or emotional stress.',
      value: 'Mismatched heterochromia eyes that faintly shimmer when channeling power',
    },
    {
      name: 'Duel Scars & Calloused Hands',
      description: 'Jagged scar along the jawline and heavily calloused weapon-bearing hands.',
      value: 'Jagged scar across the jawline and calloused hands tempered by years of sword practice',
    },
    {
      name: 'Slight Frame & Hypermobile Agility',
      description: 'Lightweight build with exceptional flexibility and swift reflexes, but vulnerable to blunt force.',
      value: 'Slight and agile frame, exceptionally fast on their feet but vulnerable under heavy crushing blows',
    },
    {
      name: 'Prosthetic / Arcane Arm',
      description: 'A clockwork or rune-carved metal forearm replacing a lost limb.',
      value: 'Clockwork brass prosthetic forearm inscribed with miniature shock-runes',
    },
    {
      name: 'Silver-Streak Hair / Arcane Stigma',
      description: 'Hair streaks that turned white after surviving a magical surge or curse.',
      value: 'Raven hair shot with distinct streaks of pure silver from a childhood magical surge',
    },
  ],
}

export const SECRET_EXAMPLES: FormExamplesConfig = {
  title: 'Secret & Hidden Hook Examples',
  subtitle: 'Select a hidden truth that the Narrator can weave into the story:',
  items: [
    {
      name: 'Carrier of a Dormant Ancient Curse',
      description: 'An entity or curse whispers in their dreams, awakening under mortal danger.',
      value: 'Harbors a dormant seal on their chest that reacts violently near ancient ruins',
    },
    {
      name: 'Stolen Banned Manuscript',
      description: 'Carries a hidden cipher book documenting the secret weaknesses of high officials.',
      value: 'Carries a cipher-locked grimoire detailing the illicit secrets of high-ranking nobility',
    },
    {
      name: 'Secret Bloodline / Bastard Heir',
      description: 'Unbeknownst to the realm, they carry the blood of the deposed royal house.',
      value: 'Secretly the illegitimate scion of the assassinated emperor',
    },
    {
      name: 'Infiltrator / Double Agent',
      description: 'Working undercover for a rival guild or kingdom with an undisclosed mission.',
      value: 'Operating as an undercover informant for an allied resistance network',
    },
    {
      name: 'Surviving a Forbidden Experiment',
      description: 'The sole survivor of an alchemical or magical trial that granted unstable abilities.',
      value: 'The only subject who survived a forbidden military alchemical enhancement program',
    },
  ],
}

export const OPENING_BRIEF_EXAMPLES: FormExamplesConfig = {
  title: 'Tale Dive Brief Examples',
  subtitle: 'Select an opening scene hook for Turn 1:',
  items: [
    {
      name: 'Ambushed Airship in a Storm',
      description: 'Alarms blare as sky-raiders board through shattered skylights in lightning-filled clouds.',
      value: 'Standing on the rain-slicked deck of an airship as alarms wail and harpoons smash through the forward hull, weapon drawn alongside your squad.',
    },
    {
      name: 'Tense Academy Conscription',
      description: 'Waiting in a crowded stone courtyard before a lethal trial that claims unprepared cadets.',
      value: 'Standing in a cold stone courtyard at dawn as the academy proctor calls your name to step forward into the lethal entrance trial.',
    },
    {
      name: 'Burning Caravan in Snow',
      description: 'Waking up inside a overturned wagon surrounded by raiders and falling blizzard drifts.',
      value: 'Recovering consciousness inside an overturned wagon in the snow, clutching your weapon as masked bandits surround the burning caravan.',
    },
    {
      name: 'Masked Gala Heist',
      description: 'Infiltrating a lavish ballroom in disguise to extract a sealed diplomatic treaty before the bells ring.',
      value: 'Mingling at a grand masquerade ball under glowing chandeliers, timing your steps toward the guarded archive door.',
    },
    {
      name: 'Tavern Confrontation',
      description: 'Cornered at a corner table by bounty hunters demanding surrender while rain hammers the shutters.',
      value: 'Sitting at a secluded tavern table as three armed bounty hunters kick open the heavy oak door and lock eyes with you.',
    },
  ],
}
