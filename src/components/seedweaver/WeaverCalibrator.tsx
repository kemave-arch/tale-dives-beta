import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Copy,
  Check,
  RotateCcw,
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
  Palette,
  Eye,
  Paintbrush,
  ClipboardPaste,
  Type,
  Sliders,
} from 'lucide-react'
import type { NodeType } from './types.ts'
import type { WeaverCalibrationPreset } from './calibrationData.ts'

interface WeaverCalibratorProps {
  isDesktop?: boolean
  calibration?: WeaverCalibrationPreset
  onChange?: (updated: WeaverCalibrationPreset) => void
  onReset?: () => void
  onClose?: () => void
  selectedNode?: NodeType
  onSelectNode?: (node: NodeType) => void
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

// Live CSS customization state for inspected element
interface CustomCssState {
  fillType: 'solid' | 'glass' | 'none'
  bgColor: string
  bgOpacity: number // 0 to 100
  backdropBlur: number // 0 to 24 px
  borderWidth: number // 0 to 8 px
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none'
  borderColor: string
  borderOpacity: number // 0 to 100
  borderRadius: number // 0 to 40 px, 9999 for pill
  shadowPreset: 'none' | 'soft' | 'gold-glow' | 'purple-glow' | 'deep' | 'inset'
  shadowColor: string
  shadowBlur: number // 0 to 40 px
  elementOpacity: number // 0 to 100
  scale: number // 0.5 to 1.5
  rotation: number // 0 to 360
  padding: number // 0 to 32 px
  fontFamily: string
  fontSize: number // 0 for unset
  fontWeight: string
  textColor: string
  textOpacity: number // 0 to 100
  fontStyle: string // 'normal' | 'italic' | ''
  textAlign: string // 'left' | 'center' | 'right' | 'justify' | ''
}

const DEFAULT_CSS_STATE: CustomCssState = {
  fillType: 'glass',
  bgColor: '#0c0914',
  bgOpacity: 85,
  backdropBlur: 12,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#e8ca8a',
  borderOpacity: 35,
  borderRadius: 16,
  shadowPreset: 'none',
  shadowColor: '#000000',
  shadowBlur: 20,
  elementOpacity: 100,
  scale: 1,
  rotation: 0,
  padding: 0,
  fontFamily: '',
  fontSize: 0,
  fontWeight: '',
  textColor: '#ffffff',
  textOpacity: 100,
  fontStyle: '',
  textAlign: '',
}

const COLOR_SWATCHES = [
  { name: 'Dark Glass', hex: '#0c0914' },
  { name: 'Gold', hex: '#e8ca8a' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Purple Arcane', hex: '#2e1065' },
  { name: 'Midnight', hex: '#0f172a' },
  { name: 'Crimson', hex: '#7f1d1d' },
  { name: 'Emerald', hex: '#064e3b' },
  { name: 'Pure White', hex: '#ffffff' },
]

export default function WeaverCalibrator({
  isDesktop,
  calibration,
  onChange,
  onReset,
  onClose,
  selectedNode,
  onSelectNode,
}: WeaverCalibratorProps) {
  // Navigation Tabs: 'nodes' (Seedweaver node circles), 'layout' (Bounding box & layer stack), 'styles' (CSS / Visuals)
  const [activeTab, setActiveTab] = useState<'nodes' | 'layout' | 'styles'>('layout')
  const [isMinimized, setIsMinimized] = useState(false)
  const [copiedType, setCopiedType] = useState<string | null>(null)
  const [showJsonPreview, setShowJsonPreview] = useState(false)

  // Calibrator Tool Transparency Slider (0.3 to 1.0)
  const [toolOpacity, setToolOpacity] = useState<number>(0.95)
  const [showOpacityControl, setShowOpacityControl] = useState<boolean>(false)

  // ==========================================
  // DRAGGABLE WINDOW STATE
  // ==========================================
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  })
  const windowRef = useRef<HTMLDivElement>(null)

  // Initialize position on mount
  useEffect(() => {
    if (position === null) {
      const initialWidth = isDesktop ? 400 : Math.min(360, window.innerWidth - 20)
      const x = Math.max(10, window.innerWidth - initialWidth - 16)
      const y = Math.max(60, window.innerHeight - 560)
      setPosition({ x, y })
    }
  }, [isDesktop, position])

  // Drag handlers (Mouse + Touch)
  const hasMovedRef = useRef(false)
  const handleDragStart = (clientX: number, clientY: number) => {
    isDraggingRef.current = true
    hasMovedRef.current = false
    const currentX = position?.x ?? (window.innerWidth - 400)
    const currentY = position?.y ?? 100
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      startX: currentX,
      startY: currentY,
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from header bar, avoid interactive buttons
    if ((e.target as HTMLElement).closest('button, input, select')) return
    handleDragStart(e.clientX, e.clientY)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select')) return
    if (e.touches[0]) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  useEffect(() => {
    const handlePointerMove = (clientX: number, clientY: number) => {
      if (!isDraggingRef.current) return
      const deltaX = clientX - dragStartRef.current.mouseX
      const deltaY = clientY - dragStartRef.current.mouseY
      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        hasMovedRef.current = true
      }
      const newX = Math.max(4, Math.min(window.innerWidth - 80, dragStartRef.current.startX + deltaX))
      const newY = Math.max(4, Math.min(window.innerHeight - 80, dragStartRef.current.startY + deltaY))
      setPosition({ x: newX, y: newY })
    }

    const handleMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY)
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
    }

    const handlePointerUp = () => {
      isDraggingRef.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handlePointerUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handlePointerUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handlePointerUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handlePointerUp)
    }
  }, [])

  // ==========================================
  // ELEMENT & LAYER INSPECTOR STATE
  // ==========================================
  const [isPickerActive, setIsPickerActive] = useState(false)
  const [inspectedElement, setInspectedElement] = useState<HTMLElement | null>(null)
  const [layerStack, setLayerStack] = useState<LayerStackItem[]>([])
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(0)
  const [inspectedInfo, setInspectedInfo] = useState<InspectedElementInfo | null>(null)

  // Live offset adjustment for testing positions
  const [offsetNudge, setOffsetNudge] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // CSS Styles Customizer State
  const [customCss, setCustomCss] = useState<CustomCssState>(DEFAULT_CSS_STATE)
  const originalStylesRef = useRef<Map<string, string>>(new Map())
  
  // Track modified elements for comprehensive reporting
  const [modifiedElements, setModifiedElements] = useState<
    Record<string, { info: InspectedElementInfo; css: CustomCssState; offsetNudge: { x: number; y: number } }>
  >({})
  const [copiedCss, setCopiedCss] = useState<CustomCssState | null>(null)
  
  const [openSections, setOpenSections] = useState({
    fill: true,
    border: false,
    transform: false,
    typography: false
  })
  
  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const activeValues = calibration && selectedNode ? calibration[selectedNode] : null

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
    if (!activeValues || !onChange || !calibration || !selectedNode) return
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
    if (!activeValues || !onChange || !calibration || !selectedNode) return
    const nextVal = Math.max(1, Math.min(99, Math.round(value * 10) / 10))
    onChange({
      ...calibration,
      [selectedNode]: {
        ...activeValues,
        [param]: nextVal,
      },
    })
  }

  const formattedJson = calibration ? JSON.stringify(calibration, null, 2) : ''

  const handleLogConsole = () => {
    if (!calibration) return
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

      // Store initial inline styles of target for clean reset
      const map = new Map<string, string>()
      map.set('backgroundColor', target.style.backgroundColor)
      map.set('backdropFilter', target.style.backdropFilter)
      map.set('borderWidth', target.style.borderWidth)
      map.set('borderStyle', target.style.borderStyle)
      map.set('borderColor', target.style.borderColor)
      map.set('borderRadius', target.style.borderRadius)
      map.set('boxShadow', target.style.boxShadow)
      map.set('opacity', target.style.opacity)
      map.set('transform', target.style.transform)
      map.set('padding', target.style.padding)
      originalStylesRef.current = map

      setLayerStack(stack)
      setSelectedLayerIndex(0)
      setInspectedElement(target)
      setOffsetNudge({ x: 0, y: 0 })
      analyzeElement(target)
    },
    [analyzeElement]
  )

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
    const newNudge = { x: newX, y: newY }
    setOffsetNudge(newNudge)
    applyLiveStyles(customCss, inspectedElement, newNudge)
    analyzeElement(inspectedElement)
    if (inspectedInfo) {
      setModifiedElements((prev) => ({
        ...prev,
        [inspectedInfo.selector]: { info: inspectedInfo, css: customCss, offsetNudge: newNudge },
      }))
    }
  }

  const resetNudge = () => {
    const newNudge = { x: 0, y: 0 }
    setOffsetNudge(newNudge)
    if (inspectedElement) {
      applyLiveStyles(customCss, inspectedElement, newNudge)
      analyzeElement(inspectedElement)
      if (inspectedInfo) {
        setModifiedElements((prev) => ({
          ...prev,
          [inspectedInfo.selector]: { info: inspectedInfo, css: customCss, offsetNudge: newNudge },
        }))
      }
    }
  }

  // Live graphic-editor pointer drag handlers for Move, Scale, and Rotate
  const handleMovePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!inspectedElement) return
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startY = e.clientY
    const initialNudge = { ...offsetNudge }

    const onPointerMove = (pe: PointerEvent) => {
      const dx = pe.clientX - startX
      const dy = pe.clientY - startY
      const newNudge = { x: initialNudge.x + dx, y: initialNudge.y + dy }
      setOffsetNudge(newNudge)
      applyLiveStyles(customCss, inspectedElement, newNudge)
      analyzeElement(inspectedElement)
    }

    const onPointerUp = (pe: PointerEvent) => {
      target.releasePointerCapture(pe.pointerId)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const handleScalePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!inspectedElement) return
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startY = e.clientY
    const initialScale = customCss.scale

    const onPointerMove = (pe: PointerEvent) => {
      const dx = pe.clientX - startX
      const dy = pe.clientY - startY
      const distDelta = (dx + dy) / 100
      const newScale = Math.max(0.2, Math.min(3.0, Math.round((initialScale + distDelta) * 50) / 50))
      updateCssProp('scale', newScale)
    }

    const onPointerUp = (pe: PointerEvent) => {
      target.releasePointerCapture(pe.pointerId)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const handleRotatePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!inspectedElement) return
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const rect = inspectedElement.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const onPointerMove = (pe: PointerEvent) => {
      const radians = Math.atan2(pe.clientY - centerY, pe.clientX - centerX)
      let degrees = Math.round(radians * (180 / Math.PI)) + 90
      if (degrees < 0) degrees += 360
      updateCssProp('rotation', degrees)
    }

    const onPointerUp = (pe: PointerEvent) => {
      target.releasePointerCapture(pe.pointerId)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // ==========================================
  // 3. LIVE CSS & VISUAL STYLING ENGINE
  // ==========================================
  const hexToRgba = (hex: string, alphaPercent: number): string => {
    let cleanHex = hex.replace('#', '')
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map((c) => c + c).join('')
    }
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0
    const a = Math.max(0, Math.min(1, alphaPercent / 100))
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  const getComputedBoxShadow = (css: CustomCssState): string => {
    if (css.shadowPreset === 'none') return 'none'
    const blur = `${css.shadowBlur}px`
    if (css.shadowPreset === 'soft') return `0 10px ${blur} rgba(0, 0, 0, 0.5)`
    if (css.shadowPreset === 'gold-glow') return `0 0 ${blur} rgba(232, 202, 138, 0.6), 0 8px 24px rgba(0, 0, 0, 0.7)`
    if (css.shadowPreset === 'purple-glow') return `0 0 ${blur} rgba(168, 85, 247, 0.6), 0 8px 24px rgba(0, 0, 0, 0.7)`
    if (css.shadowPreset === 'deep') return `0 20px ${blur} rgba(0, 0, 0, 0.85)`
    if (css.shadowPreset === 'inset') return `inset 0 0 ${blur} ${hexToRgba(css.shadowColor, 50)}`
    return 'none'
  }

  const applyLiveStyles = useCallback((css: CustomCssState, el: HTMLElement | null, nudge = offsetNudge) => {
    if (!el) return

    // Background & Backdrop Blur
    if (css.fillType === 'none') {
      el.style.backgroundColor = 'transparent'
      el.style.backdropFilter = 'none'
    } else if (css.fillType === 'solid') {
      el.style.backgroundColor = hexToRgba(css.bgColor, css.bgOpacity)
      el.style.backdropFilter = 'none'
    } else if (css.fillType === 'glass') {
      el.style.backgroundColor = hexToRgba(css.bgColor, css.bgOpacity)
      el.style.backdropFilter = css.backdropBlur > 0 ? `blur(${css.backdropBlur}px)` : 'none'
    }

    // Border
    if (css.borderStyle === 'none' || css.borderWidth === 0) {
      el.style.border = 'none'
    } else {
      el.style.borderWidth = `${css.borderWidth}px`
      el.style.borderStyle = css.borderStyle
      el.style.borderColor = hexToRgba(css.borderColor, css.borderOpacity)
    }

    // Radius
    el.style.borderRadius = css.borderRadius >= 9999 ? '9999px' : `${css.borderRadius}px`

    // Box Shadow / Glow
    el.style.boxShadow = getComputedBoxShadow(css)

    // Element Opacity
    el.style.opacity = `${css.elementOpacity / 100}`

    // Transform (combining offset nudge + scale + rotation)
    const transformParts: string[] = []
    if (nudge.x !== 0 || nudge.y !== 0) {
      transformParts.push(`translate(${nudge.x}px, ${nudge.y}px)`)
    }
    if (css.scale !== 1) {
      transformParts.push(`scale(${css.scale})`)
    }
    if (css.rotation !== 0) {
      transformParts.push(`rotate(${css.rotation}deg)`)
    }
    el.style.transform = transformParts.join(' ')

    // Padding (if set)
    if (css.padding > 0) {
      el.style.padding = `${css.padding}px`
    }
    
    // Typography
    if (css.fontFamily) el.style.fontFamily = css.fontFamily
    if (css.fontSize > 0) el.style.fontSize = `${css.fontSize}px`
    if (css.fontWeight) el.style.fontWeight = css.fontWeight
    if (css.textColor) el.style.color = hexToRgba(css.textColor, css.textOpacity)
    if (css.fontStyle) el.style.fontStyle = css.fontStyle
    if (css.textAlign) el.style.textAlign = css.textAlign
  }, [offsetNudge])

  const updateCssProp = <K extends keyof CustomCssState>(prop: K, value: CustomCssState[K]) => {
    const next = { ...customCss, [prop]: value }
    setCustomCss(next)
    applyLiveStyles(next, inspectedElement)
    if (inspectedInfo) {
      setModifiedElements((prev) => ({
        ...prev,
        [inspectedInfo.selector]: { info: inspectedInfo, css: next, offsetNudge },
      }))
    }
  }

  const resetStyles = () => {
    if (!inspectedElement) return
    const original = originalStylesRef.current
    inspectedElement.style.backgroundColor = original.get('backgroundColor') || ''
    inspectedElement.style.backdropFilter = original.get('backdropFilter') || ''
    inspectedElement.style.borderWidth = original.get('borderWidth') || ''
    inspectedElement.style.borderStyle = original.get('borderStyle') || ''
    inspectedElement.style.borderColor = original.get('borderColor') || ''
    inspectedElement.style.borderRadius = original.get('borderRadius') || ''
    inspectedElement.style.boxShadow = original.get('boxShadow') || ''
    inspectedElement.style.opacity = original.get('opacity') || ''
    inspectedElement.style.transform = original.get('transform') || ''
    inspectedElement.style.padding = original.get('padding') || ''
    inspectedElement.style.fontFamily = original.get('fontFamily') || ''
    inspectedElement.style.fontSize = original.get('fontSize') || ''
    inspectedElement.style.fontWeight = original.get('fontWeight') || ''
    inspectedElement.style.color = original.get('color') || ''
    inspectedElement.style.fontStyle = original.get('fontStyle') || ''
    inspectedElement.style.textAlign = original.get('textAlign') || ''
    
    setCustomCss(DEFAULT_CSS_STATE)
    const newNudge = { x: 0, y: 0 }
    setOffsetNudge(newNudge)
    analyzeElement(inspectedElement)
    
    if (inspectedInfo) {
      setModifiedElements((prev) => {
        const next = { ...prev }
        delete next[inspectedInfo.selector]
        return next
      })
    }
  }

  const copyCssStyle = () => {
    setCopiedCss({ ...customCss })
  }

  const pasteCssStyle = () => {
    if (copiedCss) {
      const next = { ...copiedCss }
      setCustomCss(next)
      applyLiveStyles(next, inspectedElement)
      if (inspectedInfo) {
        setModifiedElements((prev) => ({
          ...prev,
          [inspectedInfo.selector]: { info: inspectedInfo, css: next, offsetNudge },
        }))
      }
    }
  }

  // Generate Tailwind equivalent classes string
  const generateTailwindSnippet = (): string => {
    const parts: string[] = []

    // Background
    if (customCss.fillType === 'glass') {
      parts.push(`bg-[${customCss.bgColor}]/${customCss.bgOpacity}`)
      if (customCss.backdropBlur > 0) {
        if (customCss.backdropBlur <= 4) parts.push('backdrop-blur-sm')
        else if (customCss.backdropBlur <= 8) parts.push('backdrop-blur-md')
        else if (customCss.backdropBlur <= 16) parts.push('backdrop-blur-lg')
        else parts.push('backdrop-blur-xl')
      }
    } else if (customCss.fillType === 'solid') {
      parts.push(`bg-[${customCss.bgColor}]/${customCss.bgOpacity}`)
    }

    // Border
    if (customCss.borderStyle !== 'none' && customCss.borderWidth > 0) {
      if (customCss.borderWidth === 1) parts.push('border')
      else parts.push(`border-[${customCss.borderWidth}px]`)

      if (customCss.borderStyle !== 'solid') parts.push(`border-${customCss.borderStyle}`)
      parts.push(`border-[${customCss.borderColor}]/${customCss.borderOpacity}`)
    }

    // Radius
    if (customCss.borderRadius >= 9999) parts.push('rounded-full')
    else if (customCss.borderRadius === 0) parts.push('rounded-none')
    else if (customCss.borderRadius === 8) parts.push('rounded-lg')
    else if (customCss.borderRadius === 12) parts.push('rounded-xl')
    else if (customCss.borderRadius === 16) parts.push('rounded-2xl')
    else parts.push(`rounded-[${customCss.borderRadius}px]`)

    // Shadow
    if (customCss.shadowPreset !== 'none') {
      parts.push(`shadow-[${getComputedBoxShadow(customCss)}]`)
    }

    if (customCss.elementOpacity < 100) {
      parts.push(`opacity-${customCss.elementOpacity}`)
    }
    
    // Transform
    if (customCss.scale !== 1) parts.push(`scale-[${customCss.scale}]`)
    if (customCss.rotation !== 0) parts.push(`rotate-[${customCss.rotation}deg]`)
    
    // Fonts
    if (customCss.fontSize > 0) parts.push(`text-[${customCss.fontSize}px]`)
    if (customCss.textColor) parts.push(`text-[${customCss.textColor}]/${customCss.textOpacity}`)
    if (customCss.fontWeight) parts.push(`font-${customCss.fontWeight}`)
    if (customCss.fontStyle === 'italic') parts.push('italic')
    if (customCss.textAlign) parts.push(`text-${customCss.textAlign}`)

    return parts.join(' ')
  }

  // Generate formatted style & layout report for AI
  const generateFullAiReport = (): string => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    let report = `[TALE DIVES UI & STYLE CALIBRATION REPORT]\n- Viewport / Mode: ${isDesktop ? 'DESKTOP / PC' : 'MOBILE'} (${vw}px × ${vh}px)\n\n`
    
    const elementsToReport = Object.values(modifiedElements)
    
    // If no modifications but we have an inspected element, report just that one
    if (elementsToReport.length === 0 && inspectedInfo) {
      elementsToReport.push({ info: inspectedInfo, css: customCss, offsetNudge })
    }

    if (elementsToReport.length === 0) return 'No elements modified or selected.'

    elementsToReport.forEach(({ info, css, offsetNudge: nudge }, index) => {
      report += `=== Element ${index + 1}: ${info.componentName} ===\n`
      report += `- Selector: ${info.selector}\n`
      report += `- Original z-index: ${info.styles.zIndex}\n`
      report += `[POSITION & DIMENSIONS]\n`
      report += `- Bounding Box: { left: ${info.rect.left}px (${info.viewportRelative.leftPct}), top: ${info.rect.top}px (${info.viewportRelative.topPct}), width: ${info.rect.width}px, height: ${info.rect.height}px }\n`
      report += `- Distance from Bottom: ${info.viewportRelative.bottomPx}px (${info.viewportRelative.bottomPct})\n`
      report += `- Distance from Right: ${info.viewportRelative.rightPx}px (${info.viewportRelative.rightPct})\n`
      if (nudge.x !== 0 || nudge.y !== 0) {
        report += `- Offset Applied: { deltaX: ${nudge.x}px, deltaY: ${nudge.y}px } (New Bottom: ${info.viewportRelative.bottomPx - nudge.y}px)\n`
      }
      report += `[CALIBRATED CSS]\n`
      report += `- Background: ${css.fillType} (${css.bgColor} at ${css.bgOpacity}%, blur: ${css.backdropBlur}px)\n`
      report += `- Border: ${css.borderWidth}px ${css.borderStyle} (${css.borderColor} at ${css.borderOpacity}%)\n`
      report += `- Corner Radius: ${css.borderRadius >= 9999 ? 'Pill (full)' : css.borderRadius + 'px'}\n`
      report += `- Shadow: ${css.shadowPreset} (${getComputedBoxShadow(css)})\n`
      report += `- Transform: Scale ${css.scale}x | Rotation: ${css.rotation}deg\n`
      report += `- Opacity: ${css.elementOpacity}%\n`
      if (css.fontFamily || css.fontSize > 0 || css.fontWeight || css.textColor !== '#ffffff') {
        report += `- Typography: ${css.fontFamily || 'default'} | Size: ${css.fontSize || 'default'}px | Weight: ${css.fontWeight || 'default'} | Color: ${css.textColor} at ${css.textOpacity}%\n`
      }
      report += '\n'
    })

    return report.trim()
  }

  // Global click-to-inspect listeners
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
    <>
      {/* Graphic Editor Live Transform Frame for Inspected Element */}
      {inspectedElement && (() => {
        const rect = inspectedElement.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return null

        return (
          <div
            style={{
              position: 'fixed',
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              zIndex: 9998,
              pointerEvents: 'none',
            }}
            className="ring-2 ring-[#f0ca65] ring-offset-2 ring-offset-black/50 rounded shadow-[0_0_25px_rgba(240,202,101,0.6)]"
          >
            {/* Draggable Transform Frame Body */}
            <div
              onPointerDown={handleMovePointerDown}
              className="w-full h-full cursor-move pointer-events-auto bg-[#f0ca65]/10 hover:bg-[#f0ca65]/20 transition-colors relative"
              title="Click & Drag to move element position"
            >
              {/* Top Tag & Stats Badge */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-[#0c0914] border border-[#f0ca65] rounded-md text-[10px] font-mono text-[#fae5b5] flex items-center gap-1.5 shadow-2xl whitespace-nowrap pointer-events-auto">
                <span className="font-bold text-[#f0ca65]">{inspectedInfo?.componentName || 'Element'}</span>
                <span className="text-stone-500">|</span>
                <span>{customCss.scale.toFixed(1)}x</span>
                <span>{customCss.rotation}°</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setInspectedElement(null)
                    setInspectedInfo(null)
                  }}
                  className="text-stone-400 hover:text-red-400 font-bold ml-1 cursor-pointer"
                  title="Deselect element"
                >
                  ×
                </button>
              </div>

              {/* Rotation Stalk & Handle (Top Center) */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                <div
                  onPointerDown={handleRotatePointerDown}
                  className="w-4 h-4 rounded-full bg-[#f0ca65] border-2 border-black shadow-md cursor-grab active:cursor-grabbing hover:scale-125 transition-transform flex items-center justify-center text-[9px] font-bold text-black"
                  title="Drag to Rotate Element"
                >
                  ↻
                </div>
                <div className="w-0.5 h-3 bg-[#f0ca65]" />
              </div>

              {/* Corner Scale Handles */}
              <div
                onPointerDown={handleScalePointerDown}
                className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-[#f0ca65] border-2 border-black rounded-sm cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
                title="Drag Corner to Scale Element"
              />
              <div
                onPointerDown={handleScalePointerDown}
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-[#f0ca65] border-2 border-black rounded-sm cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
                title="Drag Corner to Scale Element"
              />
              <div
                onPointerDown={handleScalePointerDown}
                className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-[#f0ca65] border-2 border-black rounded-sm cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
                title="Drag Corner to Scale Element"
              />
              <div
                onPointerDown={handleScalePointerDown}
                className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-[#f0ca65] border-2 border-black rounded-sm cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
                title="Drag Corner to Scale Element"
              />
            </div>
          </div>
        )
      })()}

      {isMinimized ? (
        <div
          ref={windowRef}
          style={{
            position: 'fixed',
            left: position ? `${position.x}px` : undefined,
            top: position ? `${position.y}px` : undefined,
            bottom: position ? undefined : '20px',
            right: position ? undefined : '20px',
            opacity: toolOpacity,
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={() => {
            if (!hasMovedRef.current) {
              setIsMinimized(false)
            }
          }}
          className="taledives-calibrator-hud fixed z-50 p-2.5 bg-[#0c0914] text-[#f0ca65] border-2 border-[#f0ca65] rounded-full shadow-[0_0_25px_rgba(240,202,101,0.6)] backdrop-blur-2xl cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 transition-all flex items-center justify-center gap-2 group select-none"
          title="Weaver Calibrator HUD (Click to Expand, Drag to Move)"
        >
          <Sliders size={20} className="text-[#f0ca65] group-hover:rotate-45 transition-transform" />
          <span className="font-display font-bold text-xs text-[#fae5b5] pr-1 hidden sm:inline">
            Calibrator
          </span>
          {Object.keys(modifiedElements).length > 0 && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          )}
        </div>
      ) : (
        <div
          ref={windowRef}
          style={{
            position: 'fixed',
            left: position ? `${position.x}px` : undefined,
            top: position ? `${position.y}px` : undefined,
            bottom: position ? undefined : '16px',
            right: position ? undefined : '16px',
            opacity: toolOpacity,
          }}
          className="taledives-calibrator-hud fixed z-50 max-w-[96vw] w-[360px] sm:w-[410px] bg-[#0c0914] text-stone-200 border border-[#e8ca8a]/40 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl font-sans select-none overflow-hidden transition-opacity"
        >
          {/* HUD Header (Draggable Handle) */}
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className="flex items-center justify-between px-3.5 py-2.5 bg-black/60 border-b border-white/10 cursor-grab active:cursor-grabbing hover:bg-black/75 transition-colors"
            title="Click & Drag to move anywhere on screen"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Move size={14} className="text-[#f0ca65] shrink-0" />
              <span className="font-display font-bold text-xs tracking-wider text-[#fae5b5] uppercase truncate">
                Weaver Calibrator
              </span>
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-stone-300 font-mono shrink-0">
                {isDesktop ? <Monitor size={9} /> : <Smartphone size={9} />}
                {isDesktop ? 'PC' : 'Mobile'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Tool Transparency Popover Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOpacityControl(!showOpacityControl)}
                  className={`p-1 rounded-md transition-colors ${
                    showOpacityControl ? 'bg-[#f0ca65] text-black' : 'text-stone-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Adjust Tool Transparency"
                >
                  <Eye size={14} />
                </button>

                {showOpacityControl && (
                  <div className="absolute right-0 top-full mt-1.5 z-50 p-2.5 bg-[#140e24] border border-[#e8ca8a]/40 rounded-xl shadow-2xl w-44 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-stone-400">Tool Opacity</span>
                      <span className="text-[#f0ca65] font-bold">{Math.round(toolOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.25"
                      max="1.0"
                      step="0.05"
                      value={toolOpacity}
                      onChange={(e) => setToolOpacity(parseFloat(e.target.value))}
                      className="w-full accent-[#f0ca65] h-1.5 bg-white/10 rounded cursor-pointer"
                    />
                    <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-center">
                      {[0.4, 0.6, 0.8, 1.0].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setToolOpacity(val)}
                          className={`py-0.5 rounded ${
                            toolOpacity === val ? 'bg-[#f0ca65] text-black font-bold' : 'bg-white/5 text-stone-300 hover:bg-white/15'
                          }`}
                        >
                          {Math.round(val * 100)}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1 rounded-md text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Minimize to Floating Icon"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose()
                  else setIsMinimized(true)
                }}
                className="p-1 rounded-md text-stone-400 hover:text-red-400 hover:bg-white/10 transition-colors"
                title="Minimize to Floating Icon"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-3 max-h-[76vh] overflow-y-auto">
            {/* Main 3-Tab Navigator */}
            <div className={`grid ${calibration ? 'grid-cols-3' : 'grid-cols-2'} gap-1 p-1 bg-black/60 rounded-xl border border-white/10 text-[11px]`}>
            <button
              type="button"
              onClick={() => setActiveTab('layout')}
              className={`py-1.5 px-1 rounded-lg font-display font-semibold tracking-wide flex items-center justify-center gap-1 transition-all ${
                activeTab === 'layout'
                  ? 'bg-[#f0ca65] text-black shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Crosshair size={12} />
              <span className="truncate">Layout & Pos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('styles')}
              className={`py-1.5 px-1 rounded-lg font-display font-semibold tracking-wide flex items-center justify-center gap-1 transition-all ${
                activeTab === 'styles'
                  ? 'bg-[#fae5b5] text-black shadow-md'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Palette size={12} />
              <span className="truncate">CSS & Styles</span>
            </button>
            {calibration && (
              <button
                type="button"
                onClick={() => setActiveTab('nodes')}
                className={`py-1.5 px-1 rounded-lg font-display font-semibold tracking-wide flex items-center justify-center gap-1 transition-all ${
                  activeTab === 'nodes'
                    ? 'bg-[#e8ca8a] text-black shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Sparkles size={12} />
                <span className="truncate">Seed Nodes</span>
              </button>
            )}
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
                      onClick={() => onSelectNode && onSelectNode(node)}
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

              {/* Quick Tip */}
              <div className="text-[11px] text-[#d8c49e]/80 bg-amber-950/25 border border-amber-500/20 rounded-lg p-2 flex items-start gap-1.5">
                <Move size={13} className="text-[#f0ca65] shrink-0 mt-0.5" />
                <span>
                  <strong>Drag & Fine-Tune:</strong> Click and drag node circles directly on canvas or adjust sliders below.
                </span>
              </div>

              {/* Param Controls for Selected Node */}
              {activeValues && (
                <div className="space-y-2.5 bg-black/30 p-2.5 rounded-xl border border-white/5">
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
              )}

              {/* Action Buttons */}
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

              {/* Reset & View Code */}
              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px]">
                <button
                  type="button"
                  onClick={onReset}
                  className="flex items-center gap-1 text-red-300/80 hover:text-red-200 transition-colors cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Reset Defaults</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowJsonPreview(!showJsonPreview)}
                  className="text-[#d8c49e]/90 hover:text-white transition-colors underline cursor-pointer"
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
          {/* TAB 2: LAYOUT, POSITION & LAYER INSPECTION                                */}
          {/* ========================================================================= */}
          {activeTab === 'layout' && (
            <div className="space-y-3">
              {/* Click-to-Inspect activator */}
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
                          className="text-[10px] text-red-300 hover:underline cursor-pointer"
                        >
                          Reset Live Offset
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Copy Actions */}
                  <div className="space-y-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => triggerCopy(generateFullAiReport(), 'full-report')}
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

          {/* ========================================================================= */}
          {/* TAB 3: LIVE CSS & VISUAL STYLES INSPECTOR                                  */}
          {/* ========================================================================= */}
          {activeTab === 'styles' && (
            <div className="space-y-3">
              {!inspectedElement && (
                <div className="bg-amber-950/25 border border-amber-500/30 p-2.5 rounded-xl text-xs text-[#fae5b5] flex items-start gap-2">
                  <Info size={16} className="text-[#f0ca65] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">No element selected</p>
                    <p className="text-[11px] text-[#d8c49e]/80 mt-0.5">
                      Target an element via <strong>Layout & Pos</strong>.
                    </p>
                  </div>
                </div>
              )}

              {inspectedElement && (
                <div className="space-y-3">
                  {/* Selected target chip */}
                  <div className="flex items-center justify-between px-2 py-1 bg-black/40 rounded-lg border border-white/10 text-xs font-mono">
                    <span className="text-stone-400 truncate pr-2">Target: <strong className="text-[#f0ca65]">{inspectedInfo?.componentName}</strong></span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={copyCssStyle}
                        className="text-[10px] text-stone-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                        title="Copy Style"
                      >
                        <Copy size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={pasteCssStyle}
                        disabled={!copiedCss}
                        className={`text-[10px] flex items-center gap-1 transition-colors ${copiedCss ? 'text-stone-300 hover:text-white cursor-pointer' : 'text-stone-600 cursor-not-allowed'}`}
                        title="Paste Style"
                      >
                        <ClipboardPaste size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={resetStyles}
                        className="text-[10px] text-red-300/80 hover:text-red-200 flex items-center gap-1 cursor-pointer ml-1"
                        title="Reset styles to initial state"
                      >
                        <RotateCcw size={10} />
                      </button>
                    </div>
                  </div>

                  {/* 1. FILL & BACKGROUND */}
                  <div className="bg-black/30 rounded-xl border border-white/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('fill')}
                      className="w-full flex items-center justify-between p-2.5 text-xs font-display font-semibold text-[#fae5b5] hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Paintbrush size={12} className="text-[#f0ca65]" />
                        <span>Fill & Background</span>
                      </span>
                      {openSections.fill ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                    </button>

                    {openSections.fill && (
                      <div className="p-2.5 pt-0 space-y-2 border-t border-white/5">
                        {/* Fill Type Selector */}
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono mt-2">
                          {(['glass', 'solid', 'none'] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => updateCssProp('fillType', type)}
                              className={`py-1 rounded border capitalize transition-all ${
                                customCss.fillType === type
                                  ? 'bg-[#e8ca8a] text-black font-bold border-[#e8ca8a]'
                                  : 'bg-white/5 text-stone-300 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>

                        {customCss.fillType !== 'none' && (
                          <>
                            {/* Swatches + Color Picker */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[10px] font-mono text-stone-400">
                                <span>Color: {customCss.bgColor}</span>
                                <input
                                  type="color"
                                  value={customCss.bgColor}
                                  onChange={(e) => updateCssProp('bgColor', e.target.value)}
                                  className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer"
                                />
                              </div>
                              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                                {COLOR_SWATCHES.map((swatch) => (
                                  <button
                                    key={swatch.hex}
                                    type="button"
                                    onClick={() => updateCssProp('bgColor', swatch.hex)}
                                    style={{ backgroundColor: swatch.hex }}
                                    className={`w-5 h-5 rounded-full border shrink-0 transition-transform ${
                                      customCss.bgColor.toLowerCase() === swatch.hex.toLowerCase()
                                        ? 'border-[#f0ca65] scale-110 shadow-[0_0_8px_#f0ca65]'
                                        : 'border-white/20 hover:scale-105'
                                    }`}
                                    title={swatch.name}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Fill Opacity Slider */}
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-[10px] font-mono text-stone-400">
                                <span>Fill Opacity</span>
                                <span className="text-[#f0ca65]">{customCss.bgOpacity}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={customCss.bgOpacity}
                                onChange={(e) => updateCssProp('bgOpacity', parseInt(e.target.value, 10))}
                                className="w-full accent-[#f0ca65] h-1.5 bg-white/10 rounded cursor-pointer"
                              />
                            </div>

                            {/* Backdrop Blur Slider */}
                            {customCss.fillType === 'glass' && (
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-[10px] font-mono text-stone-400">
                                  <span>Backdrop Blur</span>
                                  <span className="text-[#f0ca65]">{customCss.backdropBlur}px</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="24"
                                  step="2"
                                  value={customCss.backdropBlur}
                                  onChange={(e) => updateCssProp('backdropBlur', parseInt(e.target.value, 10))}
                                  className="w-full accent-[#f0ca65] h-1.5 bg-white/10 rounded cursor-pointer"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. BORDER & CORNER RADIUS */}
                  <div className="bg-black/30 rounded-xl border border-white/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('border')}
                      className="w-full flex items-center justify-between p-2.5 text-xs font-display font-semibold text-[#fae5b5] hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span>Border & Corners</span>
                      {openSections.border ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                    </button>

                    {openSections.border && (
                      <div className="p-2.5 pt-0 space-y-2 border-t border-white/5">
                        {/* Border Style */}
                        <div className="grid grid-cols-4 gap-1 text-[10px] font-mono mt-2">
                          {(['solid', 'dashed', 'dotted', 'none'] as const).map((style) => (
                            <button
                              key={style}
                              type="button"
                              onClick={() => updateCssProp('borderStyle', style)}
                              className={`py-1 rounded border capitalize transition-all ${
                                customCss.borderStyle === style
                                  ? 'bg-[#e8ca8a] text-black font-bold border-[#e8ca8a]'
                                  : 'bg-white/5 text-stone-300 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {style}
                            </button>
                          ))}
                        </div>

                        {customCss.borderStyle !== 'none' && (
                          <>
                            {/* Border Color */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[10px] font-mono text-stone-400">
                                <span>Border Color: {customCss.borderColor}</span>
                                <input
                                  type="color"
                                  value={customCss.borderColor}
                                  onChange={(e) => updateCssProp('borderColor', e.target.value)}
                                  className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer"
                                />
                              </div>
                              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                                {COLOR_SWATCHES.map((swatch) => (
                                  <button
                                    key={swatch.hex}
                                    type="button"
                                    onClick={() => updateCssProp('borderColor', swatch.hex)}
                                    style={{ backgroundColor: swatch.hex }}
                                    className={`w-5 h-5 rounded-full border shrink-0 transition-transform ${
                                      customCss.borderColor.toLowerCase() === swatch.hex.toLowerCase()
                                        ? 'border-[#f0ca65] scale-110 shadow-[0_0_8px_#f0ca65]'
                                        : 'border-white/20 hover:scale-105'
                                    }`}
                                    title={swatch.name}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Border Width & Opacity */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-[10px] font-mono text-stone-400">
                                  <span>Width</span>
                                  <span className="text-[#f0ca65]">{customCss.borderWidth}px</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="8"
                                  step="1"
                                  value={customCss.borderWidth}
                                  onChange={(e) => updateCssProp('borderWidth', parseInt(e.target.value, 10))}
                                  className="w-full accent-[#f0ca65] h-1.5 bg-white/10 rounded cursor-pointer"
                                />
                              </div>

                              <div className="space-y-0.5">
                                <div className="flex justify-between text-[10px] font-mono text-stone-400">
                                  <span>Opacity</span>
                                  <span className="text-[#f0ca65]">{customCss.borderOpacity}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="5"
                                  value={customCss.borderOpacity}
                                  onChange={(e) => updateCssProp('borderOpacity', parseInt(e.target.value, 10))}
                                  className="w-full accent-[#f0ca65] h-1.5 bg-white/10 rounded cursor-pointer"
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {/* Corner Radius */}
                        <div className="space-y-1 pt-1 border-t border-white/5">
                          <div className="flex justify-between text-[10px] font-mono text-stone-400">
                            <span>Corner Radius</span>
                            <span className="text-[#f0ca65]">
                              {customCss.borderRadius >= 9999 ? 'Pill (full)' : `${customCss.borderRadius}px`}
                            </span>
                          </div>
                          <div className="grid grid-cols-6 gap-1 text-[9px] font-mono">
                            {[0, 8, 12, 16, 24, 9999].map((radius) => (
                              <button
                                key={radius}
                                type="button"
                                onClick={() => updateCssProp('borderRadius', radius)}
                                className={`py-0.5 rounded border transition-all ${
                                  customCss.borderRadius === radius
                                    ? 'bg-[#e8ca8a] text-black font-bold border-[#e8ca8a]'
                                    : 'bg-white/5 text-stone-300 border-white/10 hover:bg-white/10'
                                }`}
                              >
                                {radius === 9999 ? 'Pill' : `${radius}px`}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. SHADOW, GLOW & TRANSFORM */}
                  <div className="bg-black/30 rounded-xl border border-white/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('transform')}
                      className="w-full flex items-center justify-between p-2.5 text-xs font-display font-semibold text-[#fae5b5] hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span>Shadow & Transform</span>
                      {openSections.transform ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                    </button>

                    {openSections.transform && (
                      <div className="p-2.5 pt-0 space-y-2 border-t border-white/5">
                        {/* Shadow Preset */}
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono mt-2">
                          {[
                            { id: 'none', label: 'None' },
                            { id: 'soft', label: 'Soft Shadow' },
                            { id: 'gold-glow', label: 'Gold Glow' },
                            { id: 'purple-glow', label: 'Purple Glow' },
                            { id: 'deep', label: 'Deep Shade' },
                            { id: 'inset', label: 'Inset' },
                          ].map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => updateCssProp('shadowPreset', preset.id as CustomCssState['shadowPreset'])}
                              className={`py-1 px-1 rounded border text-center truncate transition-all ${
                                customCss.shadowPreset === preset.id
                                  ? 'bg-[#e8ca8a] text-black font-bold border-[#e8ca8a]'
                                  : 'bg-white/5 text-stone-300 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        {/* Scale Slider */}
                        <div className="space-y-0.5 pt-1 border-t border-white/5">
                          <div className="flex justify-between text-[10px] font-mono text-stone-400">
                            <span>Scale / Size Zoom</span>
                            <span className="text-[#f0ca65]">{customCss.scale.toFixed(2)}x</span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.05"
                            value={customCss.scale}
                            onChange={(e) => updateCssProp('scale', parseFloat(e.target.value))}
                            className="w-full accent-[#f0ca65] h-1.5 bg-white/10 rounded cursor-pointer"
                          />
                        </div>
                        
                        {/* Rotation Slider */}
                        <div className="space-y-0.5 pt-1 border-t border-white/5">
                          <div className="flex justify-between text-[10px] font-mono text-stone-400">
                            <span>Rotation</span>
                            <span className="text-[#f0ca65]">{customCss.rotation}°</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            step="1"
                            value={customCss.rotation}
                            onChange={(e) => updateCssProp('rotation', parseInt(e.target.value, 10))}
                            className="w-full accent-[#f0ca65] h-1.5 bg-white/10 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. TYPOGRAPHY */}
                  <div className="bg-black/30 rounded-xl border border-white/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('typography')}
                      className="w-full flex items-center justify-between p-2.5 text-xs font-display font-semibold text-[#fae5b5] hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Type size={12} className="text-[#f0ca65]" />
                        <span>Typography</span>
                      </span>
                      {openSections.typography ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
                    </button>

                    {openSections.typography && (
                      <div className="p-2.5 pt-0 space-y-2 border-t border-white/5">
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mt-2">
                          {/* Font Family */}
                          <div className="space-y-1">
                            <span className="text-stone-400 block">Family</span>
                            <select
                              value={customCss.fontFamily}
                              onChange={(e) => updateCssProp('fontFamily', e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-1 text-stone-300 outline-none focus:border-[#f0ca65] cursor-pointer"
                            >
                              <option value="">(Default)</option>
                              <option value="'Cinzel', serif">Cinzel (Display)</option>
                              <option value="'Lora', serif">Lora (Prose)</option>
                              <option value="'JetBrains Mono', monospace">JetBrains (Mono)</option>
                              <option value="system-ui, sans-serif">System Sans</option>
                            </select>
                          </div>

                          {/* Font Weight */}
                          <div className="space-y-1">
                            <span className="text-stone-400 block">Weight</span>
                            <select
                              value={customCss.fontWeight}
                              onChange={(e) => updateCssProp('fontWeight', e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-1 text-stone-300 outline-none focus:border-[#f0ca65] cursor-pointer"
                            >
                              <option value="">(Default)</option>
                              <option value="300">Light (300)</option>
                              <option value="400">Regular (400)</option>
                              <option value="500">Medium (500)</option>
                              <option value="600">Semibold (600)</option>
                              <option value="700">Bold (700)</option>
                              <option value="800">Extra Bold (800)</option>
                            </select>
                          </div>
                        </div>

                        {/* Size and Color */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-white/5 pt-2">
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-stone-400">
                              <span>Size</span>
                              <span className="text-[#f0ca65]">{customCss.fontSize > 0 ? `${customCss.fontSize}px` : 'Auto'}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="72"
                              step="1"
                              value={customCss.fontSize}
                              onChange={(e) => updateCssProp('fontSize', parseInt(e.target.value, 10))}
                              className="w-full accent-[#f0ca65] h-1.5 bg-white/10 rounded cursor-pointer"
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-stone-400">
                              <span>Color: {customCss.textColor}</span>
                              <input
                                type="color"
                                value={customCss.textColor}
                                onChange={(e) => updateCssProp('textColor', e.target.value)}
                                className="w-5 h-5 rounded border border-white/20 bg-transparent cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Align and Style */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-white/5 pt-2">
                          <div className="space-y-1">
                            <span className="text-stone-400 block">Alignment</span>
                            <div className="flex rounded border border-white/10 overflow-hidden">
                              {(['left', 'center', 'right', 'justify'] as const).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateCssProp('textAlign', align)}
                                  className={`flex-1 py-1 transition-colors ${customCss.textAlign === align ? 'bg-[#e8ca8a] text-black font-bold' : 'bg-white/5 text-stone-400 hover:bg-white/15'}`}
                                  title={`Align ${align}`}
                                >
                                  {align.charAt(0).toUpperCase()}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => updateCssProp('textAlign', '')}
                                className={`flex-1 py-1 transition-colors ${customCss.textAlign === '' ? 'bg-white/20 text-white font-bold' : 'bg-white/5 text-stone-400 hover:bg-white/15'}`}
                                title="Clear alignment"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-stone-400 block">Style</span>
                            <div className="flex rounded border border-white/10 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => updateCssProp('fontStyle', 'normal')}
                                className={`flex-1 py-1 transition-colors ${customCss.fontStyle === 'normal' ? 'bg-[#e8ca8a] text-black font-bold' : 'bg-white/5 text-stone-400 hover:bg-white/15'}`}
                              >
                                Norm
                              </button>
                              <button
                                type="button"
                                onClick={() => updateCssProp('fontStyle', 'italic')}
                                className={`flex-1 py-1 transition-colors italic ${customCss.fontStyle === 'italic' ? 'bg-[#e8ca8a] text-black font-bold' : 'bg-white/5 text-stone-400 hover:bg-white/15'}`}
                              >
                                Italic
                              </button>
                              <button
                                type="button"
                                onClick={() => updateCssProp('fontStyle', '')}
                                className={`w-6 flex-shrink-0 py-1 transition-colors ${customCss.fontStyle === '' ? 'bg-white/20 text-white font-bold' : 'bg-white/5 text-stone-400 hover:bg-white/15'}`}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tailwind Code Output Preview */}
                  <div className="space-y-1.5 bg-black/60 p-2.5 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between text-xs font-display font-semibold text-[#fae5b5]">
                      <span>Tailwind Equivalent:</span>
                    </div>
                    <div className="p-2 bg-black/80 rounded-lg border border-white/10 font-mono text-[10px] text-emerald-400 break-all select-all">
                      {generateTailwindSnippet()}
                    </div>
                  </div>

                  {/* Copy Action Buttons */}
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => triggerCopy(generateFullAiReport(), 'full-style-report')}
                      className="w-full py-2 px-3 rounded-xl bg-[#e8ca8a] text-black font-display font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-lg hover:bg-[#fae5b5] transition-colors cursor-pointer"
                    >
                      {copiedType === 'full-style-report' ? (
                        <Check size={14} className="text-emerald-800" />
                      ) : (
                        <Copy size={14} />
                      )}
                      <span>
                        {copiedType === 'full-style-report' ? 'FULL REPORT COPIED!' : 'COPY STYLE REPORT FOR AI'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerCopy(generateTailwindSnippet(), 'tailwind-only')}
                      className="w-full py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 text-stone-200 text-xs font-mono flex items-center justify-center gap-1 border border-white/10 cursor-pointer"
                    >
                      {copiedType === 'tailwind-only' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>Copy Tailwind Snippet Only</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )}
  </>
)
}
