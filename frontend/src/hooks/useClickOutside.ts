import { useEffect, type RefObject } from 'react'

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  onOutside: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return

    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOutside()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [ref, onOutside, active])
}
