import type { ProtagonistData, WorldData } from '../types.ts'

// Blueprint Appendix A's worked example, shipped as a real starter World +
// Protagonist template — Fourth Wing by Rebecca Yarros — so there's a rich,
// ready-to-play example the first time someone opens the World/Protagonist
// Library, instead of a totally blank slate. Seeded once by store.ts on a
// genuinely first-ever load; deleting it is respected afterward, same as any
// other Library entry (§6.4B).
//
// sourceTitle/sourceAuthor are attribution metadata only — never sent to the
// model. Turn narration is grounded entirely by World Background/Genre/
// Conflict/Narration Style and the protagonist's own Background/Tale Dive
// Brief below, exactly like any other campaign.
export const FOURTH_WING_WORLD: WorldData = {
  id: 'world_fourth_wing',
  name: 'Navarre',
  isMaster: true,
  isDefault: true,
  mode: 'inspired',
  genreTone: 'Romantasy war college — dark academia stakes, high-tension banter, visceral physical peril.',
  conflict:
    'Navarre fights a covert war against Poromiel and corrupt venin while Basgiath War College ruthlessly culls weak cadets.',
  background:
    'Navarre is shielded from dragon-slaying venin by ancestral wards maintained by bonded dragons at Basgiath War College. Outside the magical barrier, dark channelers drain life from the earth, while inside, Navarre high command covers up the true war and executes rebel leadership.',
  narrationStyle:
    'Visceral close POV with high-stakes urgency; short, breath-tight sentences during danger; sharp, banter-driven dialogue with simmering romantic tension; tactile physical strain over abstraction.',
  powerSystem:
    'Dragon-bonded Signet magic (channeling raw power into unique signets like lightning, shadows, or precognition) with lethal physical burnout risk, reinforced by defensive runic arrays.',
  eraTechLevel: 'High fantasy war college, dragon aerial combat, blade duels, ancient ward stones, zero firearms.',
  keyFactions: 'Riders Quadrant, Scribe Quadrant, Navarre High Command, Poromiel Gryphon Fliers, Shadow Venin',
  factionsList: [
    {
      id: 'riders_quadrant',
      name: 'Riders Quadrant',
      attitude: 'neutral',
      territory: 'Basgiath War College',
      description: 'The deadliest quadrant of Basgiath, where dragon riders train in aerial combat and signet magic under lethal discipline.',
    },
    {
      id: 'scribe_quadrant',
      name: 'Scribe Quadrant',
      attitude: 'friendly',
      territory: 'Basgiath Archives',
      description: 'Scholars and historians dedicated to preserving knowledge, history, laws, and dragon lore across Navarre.',
    },
    {
      id: 'navarre_high_command',
      name: 'Navarre High Command',
      attitude: 'neutral',
      territory: 'Aretia & Calldyr',
      description: 'The ruling military leadership led by General Sorrengail and King Tauri, concealing the venin threat from the populace.',
    },
    {
      id: 'poromiel_fliers',
      name: 'Poromiel Gryphon Fliers',
      attitude: 'hostile',
      territory: 'Poromiel Borderlands',
      description: "Gryphon-riding rivals waging war along Navarre borderlands while seeking magical barrier protection against venin.",
    },
    {
      id: 'shadow_venin',
      name: 'Shadow Venin & Wyvern',
      attitude: 'hostile',
      territory: 'The Barrens',
      description: 'Corrupted dark channelers who drain magic directly from the earth, commanding winged wyvern monstrosities.',
    },
  ],
  locationsList: [
    {
      id: 'loc_basgiath',
      name: 'Basgiath War College',
      region: 'Navarre Highlands',
      description: 'The brutal military academy perched on steep mountain ridges where cadets train to become dragon riders, scribes, healers, or infantry.',
      dangerLevel: 'High',
      locationType: 'Fortress',
      factionOwner: 'Riders Quadrant',
    },
    {
      id: 'loc_parapet',
      name: 'The Parapet',
      region: 'Basgiath War College',
      description: 'An eighteen-inch wide rain-slicked stone bridge straddling a twenty-foot gorge. Entering cadets must cross it without falling to their deaths.',
      dangerLevel: 'Lethal',
      locationType: 'Fortress',
      factionOwner: 'Riders Quadrant',
    },
    {
      id: 'loc_threshing',
      name: 'Threshing Grounds',
      region: 'Basgiath Valley',
      description: 'The ancient valley where unbonded dragons evaluate surviving cadets and decide whether to burn or bond them.',
      dangerLevel: 'High',
      locationType: 'Wilds',
      factionOwner: 'Navarre Military',
    },
    {
      id: 'loc_aretia',
      name: 'Aretia',
      region: 'Tyrrendell Province',
      description: 'The ruined former capital of Tyrrendell, hidden deep within mountain valleys where rebel forces assemble.',
      dangerLevel: 'Low',
      locationType: 'Settlement',
      factionOwner: 'Rebel Leadership',
    },
  ],
  sourceTitle: 'Fourth Wing',
  sourceAuthor: 'Rebecca Yarros',
}

export const VIOLET_SORRENGAIL: ProtagonistData = {
  id: 'protagonist_violet_sorrengail',
  name: 'Violet Sorrengail',
  isMaster: true,
  isDefault: true,
  gender: 'F',
  age: 20,
  classId: 'apprentice_scribe',
  className: 'Scribe',
  customAttributes: {
    STR: 10,
    INT: 18,
    AGI: 14,
  },
  startingSkills: [
    {
      name: "Poisoner's Edge",
      skillType: 'Utility',
      tier: 'Novice',
      stCost: 6,
      mpCost: 0,
      description: 'Leverages vast scribe knowledge of deadly botanicals to coat daggers and identify concealed venoms.',
    },
    {
      name: 'Anatomical Precision',
      skillType: 'Passive',
      tier: 'Novice',
      stCost: 0,
      mpCost: 0,
      description: 'Exploits intimate anatomical knowledge from scribe texts to maximize critical damage against human and beast joint gaps.',
    },
    {
      name: 'Dagger Parry & Feint',
      skillType: 'Martial',
      tier: 'Novice',
      stCost: 8,
      mpCost: 0,
      description: 'Uses low center of gravity and dual daggers to deflect heavy weapon strikes and counter-attack frail spots.',
    },
  ],
  background:
    "General Lilith Sorrengail's daughter, trained for years in history, languages, and poisons for the Scribe Quadrant until her mother forced her into the lethal Riders Quadrant on Conscription Day.",
  personality: 'Fiercely intelligent, quietly stubborn, sharp-tongued under pressure, relying on book-smarts, anatomical precision, and poisons over physical brute force.',
  motivation: 'Survive the lethal Parapet, bond a dragon at Threshing, and prove her worth despite everyone expecting her fragile body to break or wash out.',
  physicalTrait: 'Hypermobile joints and frail bone density prone to dislocation; waist-length hair that pales to silver-white at the ends.',
  secret: 'Carries hidden boots lined with poisoned daggers and notes detailing the physical vulnerabilities of instructors and fellow cadets.',
  opening:
    "The dive opens on Conscription Day in General Lilith Sorrengail's office during a tense final uniform fitting. Violet binds her fragile joints with leather wraps while her sister Mira argues furiously with their mother. Beyond the high turret window, the rain-slicked, narrow stone Parapet awaits over a deadly gorge.",
}
