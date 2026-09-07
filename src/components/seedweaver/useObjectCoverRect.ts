import { useState, useEffect } from 'react'

export interface CoverRect {
  width: number
  height: number
  left: number
  top: number
  scale: number
}

export function useObjectCoverRect(naturalWidth: number, naturalHeight: number): CoverRect {
  const [rect, setRect] = useState<CoverRect>(() => {
    if (typeof window === 'undefined') {
      return { width: naturalWidth, height: naturalHeight, left: 0, top: 0, scale: 1 }
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const imgAspect = naturalWidth / naturalHeight
    const screenAspect = vw / vh

    let width: number
    let height: number
    let left: number
    let top: number

    if (screenAspect > imgAspect) {
      width = vw
      height = vw / imgAspect
      left = 0
      top = (vh - height) / 2
    } else {
      height = vh
      width = vh * imgAspect
      top = 0
      left = (vw - width) / 2
    }

    return { width, height, left, top, scale: width / naturalWidth }
  })

  useEffect(() => {
    function update() {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const imgAspect = naturalWidth / naturalHeight
      const screenAspect = vw / vh

      let width: number
      let height: number
      let left: number
      let top: number

      if (screenAspect > imgAspect) {
        width = vw
        height = vw / imgAspect
        left = 0
        top = (vh - height) / 2
      } else {
        height = vh
        width = vh * imgAspect
        top = 0
        left = (vw - width) / 2
      }

      setRect({ width, height, left, top, scale: width / naturalWidth })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.visualViewport?.addEventListener('resize', update)

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [naturalWidth, naturalHeight])

  return rect
}
