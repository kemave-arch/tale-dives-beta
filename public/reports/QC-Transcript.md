# Tale Dives — Live QC Transcript

Fourth Wing / Violet Sorrengail test Tale. Real Gemini API calls (no mocking), driven directly through the app's own generation/parsing code via a Node harness (browser E2E was blocked in this sandbox by a proxy/TLS issue — see the accompanying report).

---

## Turn 0 — Prologue

**Model:** `gemini-3.5-flash` | **Parsed cleanly:** ❌ no — fell back to prose-only (see finding below)

> *(model's internal plan, never shown to the player)* — twist: Mira has already stolen custom-made dragon-scaled armor for Violet, anticipating their mother's refusal to back down, changing the nature of Violet's preparation from hopeless to survival-focused. distinct: General Lilith Sorrengail does not show anger or hatred; she treats Violet's potential death in the Riders Quadrant as a simple, cold equation of genetic expectation and family legacy.

**Narration:**

The scent of old parchment, dried ink, and beeswax always smelled like safety. 

For twenty years, Violet Sorrengail had structured her entire existence around that scent, believing her future lay within the quiet, dust-mote-speckled sunbeams of the {{Scribes Quadrant|faction}} archives. 

She adjusted her grip on the heavy canvas satchel slung over her shoulder. 

The strap bit into her collarbone, a dull, warning ache blossoming in her left shoulder where the joint always threatened to slip from its socket. 

Inside the bag were her treasures: history texts, rare maps, and carefully rolled scrolls—the tools of an apprentice scribe. 

She was ready for the quiet. 

She was ready for the books.

But as she reached the heavy, iron-studded oak doors of her mother’s office, the voices drifting through the heavy wood stopped her cold.

"She will die on the Parapet, Mother! She isn't built for this!"

Mira's voice was raw, stripped of its usual military composure. 

"She has spent her entire life reading books while the rest of us trained."

"Then she had better read quickly," 

General {{Lilith Sorrengail|npc}}’s voice was like ice shifting in a deep crevasse—devoid of anger, utterly flat, and terrifyingly absolute. 

"A Sorrengail does not crawl into the safety of the archives when the kingdom demands riders. 

Brennan did not hide. 

You did not hide. 

And Violet will not disgrace this family by hiding behind a desk."

'She is going to kill me.'

The thought crystallized in Violet's mind, cold and sharp as a dagger. 

She knew her own body's limits better than anyone—the fragile bones, the joints that gave way under the slightest strain, the silver-white ends of her hair that seemed to mock her lack of vitality. 

To the rest of the world, she was made of glass. 

To her mother, she was simply a soldier who hadn't been broken in yet.

Violet pushed the heavy door open, the iron hinges groaning in protest.

The office was vast, dominated by a massive stone hearth and a desk cluttered with tactical maps of the border war against {{Griffin Flyers of Poromiel|faction}}. 

Mira stood near the center of the room, her leather rider's armor gleaming, her face flushed with fury. 

Behind the desk sat the General, her spine perfectly straight, her uniform immaculate, looking at her youngest daughter not with hatred, but with a cold, calculating assessment.

"Violet," 

Mira said, turning quickly, her eyes wide with desperation. 

"Tell her. 

Tell her you're joining the Scribes today. 

Your papers are signed. 

You're ready."

Violet looked from her sister's fiercely protective gaze to her mother's unyielding, pale eyes. 

The canvas bag of books felt suddenly, mockingly heavy on her shoulder.

"The papers are shredded," 

General Sorrengail said quietly, not even looking up as she dipped a quill into black ink. 

"Your name has been entered into the rolls for the {{Riders Quadrant|faction}}. 

You go to the Conscription line today, Violet. 

Prove you have our blood in your veins, or let the rocks at the bottom of the valley claim you."

Mira let out a sharp, bitter laugh, stepping between Violet and their mother. 

"She won't even make it across {{The Parapet|loc}} in this wind, let alone survive the first week of combat! 

If you won't help her, I will." 

Mira reached down to a leather pack she had dropped by the door, pulling out a dark, shimmering tunic made of supple, overlapping dragon scales. 

"I had this made from my own dragon's shed scales. 

It's lightweight. 

It will protect her from blades."

"She wears what she is given, Mira," 

the General warned, her quill pausing.

"She wears what keeps her alive," 

Mira shot back, turning to Violet and holding out the custom armor, her eyes pleading. 

"Put it on, Vi. 

Now. 

Before we walk out of here."

Violet stood at the threshold of her destroyed future, the weight of her father's censored histories heavy in her mind, and the lethal reality of the Riders Quadrant looming just outside the castle walls.


**Mechanical updates:** none applied — the `<sync>` block failed to parse this turn (see Finding #3 in the main report).

---

## Turn 1

**Model:** `gemini-3.5-flash` | **Parsed cleanly:** ✅ yes

**Player action:** I steady my breathing and look around the conscription grounds, taking in who else is here before I have to move.

> *(model's internal plan, never shown to the player)* — twist: Her mother's office door isn't fully latched, allowing the bitter, private argument between Mira and Lilith to spill directly into the hallway where Violet stands, exposing her mother's absolute, cold refusal to let her survive as a "weak" Scribe. distinct: General Lilith Sorrengail is not merely angry; she is clinically detached, treating her daughter's survival potential like a logistics report, while Mira's protective fury makes her physically tremble.

**Narration:**

The stone corridors of the military wing at {{Basgiath War College|loc}} are drafty, smelling of cold slate, dried ink, and the distant, sulfurous tang of dragonfire drifting from the high peaks. 

Violet Sorrengail shifted the heavy canvas satchel on her shoulder, the thick canvas strap cutting mercilessly into her collarbone. 
Inside, the weight of her life—carefully preserved historical scrolls, reference books on military tactics, and her late father's personal journals—clinked softly. 
Her knee gave a tiny, warning pop as she adjusted her weight, a familiar, dull ache blooming in her left joint. 
She ignored it, drawing a slow breath through her nose, steadying her pulse.

She had spent her entire nineteen years preparing for the quiet sanctuary of the {{Scribes Quadrant|faction}}. 
She knew the archives. 
She knew the smell of old vellum and the peaceful, rhythmic scratch of quills. 
But today was Conscription Day, and instead of entering the quiet halls of the historians, she had been summoned to the high tower office of the General.

Her mother.

As Violet approached the heavy oak door adorned with the double-headed dragon crest of Navarre, she realized it wasn't fully closed. 
A thin sliver of warm candlelight sliced through the gap, carrying with it the sharp, heated cadence of a voice she knew instantly.

"She will not survive the first week, Mother! Look at her! Her bones are like glass. The first run on the turret will snap her ankle, and if she even makes it to the Parapet, the wind will blow her off the edge!"

That was {{Mira Sorrengail|npc}}. 
Her older sister's voice was ragged with a rare, desperate panic. 

"She is a Sorrengail,"
their mother's voice cut through the air, smooth and hard as polished obsidian. 
{{General Lilith Sorrengail|npc}} did not raise her voice; she never had to. 
"A Sorrengail does not hide in the dust of the archives while her siblings bleed for the kingdom. Brennan gave his life. Mira, you have earned your spurs. Violet will enter the {{Riders Quadrant|faction}}, or she will die trying. I will not have a coward for a daughter."

Violet froze in the hallway, her fingers tightening around the strap of her satchel until her knuckles turned a stark, bloodless white. 
The betrayal was a physical blow, cold and sharp, settling deep into her chest. 
She had no choice. 
The mandate had been signed in her mother's unyielding black ink.

Through the high arched windows of the corridor, she could look down upon the conscription grounds below. 
A sea of hundreds of hopeful cadets, dressed in various states of leather armor and heavy boots, milled about the courtyard. 
Some looked terrified, clutching family heirlooms. 
Others paced like caged animals, their eyes scanning the high stone walls of the fortress with a desperate, hungry ambition. 

They were strong. 
They were whole. 
And she was standing there with protective linen wraps beneath her tunic just to keep her shoulders from slipping out of their sockets.

But as Violet looked down at the courtyard, her analytical mind began to catalog the details. 
She noticed the slight wear on the boots of the peasants from the southern provinces, the rigid, arrogant postures of the officers' children, and the nervous sweat glistening on the necks of those who wouldn't survive the first drop. 
She might be fragile, but she was not stupid. 
If she was going to be forced into the meat grinder of the riders, she would have to use every scrap of history, strategy, and observation her father had ever taught her to stay alive.

She let go of her satchel strap, smoothed down the front of her simple scribe's tunic, and pushed the heavy oak door open.

'Let them see me look.'
she thought, her jaw setting in that quiet, stubborn line her father always recognized. 
'Let them see exactly what they are trying to break.'


**Mechanical updates applied this turn:**

- turn_state=PEACE
- quest_update={'quest_id': 'survive_conscription', 'status': 'advanced', 'type': 'main', 'note': 'Violet has been ordered by her mother to enter the Riders Quadrant instead of the Scribes.', 'description': 'Survive Conscription Day and the deadly trials of entering the Riders Quadrant.'}
- beat_update={'beat_id': 'chapter_1_the_generals_mandate', 'status': 'active'}
- npc_mem_up for: ['mira_sorrengail', 'lilith_sorrengail']
- fac_rep=[{'faction_id': 'navarre_military_leadership', 'delta': -1}]

---

## Turn 2

**Model:** `gemini-3.5-flash-lite` | **Parsed cleanly:** ✅ yes

**Player action:** I look for Mira in the crowd and ask her, quietly, what she knows about the Parapet crossing that she isn't telling me.

> *(model's internal plan, never shown to the player)* — twist: Mira doesn't offer comforting reassurances or sugarcoat the danger; instead, she coldly forces Violet to look at a cadet who has already fallen or been turned away, grounding the horror of the parapet in immediate, unyielding reality. distinct: Mira's interaction is defined by her fierce, overprotective desperation masking profound terror for Violet's survival, showing her hands trembling despite her hardened, veteran posture.

**Narration:**

The courtyard of Basgiath War College heaves with the nervous, adrenaline-soaked energy of hundreds of conscripts, the air sharp with the scent of wet wool, damp earth, and the raw, metallic tang of fear. 

{{Violet Sorrengail}} weaves through the press of armored bodies, her slight frame slipping past broad-shouldered candidates who already look like they were carved from granite. 

She spots her sister near the western archway, standing apart from the milling masses with the unmistakable, lethal ease of a second-year rider who has survived a year of bloodshed.

{{Mira Sorrengail|npc}} leans against a damp stone pillar, her leather riding leathers scuffed and travel-stained, her dark hair pulled back into a tight, utilitarian braid that emphasizes the hard angles of her jaw. 

When Violet approaches and asks her question, the older sister’s gaze snaps down, instantly sharp, fierce, and entirely devoid of sisterly warmth. 

Mira reaches out with surprising speed, grabbing Violet by the elbow of her tunic and yanking her behind the shelter of a thick buttress, out of earshot of the patrolling squad leaders.

"You think Mother sent you here to die, Violet, and you're right," Mira whispers, her voice rough, stripped of any comforting platitudes as she leans in close enough that Violet can smell the stale coffee and cold wind on her breath. 

Her fingers dig hard into Violet's arm, trembling ever so slightly—a telltale sign of exhaustion and terror that Mira instantly tries to mask by tightening her grip.

"They don't teach you how to cross [[The Parapet|loc]] because there is no technique that saves a brittle bone when the wind hits fifty knots," Mira continues, her eyes scanning the churning grey clouds above the citadel with bitter contempt. 

"What I’m not telling you is that the stone is slick with grease before dawn, that forty percent of our squad didn't make it across last year, and that if you freeze up halfway across, no one is turning back for you. Not Dain. Not the wingleaders. No one."

She drops her hand, stepping back slightly to let her gaze rake over Violet's delicate stature, lingering for a fraction of a second on the protective leather bindings wrapped carefully around Violet's fragile wrists and joints. 

"If you fall, I won't be able to catch you from the valley floor," Mira says, her voice dropping to a harsh, resonant undertone that brooks no argument. 

"So listen to me, and listen well: don't look down at the drop, keep your center of gravity low, and if your hips decide to slip out of their sockets halfway across, you damn well force them back into place with sheer spite. Am I understood?"

Before Violet can formulate a reply, the heavy bronze war-gongs of the citadel begin to toll, echoing across the basalt courtyard and signaling the mandatory assembly for the lethal trials ahead. 

Cadets around them stiffen, breaking off conversations as the iron-shod boots of the leadership march toward the staging grounds, drawing every eye upward toward the narrow, mist-shrouded stone bridge that spans the dizzying chasm.


**Mechanical updates applied this turn:**

- turn_state=PEACE
- beat_update={'beat_id': 'beat_ch1_conscription', 'status': 'active'}
- npc_mem_up for: ['mira_sorrengail']

---

## Turn 3 (narrative *override* test)

**Model:** `gemini-3.5-flash-lite` | **Parsed cleanly:** ✅ yes

**Player action:** *a hidden letter from my late father falls out of one of my books, addressed to me*

> *(model's internal plan, never shown to the player)* — twist: Instead of finding a weapon or a protective charm, the object from her books is a piece of home—a private, contraband historical letter that changes her understanding of the very fortress she's standing in. distinct: Violet reacts not with shock at the magic of the moment, but with immediate, tactical paranoia, quickly concealing the parchment against her ribs before anyone—especially Dain or an eagle-eyed squad leader—catches sight of the forbidden script.

**Narration:**

The heavy parchment slips free from the reinforced spine of an old military history compendium just as {{Violet Sorrengail}} adjusts her leather shoulder bindings. 

It flutters down against the damp cobblestones of {{The Parapet|loc}}, catching the howling morning wind before Violet lunges forward with a sharp, synchronized gasp, pinning it beneath her palm against her thigh.

Her heart hammers against her ribs as she glances around in a panic. 

Around her, cadets are buckling helms and checking daggers, too absorbed in their own terror to notice a fluttering page, but the cold weight of the discovery settles heavily in her stomach. 

She pulls the folded paper close to her chest, her fingers trembling slightly as she slides it inside the inner pocket of her tunic, right against the protective leather wrapping of her ribs.

When she steals a glance at the paper's edge, she recognizes the sharp, meticulous ink strokes immediately. 

It is her late father’s handwriting—unmistakable, precise, and entirely forbidden by the edicts of {{Navarre Military Leadership|faction}}.

'They are hiding the rot at the edges, Violet,' the first visible line whispers from the dark ink, etched into her memory before she folds it tighter. 

'The wards are failing not because of weather, but because the source is being starved. If you are reading this in the Quadrant, your mother has condemned you to the front lines to silence what we discovered in the archives.'

The cold realization strikes harder than the mountain wind howling across the chasm. 

Her father hadn't just studied history; he had mapped its fractures, leaving her a compass built of truths that the {{Scribes Quadrant|loc}} would execute her for possessing.

Footsteps crunch heavily on the gravel nearby, and {{Dain Aetos|npc}} steps into her field of vision, his protective armor gleaming with polish and his jaw set in a hard, uncompromising line of childhood familiarity and sudden, overbearing authority.

"Violet," Dain calls out, his voice cutting through the rising gale as he stops before her, his eyes scanning her fragile frame with an expression that mixes deep affection with abrasive disapproval. 

"You shouldn't even be holding a book out here today, let alone carrying papers from the archives. The first detachment is moving out to {{The Parapet|loc}} in two minutes. Pull your leathers tighter and stay directly behind me on the stone. I'll make sure you don't fall."


**Mechanical updates applied this turn:**

- turn_state=PEACE
- beat_update={'beat_id': 'beat_ch1_conscription', 'status': 'completed'}
- npc_mem_up for: ['dain_aetos']

---

## Turn 4

**Model:** `gemini-3.5-flash-lite` | **Parsed cleanly:** ✅ yes

**Player action:** I take a slow breath and step toward the line for the Riders Quadrant, refusing to let my hands shake.

> *(model's internal plan, never shown to the player)* — twist: Dain attempts to physically block Violet from stepping onto the bridge to protect her, forcing her to publicly defy him to even begin the trial. distinct: Dain's overprotective paternalism isn't just annoying; it treats her like glass in a way that infuriates her analytical independence, while the rest of the waiting line looks on with cruel, indifferent amusement.

**Narration:**

The breath catches in {{Violet Sorrengail}}’s throat, a cold, sharp pinch of winter air that she forces down into her lungs with absolute, deliberate control. 

She tucks her father’s folded letter deeper into her tunic, her fingers curling into tight fists inside her leather bracers to steady the tremor in her hands. 

Around her, the murmurs of the courtyard fade into the deafening roar of the mountain wind slamming against the sheer basalt cliffs of {{The Parapet|loc}}.

"Violet, wait—don't be an idiot," {{Dain Aetos|npc}} snaps, his hand shooting out to catch her by the shoulder, his grip heavy, familiar, and suffocatingly protective. 

"You can't do this. I told your mother I’d watch out for you, and I won't let you throw your life away on a stunt. Step back in line with the Scribes."

Violet doesn't flinch, though the pressure of his hand sends a dull, familiar ache radiating through her collarbone. 

She turns her head slowly, fixing Dain with a gaze as hard and unyielding as flint, her voice dropping into a quiet, icy cadence that brooks no debate.

"Remove your hand, Dain," she says, her tone slicing through the gale with crystalline precision. 

"If [[General Lilith Sorrengail|npc]] wants me dead, she'll have to watch me walk across that stone on my own two feet. I am not hiding in the archives."

Dain’s jaw tightens, his hazel eyes flashing with a mix of disbelief, anger, and helpless frustration as he slowly drops his hand, realizing too late that his overbearing interference only stokes her stubborn fire. 

He steps back, shaking his head in silent condemnation just as the squad leader at the head of the formation bellows the order to advance.

Violet squares her shoulders, ignoring the speculative, mocking stares of the armored cadets pressing in around her. 

She steps past Dain, her boots meeting the ancient, frost-slicked stone of [[The Parapet|loc]] for the very first time. 

The wind hits her instantly, a roaring, invisible wall of force that threatens to sweep her off balance before she has even taken a second step. 

Below her, the sheer drop into the mist-choked valley yawns wide, an abyss of jagged grey rock and whistling emptiness that demands absolute perfection from every step.


**Mechanical updates applied this turn:**

- turn_state=EXPLORE
- beat_update={'beat_id': 'beat_ch2_parapet', 'status': 'active'}
- npc_mem_up for: ['dain_aetos']

---
