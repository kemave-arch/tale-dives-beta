import { useState, useEffect, useCallback } from 'react'
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
  Crosshair,
  Layers,
  Sparkles,
  Info,
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

interface InspectedElementInfo {
  tag: string
  id: string
  className: string
  componentName: string
  selector: string
  rect: {
    x: number
    y: number
    top: number
    left: number
    bottom: number
    right: number
    width: number
    height: number
  }
  viewportRelative: {
    leftPct: string
    topPct: string
    bottomPx: number
    bottomPct: string
    rightPx: number
    rightPct: string
    widthPct: string
    heightPct: string
  }
  styles: {
    position: string
    zIndex: string
    transform: string
    opacity: string
  }
}

interface LayerStackItem {
  element: HTMLElement
  label: string
  tag: string
  id: string
  zIndex: string
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
  // Mode selection: 'nodes' (Seedweaver node circles) or 'element' (Full UI Element & Layer Inspector)
  const [activeTab, setActiveTab] = useState<'nodes' | 'element'>('nodes')
  const [isMinimized, setIsMinimized] = useState(false)
  const [copiedType, setCopiedType] = useState<string | null>(null)
  const [showJsonPreview, setShowJsonPreview] = useState(false)

  // ==========================================
  // ELEMENT INSPECTOR STATE
  // ==========================================
  const [isPickerActive, setIsPickerActive] = useState(false)
  const [inspectedElement, setInspectedElement] = useState<HTMLElement | null>(null)
  const [layerStack, setLayerStack] = useState<LayerStackItem[]>([])
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(0)
  const [inspectedInfo, setInspectedInfo] = useState<InspectedElementInfo | null>(null)

  // Live offset adjustment for testing positions
  const [offsetNudge, setOffsetNudge] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const activeValues = calibration[selectedNode]

  // Copy with animation helper
  const triggerCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedType(type)
      setTimeout(() => setCopiedType(null), 2000)
    } catch {
      console.log(`[TALE DIVES DEBUG COPIED - ${type}]:\n`, text)
      setCopiedType(type)
      setTimeout(() => setCopiedType(null), 2000)
    }
  }

  // ==========================================
  // 1. SEEDWEAVER NODE CALIBRATION LOGIC
  // ==========================================
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

  const handleLogConsole = () => {
    console.log(
      `%c[Tales Weaver Calibration] ${isDesktop ? 'DESKTOP' : 'MOBILE'}:`,
      'color: #f0ca65; font-weight: bold; font-size: 14px;'
    )
    console.log(calibration)
    console.log('Pasteable JSON Code:\n' + formattedJson)
  }

  // ==========================================
  // 2. UI ELEMENT & LAYER INSPECTOR LOGIC
  // ==========================================
  const getComponentName = (el: HTMLElement): string => {
    if (el.dataset?.component) return `<${el.dataset.component}>`
    if (el.id === 'seedweaver-dive-in-container' || el.closest('#seedweaver-dive-in-container'))
      return '<GlassCTAButton> ("DIVE IN")'
    if (el.closest('header')) return '<GlassHeader / WeaverHeader>'
    if (el.tagName.toLowerCase() === 'button') return `<Button: ${el.innerText.trim().slice(0, 18)}>`
    if (el.id) return `#${el.id}`
    return `<${el.tagName.toLowerCase()}>`
  }

  const getElementSelector = (el: HTMLElement): string => {
    if (el.id) return `#${el.id}`
    const classes = Array.from(el.classList).filter((c) => !c.startsWith('taledives-inspect-')).slice(0, 3)
    const classStr = classes.length > 0 ? `.${classes.join('.')}` : ''
    return `${el.tagName.toLowerCase()}${classStr}`
  }

  const analyzeElement = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    const computed = window.getComputedStyle(el)

    const info: InspectedElementInfo = {
      tag: el.tagName.toLowerCase(),
      id: el.id,
      className: el.className,
      componentName: getComponentName(el),
      selector: getElementSelector(el),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        bottom: Math.round(rect.bottom),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      viewportRelative: {
        leftPct: ((rect.left / vw) * 100).toFixed(1) + '%',
        topPct: ((rect.top / vh) * 100).toFixed(1) + '%',
        bottomPx: Math.round(vh - rect.bottom),
        bottomPct: (((vh - rect.bottom) / vh) * 100).toFixed(1) + '%',
        rightPx: Math.round(vw - rect.right),
        rightPct: (((vw - rect.right) / vw) * 100).toFixed(1) + '%',
        widthPct: ((rect.width / vw) * 100).toFixed(1) + '%',
        heightPct: ((rect.height / vh) * 100).toFixed(1) + '%',
      },
      styles: {
        position: computed.position,
        zIndex: computed.zIndex === 'auto' ? '0' : computed.zIndex,
        transform: computed.transform,
        opacity: computed.opacity,
      },
    }

    setInspectedInfo(info)
  }, [])

  // Build layer stack from clicked coordinates
  const selectElementWithLayers = useCallback(
    (target: HTMLElement, clientX?: number, clientY?: number) => {
      // Find all overlapping elements at point if coordinates provided, else trace parent tree
      let elements: HTMLElement[] = []
      if (clientX !== undefined && clientY !== undefined) {
        const atPoint = document.elementsFromPoint(clientX, clientY) as HTMLElement[]
        elements = atPoint.filter(
          (e) => !e.closest('.taledives-calibrator-hud') && e.tagName.toLowerCase() !== 'html' && e.tagName.toLowerCase() !== 'body'
        )
      }

      if (elements.length === 0) {
        // Fallback: build upwards through parent tree
        let curr: HTMLElement | null = target
        while (curr && curr.tagName.toLowerCase() !== 'body' && !curr.classList.contains('taledives-calibrator-hud')) {
          elements.push(curr)
          curr = curr.parentElement
        }
      }

      const stack: LayerStackItem[] = elements.map((e, idx) => {
        const computed = window.getComputedStyle(e)
        return {
          element: e,
          label: getComponentName(e),
          tag: e.tagName.toLowerCase(),
          id: e.id,
          zIndex: computed.zIndex === 'auto' ? `layer-${idx}` : `z:${computed.zIndex}`,
        }
      })

      setLayerStack(stack)
      setSelectedLayerIndex(0)
      setInspectedElement(target)
      setOffsetNudge({ x: 0, y: 0 })
      analyzeElement(target)
    },
    [analyzeElement]
  )

  // Handle layer stack selection change
  const handleSelectLayer = (index: number) => {
    setSelectedLayerIndex(index)
    const item = layerStack[index]
    if (item && item.element) {
      setInspectedElement(item.element)
      setOffsetNudge({ x: 0, y: 0 })
      analyzeElement(item.element)
    }
  }

  // Live offset application to inspected element
  const applyNudge = (deltaX: number, deltaY: number) => {
    if (!inspectedElement) return
    const newX = offsetNudge.x + deltaX
    const newY = offsetNudge.y + deltaY
    setOffsetNudge({ x: newX, y: newY })
    inspectedElement.style.transform = `translate(${newX}px, ${newY}px)`
    analyzeElement(inspectedElement)
  }

  const resetNudge = () => {
    if (inspectedElement) {
      inspectedElement.style.transform = ''
    }
    setOffsetNudge({ x: 0, y: 0 })
    if (inspectedElement) {
      analyzeElement(inspectedElement)
    }
  }

  // Click-to-inspect global event listeners
  useEffect(() => {
    if (!isPickerActive) return

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.taledives-calibrator-hud')) return
      target.style.outline = '2px dashed #f0ca65'
      target.style.outlineOffset = '2px'
      target.style.cursor = 'crosshair'
    }

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.taledives-calibrator-hud')) return
      target.style.outline = ''
      target.style.outlineOffset = ''
      target.style.cursor = ''
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.taledives-calibrator-hud')) return

      e.preventDefault()
      e.stopPropagation()

      target.style.outline = ''
      target.style.outlineOffset = ''
      target.style.cursor = ''

      selectElementWithLayers(target, e.clientX, e.clientY)
      setIsPickerActive(false)
    }

    document.addEventListener('mouseover', handleMouseOver, true)
    document.addEventListener('mouseout', handleMouseOut, true)
    document.addEventListener('click', handleClick, true)

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true)
      document.removeEventListener('mouseout', handleMouseOut, true)
      document.removeEventListener('click', handleClick, true)
    }
  }, [isPickerActive, selectElementWithLayers])

  // Cleanup transforms on unmount
  useEffect(() => {
    return () => {
      if (inspectedElement) {
        inspectedElement.style.transform = ''
      }
    }
  }, [inspectedElement])

  // Quick preset element selector
  const handleQuickSelect = (selectorId: string) => {
    const el = document.querySelector(selectorId) as HTMLElement
    if (el) {
      selectElementWithLayers(el)
    }
  }

  // Generate full markdown debug report for the AI assistant
  const generateDebugReport = (): string => {
    if (!inspectedInfo) return 'No element selected.'
    const vw = window.innerWidth
    const vh = window.innerHeight

    return `[TALE DIVES UI POSITION REPORT]
- Viewport / Mode: ${isDesktop ? 'DESKTOP / PC' : 'MOBILE'} (${vw}px × ${vh}px)
- Component Identifier: ${inspectedInfo.componentName}
- Target Selector: ${inspectedInfo.selector}
- Layer Depth: ${selectedLayerIndex + 1} of ${layerStack.length} (z-index: ${inspectedInfo.styles.zIndex})
- Current Bounding Box: { left: ${inspectedInfo.rect.left}px (${inspectedInfo.viewportRelative.leftPct}), top: ${inspectedInfo.rect.top}px (${inspectedInfo.viewportRelative.topPct}), width: ${inspectedInfo.rect.width}px, height: ${inspectedInfo.rect.height}px }
- Distance from Bottom: ${inspectedInfo.viewportRelative.bottomPx}px (${inspectedInfo.viewportRelative.bottomPct})
- Distance from Right: ${inspectedInfo.viewportRelative.rightPx}px (${inspectedInfo.viewportRelative.rightPct})
${
  offsetNudge.x !== 0 || offsetNudge.y !== 0
    ? `- Calibrated Desired Offset: { deltaX: ${offsetNudge.x}px, deltaY: ${offsetNudge.y}px (Calibrated Bottom: ${inspectedInfo.viewportRelative.bottomPx - offsetNudge.y}px) }`
    : '- Calibrated Desired Offset: None (Default position)'
}`
  }

  const generateQuickPosition = (): string => {
    if (!inspectedInfo) return ''
    return `bottom: ${inspectedInfo.viewportRelative.bottomPx}px (${inspectedInfo.viewportRelative.bottomPct}), left: ${inspectedInfo.viewportRelative.leftPct}`
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
    <div className="taledives-calibrator-hud fixed z-50 bottom-4 right-4 max-w-[95vw] w-[350px] sm:w-[390px] bg-[#0c0914]/95 text-stone-200 border border-[#e8ca8a]/40 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.85)] backdrop-blur-xl font-sans select-none overflow-hidden">
      {/* HUD Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-black/50 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sliders size={15} className="text-[#f0ca65]" />
          <span className="font-display font-bold text-xs tracking-wider text-[#fae5b5] uppercase">
            Weaver Calibrator & Inspector
          </span>
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-stone-300 font-mono">
            {isDesktop ? <Monitor size={10} /> : <Smartphone size={10} />}
            {isDesktop ? 'PC' : 'Mobile'}
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
        <div className="p-3 space-y-3 max-h-[78vh] overflow-y-auto">
          {/* Main Mode Toggle Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/60 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('nodes')}
              className={`py-1.5 px-2 rounded-lg text-xs font-display font-semibold tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'nodes'
                  ? 'bg-[#e8ca8a] text-black shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Sparkles size={13} />
              <span>Seed Nodes</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('element')}
              className={`py-1.5 px-2 rounded-lg text-xs font-display font-semibold tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'element'
                  ? 'bg-[#f0ca65] text-black shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Crosshair size={13} />
              <span>UI Element & Layer</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: SEEDWEAVER NODE CALIBRATION                                        */}
          {/* ========================================================================= */}
          {activeTab === 'nodes' && (
            <div className="space-y-3">
              {/* Node Selector Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded-xl border border-white/10">
                {(['protagonist', 'world', 'npcs', 'narrative'] as NodeType[]).map((node) => {
                  const info = nodeColorThemes[node]
                  const isSelected = selectedNode === node
                  return (
                    <button
                      key={node}
                      type="button"
                      onClick={() => onSelectNode(node)}
                      className={`py-1 px-1 rounded-lg text-[10px] sm:text-[11px] font-display font-semibold tracking-wider transition-all text-center truncate ${
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
                  <strong>Drag & Fine-Tune:</strong> Click and drag node circles directly on the canvas or step below.
                </span>
              </div>

              {/* Param Controls for Selected Node */}
              <div className="space-y-2 bg-black/30 p-2.5 rounded-xl border border-white/5">
                {/* Left % */}
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
                      onClick={() => updateParam('left', +1.0)}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/15 border border-white/10 rounded"
                    >
                      +1.0
                    </button>
                  </div>
                </div>

                {/* Top % */}
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
                  onClick={() => triggerCopy(formattedJson, 'nodes-json')}
                  className="py-2 px-3 rounded-xl bg-[#e8ca8a] text-black font-display font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-lg hover:bg-[#fae5b5] transition-colors cursor-pointer"
                >
                  {copiedType === 'nodes-json' ? <Check size={14} className="text-emerald-800" /> : <Copy size={14} />}
                  <span>{copiedType === 'nodes-json' ? 'COPIED!' : 'COPY PRESET'}</span>
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

              {showJsonPreview && (
                <div className="mt-2 p-2 bg-black/80 rounded-lg border border-white/10 font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-32">
                  <pre>{formattedJson}</pre>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: GENERAL UI ELEMENT & LAYER INSPECTOR                               */}
          {/* ========================================================================= */}
          {activeTab === 'element' && (
            <div className="space-y-3">
              {/* Pick / Inspect Activator & Quick Selectors */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsPickerActive(!isPickerActive)}
                  className={`w-full py-2.5 px-3 rounded-xl font-display font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isPickerActive
                      ? 'bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse'
                      : 'bg-white/10 hover:bg-white/20 text-[#fae5b5] border border-[#f0ca65]/40'
                  }`}
                >
                  <Crosshair size={15} />
                  <span>{isPickerActive ? 'CLICK ANY ELEMENT ON SCREEN...' : 'CLICK TO INSPECT ON-SCREEN ELEMENT'}</span>
                </button>

                {/* Quick Target Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
                  <span className="text-stone-400 shrink-0 font-mono">Quick:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickSelect('#seedweaver-dive-in-container')}
                    className="px-2 py-0.5 rounded bg-black/50 border border-white/10 hover:border-[#f0ca65] text-[#fae5b5] font-mono shrink-0 cursor-pointer"
                  >
                    DIVE IN Button
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSelect('header')}
                    className="px-2 py-0.5 rounded bg-black/50 border border-white/10 hover:border-[#f0ca65] text-stone-300 font-mono shrink-0 cursor-pointer"
                  >
                    Header HUD
                  </button>
                </div>
              </div>

              {/* Inspected Element Details Card */}
              {inspectedInfo ? (
                <div className="space-y-2.5 bg-black/40 p-2.5 rounded-xl border border-white/10">
                  {/* Layer Stack Selector */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-stone-400 flex items-center gap-1">
                        <Layers size={12} className="text-[#f0ca65]" />
                        <span>Layer Stack ({layerStack.length} items):</span>
                      </span>
                      <span className="text-[10px] text-[#f0ca65] font-mono">
                        z-index: {inspectedInfo.styles.zIndex}
                      </span>
                    </div>

                    <select
                      value={selectedLayerIndex}
                      onChange={(e) => handleSelectLayer(parseInt(e.target.value, 10))}
                      className="w-full bg-[#1b122e] border border-[#f0ca65]/40 text-xs font-mono text-[#fae5b5] rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                    >
                      {layerStack.map((item, idx) => (
                        <option key={idx} value={idx}>
                          {idx === 0 ? '★ Topmost: ' : `Layer ${idx + 1}: `}
                          {item.label} [{item.zIndex}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Component Name & Selector */}
                  <div className="bg-black/60 p-2 rounded-lg border border-white/5 space-y-1 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#f0ca65] font-bold">{inspectedInfo.componentName}</span>
                      <span className="text-[10px] text-stone-400">
                        {inspectedInfo.styles.position}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-300 truncate">
                      {inspectedInfo.selector}
                    </div>
                  </div>

                  {/* Real-Time Position Metrics Grid */}
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                    <div className="bg-white/5 p-1.5 rounded border border-white/5">
                      <span className="text-stone-400 text-[10px] block">Bottom Offset</span>
                      <span className="text-[#f0ca65] font-bold">
                        {inspectedInfo.viewportRelative.bottomPx}px ({inspectedInfo.viewportRelative.bottomPct})
                      </span>
                    </div>
                    <div className="bg-white/5 p-1.5 rounded border border-white/5">
                      <span className="text-stone-400 text-[10px] block">Left Position</span>
                      <span className="text-stone-200 font-bold">
                        {inspectedInfo.rect.left}px ({inspectedInfo.viewportRelative.leftPct})
                      </span>
                    </div>
                    <div className="bg-white/5 p-1.5 rounded border border-white/5">
                      <span className="text-stone-400 text-[10px] block">Width × Height</span>
                      <span className="text-stone-300">
                        {inspectedInfo.rect.width} × {inspectedInfo.rect.height}px
                      </span>
                    </div>
                    <div className="bg-white/5 p-1.5 rounded border border-white/5">
                      <span className="text-stone-400 text-[10px] block">Top Offset</span>
                      <span className="text-stone-300">
                        {inspectedInfo.rect.top}px ({inspectedInfo.viewportRelative.topPct})
                      </span>
                    </div>
                  </div>

                  {/* Live Position Offset Calibrator (Nudge & Test) */}
                  <div className="bg-amber-950/20 border border-amber-500/20 p-2 rounded-lg space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-mono">
                      <span className="text-[#fae5b5] flex items-center gap-1 font-semibold">
                        <Move size={12} className="text-[#f0ca65]" />
                        <span>Live Position Offset Tester:</span>
                      </span>
                      <span className="text-[#f0ca65]">
                        ΔY: {offsetNudge.y > 0 ? `+${offsetNudge.y}` : offsetNudge.y}px
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                      <button
                        type="button"
                        onClick={() => applyNudge(0, -20)}
                        className="py-1 px-1 rounded bg-white/5 hover:bg-white/15 text-[10px] font-mono text-center border border-white/10"
                      >
                        ↑ -20px
                      </button>
                      <button
                        type="button"
                        onClick={() => applyNudge(0, -5)}
                        className="py-1 px-1 rounded bg-white/5 hover:bg-white/15 text-[10px] font-mono text-center border border-white/10"
                      >
                        ↑ -5px
                      </button>
                      <button
                        type="button"
                        onClick={() => applyNudge(0, +5)}
                        className="py-1 px-1 rounded bg-white/5 hover:bg-white/15 text-[10px] font-mono text-center border border-white/10"
                      >
                        ↓ +5px
                      </button>
                      <button
                        type="button"
                        onClick={() => applyNudge(0, +20)}
                        className="py-1 px-1 rounded bg-white/5 hover:bg-white/15 text-[10px] font-mono text-center border border-white/10"
                      >
                        ↓ +20px
                      </button>
                    </div>

                    {offsetNudge.y !== 0 && (
                      <div className="flex justify-end pt-0.5">
                        <button
                          type="button"
                          onClick={resetNudge}
                          className="text-[10px] text-red-300 hover:underline"
                        >
                          Reset Live Offset
                        </button>
                      </div>
                    )}
                  </div>

                  {/* One-Click Copy Actions */}
                  <div className="space-y-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => triggerCopy(generateDebugReport(), 'full-report')}
                      className="w-full py-2 px-3 rounded-xl bg-[#e8ca8a] text-black font-display font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-lg hover:bg-[#fae5b5] transition-colors cursor-pointer"
                    >
                      {copiedType === 'full-report' ? (
                        <Check size={14} className="text-emerald-800" />
                      ) : (
                        <Copy size={14} />
                      )}
                      <span>
                        {copiedType === 'full-report' ? 'REPORT COPIED TO CLIPBOARD!' : 'COPY FULL REPORT FOR AI'}
                      </span>
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => triggerCopy(generateQuickPosition(), 'quick-pos')}
                        className="py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 text-stone-200 text-[11px] font-mono flex items-center justify-center gap-1 border border-white/10 cursor-pointer"
                      >
                        {copiedType === 'quick-pos' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>Copy Position</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerCopy(inspectedInfo.selector, 'selector')}
                        className="py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 text-stone-200 text-[11px] font-mono flex items-center justify-center gap-1 border border-white/10 cursor-pointer"
                      >
                        {copiedType === 'selector' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>Copy Selector</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-black/30 border border-white/10 rounded-xl p-4 text-center space-y-2 text-stone-400">
                  <Info size={24} className="mx-auto text-[#f0ca65]/60" />
                  <p className="text-xs">
                    Click <strong>&quot;CLICK TO INSPECT ON-SCREEN ELEMENT&quot;</strong> or pick a quick button above to select any UI component.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
