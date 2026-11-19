import { createContext, useCallback, useContext, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../components/ui/Button'
import { usePreferences } from './PreferencesContext'

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

function isOutsideDialog(event: PointerEvent<HTMLDialogElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const { t } = usePreferences()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pressedOutside = useRef(false)
  const [pending, setPending] = useState<PendingConfirmation | null>(null)
  const pendingRef = useRef<PendingConfirmation | null>(null)

  useEffect(() => {
    if (!pending) return
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    // Focus the safe action: Enter must not confirm a destructive action by default.
    dialog.querySelector<HTMLButtonElement>('[data-confirm-cancel]')?.focus()
  }, [pending])

  const finish = useCallback((confirmed: boolean) => {
    const request = pendingRef.current
    if (!request) return
    pendingRef.current = null
    setPending(null)
    const dialog = dialogRef.current
    if (dialog?.open) dialog.close(confirmed ? 'confirm' : '')
    request.resolve(confirmed)
  }, [])

  // Native modal handles Esc and focus return. close fires for Esc too, with no returnValue.
  const handleClose = useCallback(() => {
    const dialog = dialogRef.current
    const request = pendingRef.current
    if (request) {
      pendingRef.current = null
      setPending(null)
      request.resolve(dialog?.returnValue === 'confirm')
    }
    if (dialog) dialog.returnValue = ''
  }, [])

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

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      {createPortal(
        <dialog
          ref={dialogRef}
          className="confirm-dialog glass glass--strong"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          onClose={handleClose}
          onPointerDown={(event) => {
            pressedOutside.current = isOutsideDialog(event)
          }}
          onPointerUp={(event) => {
            if (pressedOutside.current && isOutsideDialog(event)) finish(false)
          }}
        >
          <h2 id="confirm-dialog-title">{pending?.options.title}</h2>
          <p id="confirm-dialog-message">{pending?.options.message}</p>
          <div className="confirm-dialog__actions">
            <Button
              variant="secondary"
              data-confirm-cancel
              onClick={() => finish(false)}
            >
              {pending?.options.cancelLabel ?? t('Batal', 'Cancel')}
            </Button>
            <Button
              variant={pending?.options.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => finish(true)}
            >
              {pending?.options.confirmLabel ?? t('Ya, lanjutkan', 'Yes, continue')}
            </Button>
          </div>
        </dialog>,
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
