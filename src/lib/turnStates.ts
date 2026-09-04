import { Swords, Moon, Compass, Eye, MessageCircle, Heart, CloudFog, Sun, Pause } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TurnState } from '../types.ts'

// §4.3 9-Tier Turn State Matrix — icon mapping per §6.1b. `accent` is used
// both as the per-entry left-accent/icon color in the Chronicle log AND,
// per the user's explicit request, as a live retint of the surrounding
// chrome (header, input bar, window frame, ambient motes) in Chronicle.tsx —
// the parchment reading surface itself is deliberately left alone so mood
// lighting never competes with prose readability.
export const TURN_STATE_META: Record<TurnState, { icon: LucideIcon; label: string; accent: string }> = {
  PEACE: { icon: Sun, label: 'Peace', accent: '#fcd34d' }, // light gold
  COMBAT: { icon: Swords, label: 'Combat', accent: '#991b1b' }, // dark red
  STEALTH: { icon: Moon, label: 'Stealth', accent: '#a78bfa' }, // light purple
  DESPAIR: { icon: CloudFog, label: 'Despair', accent: '#4f46e5' }, // indigo
  EXPLORE: { icon: Compass, label: 'Explore', accent: '#10b981' }, // emerald
  INSIGHT: { icon: Eye, label: 'Insight', accent: '#06b6d4' }, // cyan
  SOCIAL: { icon: MessageCircle, label: 'Social', accent: '#f43f5e' }, // rose pink
  INTIMACY: { icon: Heart, label: 'Intimacy', accent: '#ec4899' }, // pink
  PAUSE: { icon: Pause, label: 'Paused', accent: '#78716c' }, // grey
}
