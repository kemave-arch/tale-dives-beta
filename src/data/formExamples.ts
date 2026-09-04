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
      name: 'Romance Fantasy',
      description: 'High stakes romantic tension, slow-burn dynamics, bonded pairs, emotional depth amidst peril.',
      value: 'Romance Fantasy, high stakes & slow-burn tension',
    },
    {
      name: 'Comedy & Satirical',
      description: 'Witty banter, absurd situational irony, subversive tropes, lighthearted character-driven humor.',
      value: 'Comedy & satire, witty dialogue & whimsical adventure',
    },
    {
      name: 'Adventure Fantasy',
      description: 'Grand epic quests, ancient dungeons, uncharted frontiers, wondrous exploration, relics of lost ages.',
      value: 'Adventure Fantasy, exploration & ancient mysteries',
    },
    {
      name: 'Future Tech & Sci-Fi',
      description: 'Cybernetic augmentations, sentient artificial intelligence, orbital colonies, sleek megastructures.',
      value: 'Future Tech, cyberpunk noir & synthetic consciousness',
    },
    {
      name: 'Warfare & Military Fantasy',
      description: 'Frontline battalion clashes, siege warfare, gritty martial logistics, clashing banners and empires.',
      value: 'Warfare & Military Fantasy, gritty frontline combat & strategy',
    },
    {
      name: 'Real-like & Grounded History',
      description: 'Authentic period grit, harsh survival mechanics, low magical interference, grounded human drama.',
      value: 'Real-like historical realism, harsh survival & grounded consequences',
    },
    {
      name: 'Drama & Political Intrigue',
      description: 'Noble houses, shifting loyalties, whispered conspiracies, high-stakes diplomacy, moral grey areas.',
      value: 'Drama & Courtly Intrigue, shifting loyalties & power politics',
    },
    {
      name: 'Grimdark & Visceral',
      description: 'Bleak moral ambiguity, brutal consequences, dark gothic atmospheric dread, unforgiving conflicts.',
      value: 'Grimdark & Visceral, morally grey & uncompromising stakes',
    },
    {
      name: 'Cozy & Hearthside',
      description: 'Low-stress daily routine, tavern keeping, village warmth, gentle progress, culinary and craft joys.',
      value: 'Cozy Fantasy, warm hearthside & low-stress exploration',
    },
    {
      name: 'Cultivation & Xianxia',
      description: 'Qi circulation, sect hierarchies, heavenly tribulations, martial dao breakthroughs, immortal realms.',
      value: 'Xianxia Cultivation, martial dao & realm ascension',
    },
    {
      name: 'Gothic & Cosmic Horror',
      description: 'Creeping psychological dread, eldritch deities, decaying manors, forbidden occult manuscripts.',
      value: 'Gothic & Cosmic Horror, creeping dread & eldritch mysteries',
    },
    {
      name: 'Urban & Modern Supernatural',
      description: 'Hidden arcane underworld operating inside a bustling contemporary metropolis, secret treaties.',
      value: 'Urban Fantasy, clandestine magic beneath a modern metropolis',
    },
  ],
}

export const POWER_SYSTEM_EXAMPLES: FormExamplesConfig = {
  title: 'Power System Examples',
  subtitle: 'Select an example to populate how powers operate in this realm:',
  items: [
    {
      name: 'Hard Magic System',
      description: 'Strict elemental laws, measurable fuel or stamina costs, rigid affinities, severe backlash if overdrawn.',
      value: 'Hard magic system with strict elemental laws, measurable mana cost, and severe backlash on exhaustion.',
    },
    {
      name: 'Soft & Mythic Magic',
      description: 'Poetic, mysterious, dreamlike reality-bending phenomena, unpredictable ancient forces and prophecies.',
      value: 'Soft, mythic wonder magic governed by ancient oaths, emotions, and symbolic resonance rather than strict rules.',
    },
    {
      name: 'Cultivation & Cores',
      description: 'Dantian energy centers, Qi meridians, spiritual roots, martial breakthroughs, and realm ascension.',
      value: 'Cultivation system with dantian core condensation, spiritual root affinities, and perilous realm breakthroughs.',
    },
    {
      name: 'Tech Augmentation & Cyberware',
      description: 'Nanotech blood infusions, cybernetic neural links, holographic combat suites, energy shielding.',
      value: 'Cybernetic augmentation: sub-dermal neural processors, nanite healing suites, and overclocked kinetic servos.',
    },
    {
      name: 'Pure Skill & Steel',
      description: 'Zero supernatural phenomena — peak mortal conditioning, relentless tactical discipline, master weaponsmanship.',
      value: 'No supernatural powers — grounded mortal combat where tactical terrain, stamina, and weapon mastery dictate survival.',
    },
    {
      name: 'Divine Pacts & Patronage',
      description: 'Blessings from fickle gods, demonic covenants, celestial favors bought with prayer or blood sacrifices.',
      value: 'Divine pacts: power channeled directly from celestial or abyssal patrons, subject to strict sacred vows and tithes.',
    },
    {
      name: 'Bloodline & Beast Bonding',
      description: 'Telepathic resonance with dragons or beasts, inherited ancestral sparks, metamorphic beast traits.',
      value: 'Beast bonding: telepathic links with mythical beasts that grant shared senses and elemental manifestation.',
    },
    {
      name: 'Alchemical & Artifact Crafting',
      description: 'Transmutation geometry, volatile botanical elixirs, enchanted metallurgy, soul-infused weaponry.',
      value: 'Alchemical science: precise transmutations, volatile reagents, and forged runic artifacts.',
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
