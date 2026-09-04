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
  genreTone: 'Romantasy war-college — dark-academia tension, banter-forward dialogue, visceral physical danger.',
  conflict:
    "A brutal culling of the weak inside the Riders Quadrant, set against a border war with Poromiel and unrest among the continent's own dragons.",
  background: 'The continent of Navarre.',
  narrationStyle:
    'Close third person with a present-tense sense of urgency; short, breath-tight sentences during danger or physical strain; banter-forward dialogue that carries romantic tension through action rather than pausing for it; visceral, specific physical detail over abstraction.',
  powerSystem:
    'Signet magic — every cadet who survives to bond a dragon gains a unique signet ability drawn from that bond. Channeling it without enough physical conditioning burns through the body fast, and going too long unbonded, or too far from a dragon, is dangerous on its own.',
  eraTechLevel: 'Medieval high fantasy war-college',
  keyFactions: 'Navarre vs. Poromiel',
  sourceTitle: 'Fourth Wing',
  sourceAuthor: 'Rebecca Yarros',
}

export const VIOLET_SORRENGAIL: ProtagonistData = {
  id: 'protagonist_violet_sorrengail',
  name: 'Violet Sorrengail',
  classId: 'apprentice_scribe',
  className: 'Apprentice Scribe',
  background:
    "Daughter of Lilith Sorrengail, general commander of Navarre's forces; her father was a scribe. Her late brother was a celebrated Dragon Rider; her surviving sister, Mira, also a Dragon Rider, dotes on her.",
  personality: 'Quietly stubborn, sharp-tongued when scared, more comfortable with books than blades',
  motivation: "Prove she belongs in the Riders Quadrant despite everyone — including her own mother — expecting her to wash out or die",
  physicalTrait: "Hypermobile joints and a slight frame — strong grip and flexibility, but injures easily and can't out-muscle anyone",
  secret: "Keeps notes on every rider and professor's weaknesses — a scribe's habit she's not ready to give up",
  opening:
    "The tale starts the morning of Conscription Day, when Violet is forced by her commanding-general mother to enter the deadly Riders Quadrant instead of the peaceful Scribes Quadrant she trained for all her life. The story opens in her mother's office for a tense final physical assessment and uniform fitting, while Violet quietly panics over her frailty and hypermobile joints — a serious liability given how easily she can be injured. Her sister Mira protests and tries to press protective gear on her; Violet accepts the situation, binds her joints, and prepares to cross the parapet, a narrow stone bridge that kills applicants before they even reach the quadrant, all while aware her visible weakness makes her a target. The dive begins while Violet is still on her way to her mother's office, where Mira and her mother are already waiting.",
}
