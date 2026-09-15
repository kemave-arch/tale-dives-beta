import { motion } from 'framer-motion'
import { BookOpen, Zap } from 'lucide-react'
import { GlassHeader, GlassScreen } from '../lib/glassChrome.tsx'

interface StoryModeProps {
  onBack: () => void
  onSelectInspired: () => void
  onSelectQuickPlay: () => void
}

// §Phase A / §6.4B "Story Creation — Cards Row" — the entry point into
// campaign creation, split out as its own step so the choice of how a tale
// begins reads as a real decision rather than an inline toggle buried inside
// World Setup. Original Mode (the old hand-typed-forms path) was retired
// once Inspired Mode and Quick Play covered its ground robustly enough that
// keeping a third, less-guided option around no longer earned its keep.
//
// Sits on the cycling artwork, like the other three creation steps: building a
// story is a continuation of the front door, not a separate utility screen.
// Back moved into the shared header rather than its own bordered footer.
export default function StoryMode({ onBack, onSelectInspired, onSelectQuickPlay }: StoryModeProps) {
  return (
    <GlassScreen ground="art" fill>
      <GlassHeader title="Choose Your Story Mode" subtitle="How should this tale begin?" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full flex flex-col gap-4">
          <motion.button
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
            whileHover={{ y: -3 }}
            onClick={onSelectInspired}
            className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
          >
            <span className="w-14 h-14 rounded-full border border-gold-accent/50 flex items-center justify-center text-gold-primary">
              <BookOpen size={26} />
            </span>
            <h3 className="font-display font-bold text-lg text-gold-primary">Inspired Mode</h3>
            <p className="font-narrative text-sm text-ink-muted">
              Weave a world in conversation — describe it phase by phase and watch it take shape.
            </p>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.16 }}
            whileHover={{ y: -3 }}
            onClick={onSelectQuickPlay}
            className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col items-center gap-3 text-center relative"
          >
            <span className="absolute top-3 right-3 font-mono text-[9px] uppercase tracking-wider text-gold-primary/80 border border-gold-accent/40 rounded-full px-2 py-0.5">
              ★ Recommended
            </span>
            <span className="w-14 h-14 rounded-full border border-gold-accent/50 flex items-center justify-center text-gold-primary">
              <Zap size={26} />
            </span>
            <h3 className="font-display font-bold text-lg text-gold-primary">Quick Play</h3>
            <p className="font-narrative text-sm text-ink-muted">
              Three questions — your realm, your hero, your entry into the tale — and the Tale Weaver does the rest.
            </p>
          </motion.button>
        </div>
      </div>
    </GlassScreen>
  )
}
