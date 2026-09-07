import { useState } from 'react'
import {
  Copy,
  Check,
  RotateCcw,
  Sliders,
  X,
  ChevronDown,
  ChevronUp,
  Terminal,
  Move,
  Smartphone,
  Monitor,
} from 'lucide-react'
import type { NodeType } from './types.ts'
import type { WeaverCalibrationPreset } from './calibrationData.ts'

interface WeaverCalibratorProps {
  isDesktop: boolean
  calibration: WeaverCalibrationPreset
  onChange: (updated: WeaverCalibrationPreset) => void
  onReset: () => void
  onClose: () => void
  selectedNode: NodeType
  onSelectNode: (node: NodeType) => void
}

export default function WeaverCalibrator({
  isDesktop,
  calibration,
  onChange,
  onReset,
  onClose,
  selectedNode,
  onSelectNode,
}: WeaverCalibratorProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showJsonPreview, setShowJsonPreview] = useState(false)

  const activeValues = calibration[selectedNode]

  const updateParam = (param: 'left' | 'top' | 'diameter', delta: number) => {
    const current = activeValues[param]
    const nextVal = Math.max(1, Math.min(99, Math.round((current + delta) * 10) / 10))
    onChange({
      ...calibration,
      [selectedNode]: {
        ...activeValues,
        [param]: nextVal,
      },
    })
  }

  const setParamDirect = (param: 'left' | 'top' | 'diameter', value: number) => {
    const nextVal = Math.max(1, Math.min(99, Math.round(value * 10) / 10))
    onChange({
      ...calibration,
      [selectedNode]: {
        ...activeValues,
        [param]: nextVal,
      },
    })
  }

  const formattedJson = JSON.stringify(calibration, null, 2)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback if clipboard API is constrained in iframe
      console.log('TALE DIVES WEAVER CALIBRATION JSON:\n', formattedJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleLogConsole = () => {
    console.log(
      `%c[Tales Weaver Calibration] ${isDesktop ? 'DESKTOP' : 'MOBILE'}:`,
      'color: #f0ca65; font-weight: bold; font-size: 14px;'
    )
    console.log(calibration)
    console.log('Pasteable JSON Code:\n' + formattedJson)
  }

  const nodeColorThemes: Record<NodeType, { name: string; tag: string; border: string; bg: string }> = {
    protagonist: {
      name: 'Protagonist',
      tag: 'text-purple-300',
      border: 'border-purple-400',
      bg: 'bg-purple-950/80',
    },
    world: {
      name: 'World',
      tag: 'text-sky-300',
      border: 'border-sky-400',
      bg: 'bg-sky-950/80',
    },
    npcs: {
      name: 'NPCs',
      tag: 'text-emerald-300',
      border: 'border-emerald-400',
      bg: 'bg-emerald-950/80',
    },
    narrative: {
      name: 'Narrative',
      tag: 'text-amber-300',
      border: 'border-amber-400',
      bg: 'bg-amber-950/80',
    },
  }

  return (
    <div className="fixed z-50 bottom-4 right-4 max-w-[95vw] w-[340px] sm:w-[380px] bg-[#0c0914]/95 text-stone-200 border border-[#e8ca8a]/40 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl font-sans select-none overflow-hidden">
      {/* HUD Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sliders size={15} className="text-[#f0ca65]" />
          <span className="font-display font-bold text-xs tracking-wider text-[#fae5b5] uppercase">
            Weaver Calibrator
          </span>
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-stone-300 font-mono">
            {isDesktop ? <Monitor size={10} /> : <Smartphone size={10} />}
            {isDesktop ? 'PC (1366x768)' : 'Mobile (714x1270)'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-md text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-stone-400 hover:text-red-400 hover:bg-white/10 transition-colors"
            title="Close Calibrator"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-3 space-y-3 max-h-[75vh] overflow-y-auto">
          {/* Node Selector Tabs */}
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-black/50 rounded-xl border border-white/10">
            {(['protagonist', 'world', 'npcs', 'narrative'] as NodeType[]).map((node) => {
              const info = nodeColorThemes[node]
              const isSelected = selectedNode === node
              return (
                <button
                  key={node}
                  type="button"
                  onClick={() => onSelectNode(node)}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-display font-semibold tracking-wider transition-all text-center truncate ${
                    isSelected
                      ? `${info.bg} ${info.tag} border ${info.border} shadow-md`
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {info.name}
                </button>
              )
            })}
          </div>

          {/* Quick Tip / Instruction */}
          <div className="text-[11px] text-[#d8c49e]/80 bg-amber-950/25 border border-amber-500/20 rounded-lg p-2 flex items-start gap-1.5">
            <Move size={13} className="text-[#f0ca65] shrink-0 mt-0.5" />
            <span>
              <strong>Direct Drag:</strong> You can click & drag the circle directly on screen, or fine-tune with the step buttons below.
            </span>
          </div>

          {/* Param Controls for Selected Node */}
          <div className="space-y-2.5 bg-black/30 p-2.5 rounded-xl border border-white/5">
            {/* Left % (X coordinate) */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-stone-400">Position X (left %)</span>
                <span className="text-[#f0ca65] font-bold">{activeValues.left.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateParam('left', -1.0)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  -1.0
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('left', -0.1)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  -0.1
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={activeValues.left}
                  onChange={(e) => setParamDirect('left', parseFloat(e.target.value))}
                  className="flex-1 accent-[#f0ca65] h-1.5 bg-white/10 rounded cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => updateParam('left', +0.1)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  +0.1
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('left', +1.0)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  +1.0
                </button>
              </div>
            </div>

            {/* Top % (Y coordinate) */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-stone-400">Position Y (top %)</span>
                <span className="text-[#f0ca65] font-bold">{activeValues.top.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateParam('top', -1.0)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  -1.0
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('top', -0.1)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  -0.1
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={activeValues.top}
                  onChange={(e) => setParamDirect('top', parseFloat(e.target.value))}
                  className="flex-1 accent-[#f0ca65] h-1.5 bg-white/10 rounded cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => updateParam('top', +0.1)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  +0.1
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('top', +1.0)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  +1.0
                </button>
              </div>
            </div>

            {/* Diameter % */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-stone-400">Diameter (size %)</span>
                <span className="text-[#f0ca65] font-bold">{activeValues.diameter.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateParam('diameter', -1.0)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  -1.0
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('diameter', -0.1)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  -0.1
                </button>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="0.1"
                  value={activeValues.diameter}
                  onChange={(e) => setParamDirect('diameter', parseFloat(e.target.value))}
                  className="flex-1 accent-[#f0ca65] h-1.5 bg-white/10 rounded cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => updateParam('diameter', +0.1)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  +0.1
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('diameter', +1.0)}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                >
                  +1.0
                </button>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="py-2 px-3 rounded-xl bg-[#e8ca8a] text-black font-display font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-lg hover:bg-[#fae5b5] transition-colors cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-800" /> : <Copy size={14} />}
              <span>{copied ? 'COPIED!' : 'COPY CONFIG'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogConsole}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 font-display font-semibold text-xs tracking-wider flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
            >
              <Terminal size={14} className="text-[#f0ca65]" />
              <span>LOG CONSOLE</span>
            </button>
          </div>

          {/* Reset & Toggle Preview */}
          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px]">
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-red-300/80 hover:text-red-200 transition-colors"
            >
              <RotateCcw size={12} />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={() => setShowJsonPreview(!showJsonPreview)}
              className="text-[#d8c49e]/90 hover:text-white transition-colors underline"
            >
              {showJsonPreview ? 'Hide JSON Code' : 'View JSON Code'}
            </button>
          </div>

          {/* Collapsible JSON Preview */}
          {showJsonPreview && (
            <div className="mt-2 p-2 bg-black/80 rounded-lg border border-white/10 font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-36">
              <pre>{formattedJson}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
