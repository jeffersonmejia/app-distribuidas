import {
  useEffect,
  useRef,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import './Drawer.css'

// SOLID: SRP — ESTE COMPONENTE SE ENCARGA EXCLUSIVAMENTE DE RENDERIZAR UN PANEL LATERAL ACCESIBLE.

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export function Drawer({ isOpen, onClose, title, children, footer }: DrawerProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<Element | null>(null)

  // Captura el elemento que tenía el foco antes de abrir
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement
    }
  }, [isOpen])

  // Foco inicial y scroll-lock
  useEffect(() => {
    if (!isOpen) return

    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    if (panel) {
      const first = panel.querySelectorAll<HTMLElement>(FOCUSABLE)[0]
      first?.focus()
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Devuelve el foco al elemento disparador al cerrar
  useEffect(() => {
    if (!isOpen && triggerRef.current) {
      ;(triggerRef.current as HTMLElement).focus?.()
    }
  }, [isOpen])

  // Cierra con Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Trampa de foco con Tab / Shift+Tab
  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`drawer-overlay${isOpen ? ' drawer-overlay--visible' : ''}`}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`drawer-panel${isOpen ? ' drawer-panel--open' : ''}`}
        onKeyDown={handleKeyDown}
      >
        {/* Cabecera */}
        <div className="drawer-header">
          <h2 id={titleId} className="drawer-title">
            {title}
          </h2>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Cerrar panel"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="drawer-body">{children}</div>

        {/* Pie opcional */}
        {footer && <div className="drawer-footer">{footer}</div>}
      </aside>
    </>
  )
}
