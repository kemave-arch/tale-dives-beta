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
  keyFactions: 'Navarre Military (Riders, Scribes, Infantry, Healers) vs. Poromiel Gryphon Fliers & Shadow Venin.',
  sourceTitle: 'Fourth Wing',
  sourceAuthor: 'Rebecca Yarros',
}

export const VIOLET_SORRENGAIL: ProtagonistData = {
  id: 'protagonist_violet_sorrengail',
  name: 'Violet Sorrengail',
  isMaster: true,
  isDefault: true,
  gender: 'Female',
  age: 20,
  classId: 'apprentice_scribe',
  className: 'Apprentice Scribe',
  background:
    "General Lilith Sorrengail's daughter, trained for years in history and poisons for the Scribe Quadrant until her mother forced her into the lethal Riders Quadrant on Conscription Day.",
  personality: 'Fiercely intelligent, quietly stubborn, sharp-tongued when cornered, relying on book-smarts, anatomy, and poisons over physical brute force.',
  motivation: 'Survive the lethal Parapet, bond a dragon, and prove her worth despite everyone expecting her frail body to break or wash out.',
  physicalTrait: 'Hypermobile joints and slight frame prone to dislocation; hair that turns silver-white at the ends.',
  secret: 'Carries hidden boots lined with poisoned daggers and notes detailing the physical weaknesses of instructors and fellow cadets.',
  opening:
    "The dive opens on Conscription Day in General Lilith Sorrengail's office during a tense final uniform fitting. Violet binds her fragile joints while her sister Mira argues furiously with their mother. Beyond the high turret window, the rain-slicked, narrow stone Parapet awaits over a deadly gorge.",
}
