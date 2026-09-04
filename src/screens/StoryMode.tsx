import { motion } from 'framer-motion'
import { Sparkles, BookOpen } from 'lucide-react'
import { GlassHeader, GlassScreen } from '../lib/glassChrome.tsx'

interface StoryModeProps {
  onBack: () => void
  onSelectOriginal: () => void
}

// §Phase A / §6.4B "Story Creation — Cards Row" — the entry point into
// campaign creation, split out as its own step so Original/Inspired reads as
// a real choice rather than an inline toggle buried inside World Setup.
//
// Sits on the cycling artwork, like the other three creation steps: building a
// story is a continuation of the front door, not a separate utility screen.
// Back moved into the shared header rather than its own bordered footer.
export default function StoryMode({ onBack, onSelectOriginal }: StoryModeProps) {
  return (
    <GlassScreen ground="art" fill>
      <GlassHeader title="Choose Your Story Mode" subtitle="How should this tale begin?" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full flex flex-col gap-4">
          <motion.button
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ y: -3 }}
            onClick={onSelectOriginal}
            className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
          >
            <span className="w-14 h-14 rounded-full border border-gold-accent/50 flex items-center justify-center text-gold-primary">
              <Sparkles size={26} />
            </span>
            <h3 className="font-display font-bold text-lg text-gold-primary">Original Mode</h3>
            <p className="font-narrative text-sm text-ink-muted">
              Build a world from scratch — genre, tone, conflict, and voice all yours to shape.
            </p>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
            className="glass-panel rounded-2xl p-6 flex flex-col items-center gap-3 text-center opacity-50"
          >
            <span className="w-14 h-14 rounded-full border border-gold-accent/30 flex items-center justify-center text-gold-primary/70">
              <BookOpen size={26} />
            </span>
            <h3 className="font-display font-bold text-lg text-gold-primary/80">Inspired Mode</h3>
            <p className="font-narrative text-sm text-ink-muted">Adapt a novel or series into a living Tale.</p>
            <span className="font-mono text-[10px] uppercase tracking-wide text-gold-primary/60">Coming soon</span>
          </motion.div>
        </div>
      </div>
    </GlassScreen>
  )
}
