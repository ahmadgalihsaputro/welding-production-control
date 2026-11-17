import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../components/ui/Button'

export interface ConfirmationOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
}

interface PendingConfirmation {
  options: ConfirmationOptions
  resolve: (confirmed: boolean) => void
}

interface ConfirmationContextValue {
  confirm: (options: ConfirmationOptions) => Promise<boolean>
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null)

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null)
  const pendingRef = useRef<PendingConfirmation | null>(null)

  const confirm = useCallback((options: ConfirmationOptions) => {
    return new Promise<boolean>((resolve) => {
      if (pendingRef.current) {
        resolve(false)
        return
      }
      const request = { options, resolve }
      pendingRef.current = request
      setPending(request)
    })
  }, [])

  const finish = useCallback((confirmed: boolean) => {
    const request = pendingRef.current
    if (!request) return
    pendingRef.current = null
    setPending(null)
    request.resolve(confirmed)
  }, [])

  useEffect(() => {
    if (!pending) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pending, finish])

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      {pending && createPortal(
        <div
          className="confirm-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) finish(false)
          }}
        >
          <section
            className="confirm-dialog glass glass--strong"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
          >
            <h2 id="confirm-dialog-title">{pending.options.title}</h2>
            <p id="confirm-dialog-message">{pending.options.message}</p>
            <div className="confirm-dialog__actions">
              <Button variant="secondary" onClick={() => finish(false)}>
                {pending.options.cancelLabel ?? 'Batal'}
              </Button>
              <Button
                variant={pending.options.tone === 'danger' ? 'danger' : 'primary'}
                autoFocus
                onClick={() => finish(true)}
              >
                {pending.options.confirmLabel ?? 'Ya, lanjutkan'}
              </Button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </ConfirmationContext.Provider>
  )
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext)
  if (!context) {
    throw new Error('useConfirmation harus digunakan di dalam ConfirmationProvider.')
  }
  return context
}
