import { Swords, Moon, Compass, Eye, MessageCircle, Heart, CloudFog, Sun, Pause } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TurnState } from '../types.ts'

// §4.3 9-Tier Turn State Matrix — icon mapping per §6.1b. `accent` is used
// as the per-entry left-accent/icon color in the Chronicle log, which renders
// on the parchment reading surface. A CSS custom property reference, not raw
// hex — TurnBlock (Chronicle.tsx) applies it as an inline style, so it needs
// to resolve differently on the dark chrome vs. the light parchment paper the
// same way --td-ink/--td-gold-primary/etc. already do (see index.css's
// .parchment-surface): the dark-tuned original hex values (light gold, light
// purple, cyan, ...) had poor contrast once actually read against cream
// paper. Each --td-state-* custom property is declared once for dark chrome
// (index.css's :root) and once, darkened, for parchment (.parchment-surface).
export const TURN_STATE_META: Record<TurnState, { icon: LucideIcon; label: string; accent: string }> = {
  PEACE: { icon: Sun, label: 'Peace', accent: 'var(--td-state-peace)' },
  COMBAT: { icon: Swords, label: 'Combat', accent: 'var(--td-state-combat)' },
  STEALTH: { icon: Moon, label: 'Stealth', accent: 'var(--td-state-stealth)' },
  DESPAIR: { icon: CloudFog, label: 'Despair', accent: 'var(--td-state-despair)' },
  EXPLORE: { icon: Compass, label: 'Explore', accent: 'var(--td-state-explore)' },
  INSIGHT: { icon: Eye, label: 'Insight', accent: 'var(--td-state-insight)' },
  SOCIAL: { icon: MessageCircle, label: 'Social', accent: 'var(--td-state-social)' },
  INTIMACY: { icon: Heart, label: 'Intimacy', accent: 'var(--td-state-intimacy)' },
  PAUSE: { icon: Pause, label: 'Paused', accent: 'var(--td-state-pause)' },
}
