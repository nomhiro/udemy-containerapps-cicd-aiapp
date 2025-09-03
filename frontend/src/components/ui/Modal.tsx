import { ReactNode } from 'react'

interface ModalProps {
  title?: string
  open: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ title, open, onClose, children, footer }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white dark:bg-neutral-900 rounded shadow w-full max-w-md p-5 animate-[fadeIn_.15s_ease]">
        <div className="flex items-start justify-between mb-4">
          {title && <h2 className="font-semibold text-lg">{title}</h2>}
          <button aria-label="Close" onClick={onClose} className="text-sm px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">×</button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
