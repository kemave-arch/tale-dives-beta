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
  name: 'Fourth Wing',
  mode: 'inspired',
  genreTone: 'Romantasy war college — dark-academia tension, banter-driven dialogue, visceral danger.',
  conflict:
    'Lethal trials in the Riders Quadrant against a border war with Poromiel and hidden venin threats.',
  background: 'The dragon-shielded continent of Navarre.',
  narrationStyle:
    'Visceral close POV with high-stakes urgency; short, breath-tight sentences during danger; sharp, banter-driven dialogue with simmering romantic tension; tactile physical strain over abstraction.',
  powerSystem:
    'Signet magic drawn from bonded dragons with severe physical burnout risk, supplemented by runic wards.',
  eraTechLevel: 'High fantasy war college, dragon aerial combat',
  keyFactions: 'Navarre (Riders, Scribes) vs. Poromiel fliers & hidden venin',
  sourceTitle: 'Fourth Wing',
  sourceAuthor: 'Rebecca Yarros',
}

export const VIOLET_SORRENGAIL: ProtagonistData = {
  id: 'protagonist_violet_sorrengail',
  name: 'Violet Sorrengail',
  classId: 'apprentice_scribe',
  className: 'Apprentice Scribe',
  background:
    "General Lilith Sorrengail's daughter, trained as a scholar but forced into the lethal Riders Quadrant on Conscription Day.",
  personality: 'Quietly stubborn, sharp-tongued when scared, relying on cunning and poisons over brute strength',
  motivation: 'Survive the Parapet, bond a dragon, and prove she belongs despite everyone expecting her to die',
  physicalTrait: 'Hypermobile joints and slight frame — agile and sharp, but injures easily under heavy force',
  secret: 'Keeps hidden notes documenting the vulnerabilities of fellow cadets and professors',
  opening:
    "The dive opens on Conscription Day in General Sorrengail's office during a tense final physical assessment. Violet binds her hypermobile joints while her sister Mira protests her transfer to the lethal Riders Quadrant. Outside, the deadly Parapet awaits.",
}
