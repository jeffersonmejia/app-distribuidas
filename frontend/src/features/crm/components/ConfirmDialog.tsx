// SOLID: SRP — ESTE COMPONENTE SE ENCARGA EXCLUSIVAMENTE DE MOSTRAR UN DIÁLOGO DE CONFIRMACIÓN ACCESIBLE.

import { useEffect, useRef, useId } from 'react'
import './ConfirmDialog.css'

export interface ConfirmDialogProps {
  /** Controla si el diálogo está abierto. */
  isOpen: boolean
  /** Texto del encabezado del diálogo. */
  title: string
  /** Descripción o cuerpo del diálogo. */
  description: string
  /** Etiqueta del botón de confirmación (default: "Confirmar"). */
  confirmLabel?: string
  /** Etiqueta del botón de cancelación (default: "Cancelar"). */
  cancelLabel?: string
  /** Callback al confirmar. */
  onConfirm: () => void
  /** Callback al cancelar (incluye Esc y clic en overlay). */
  onCancel: () => void
  /** Referencia al elemento que abrió el diálogo; recibe el foco al cerrar. */
  triggerRef?: React.RefObject<HTMLElement | null>
}

//SOLID: OCP — EL COMPONENTE EXPONE PROPS PARA PERSONALIZAR TEXTOS SIN MODIFICAR SU LÓGICA INTERNA.
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  triggerRef,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descId = useId()
  // Ref nativo al botón Cancelar para el foco inicial (sin necesitar forwardRef en Button).
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Foco inicial en "Cancelar" al abrir y devolución al trigger al cerrar.
  useEffect(() => {
    if (isOpen) {
      cancelBtnRef.current?.focus()
    } else {
      triggerRef?.current?.focus()
    }
  }, [isOpen, triggerRef])

  // Cierre con Esc y trampa de foco dentro del diálogo.
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      if (e.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'))

      if (focusable.length === 0) { e.preventDefault(); return }
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

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  // Bloqueo del scroll del fondo mientras el diálogo está abierto.
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay decorativo como hermano con aria-hidden */}
      <div
        className="confirm-dialog-overlay"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Contenedor accesible del alertdialog centrado */}
      <div className="confirm-dialog-container">
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="confirm-dialog"
        >
          <h2 id={titleId} className="confirm-dialog__title">{title}</h2>
          <p id={descId} className="confirm-dialog__description">{description}</p>
          <div className="confirm-dialog__actions">
            {/* Foco inicial en Cancelar — botón nativo con ref para focus programático */}
            <button
              ref={cancelBtnRef}
              type="button"
              className="btn btn--ghost btn--md"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="btn btn--primary btn--md"
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
