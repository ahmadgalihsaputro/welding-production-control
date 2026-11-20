import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

interface FormDialogProps {
  open: boolean
  onClose: () => void
  titleId: string
  title: ReactNode
  subtitle?: ReactNode
  badge?: ReactNode
  className?: string
  children: ReactNode
}

export function FormDialog({
  open,
  onClose,
  titleId,
  title,
  subtitle,
  badge,
  className,
  children,
}: FormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={cn('form-dialog glass glass--strong', className)}
      aria-labelledby={titleId}
      {...({ closedby: 'closerequest' } as Record<string, string>)}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="section-head">
        <div>
          <h2 className="section-title" id={titleId}>{title}</h2>
          {subtitle && <p className="section-sub">{subtitle}</p>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {badge}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup">
            <X size={16} />
          </Button>
        </div>
      </div>
      {children}
    </dialog>
  )
}
