// SOLID: SRP — ESTE COMPONENTE GESTIONA EXCLUSIVAMENTE EL MENÚ DE ACCIONES RÁPIDAS ACCESIBLE POR FILA DE CLIENTE.

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import type { CustomerView } from '../types/customer'
import './CustomerActionsMenu.css'

export interface CustomerActionsMenuProps {
  customer: CustomerView
  onToggleStatus: (customer: CustomerView) => void
  onViewDetail?: (customer: CustomerView) => void
  onEdit?: (customer: CustomerView) => void
  onArchive?: (customer: CustomerView) => void
}

//SOLID: OCP — EXPONE HANDLERS PARA EXTENDER LAS ACCIONES SIN MODIFICAR EL MENÚ BASE.
export function CustomerActionsMenu({
  customer,
  onToggleStatus,
  onViewDetail,
  onEdit,
  onArchive,
}: CustomerActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Cierre al hacer clic fuera
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Cierre con Esc y devolución de foco al disparador
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Foco inicial en el primer elemento habilitado del menú al abrir
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const items = menuRef.current.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not([disabled])',
      )
      items[0]?.focus()
    }
  }, [isOpen])

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!menuRef.current) return
    const items = Array.from(
      menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])'),
    )
    if (items.length === 0) return

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
      items[nextIndex]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
      items[prevIndex]?.focus()
    }
  }

  function handleToggleOpen() {
    setIsOpen((prev) => !prev)
  }

  function handleAction(action?: (c: CustomerView) => void) {
    setIsOpen(false)
    buttonRef.current?.focus()
    if (action) {
      action(customer)
    }
  }

  return (
    <div className="customer-actions-menu-container">
      <button
        ref={buttonRef}
        type="button"
        className="customer-actions-menu__trigger"
        aria-label={`Acciones de ${customer.fullName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={handleToggleOpen}
      >
        <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Acciones rápidas para ${customer.fullName}`}
          className="customer-actions-menu"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="customer-actions-menu__header">
            <span className="customer-actions-menu__title">Acciones rápidas</span>
          </div>

          <button
            type="button"
            role="menuitem"
            className="customer-actions-menu__item"
            disabled={!onViewDetail}
            onClick={() => handleAction(onViewDetail)}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Ver detalle</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="customer-actions-menu__item"
            disabled={!onEdit}
            onClick={() => handleAction(onEdit)}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Editar</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="customer-actions-menu__item"
            onClick={() => handleAction(onToggleStatus)}
          >
            {customer.status === 'ACTIVE' ? (
              <>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <span>Desactivar</span>
              </>
            ) : (
              <>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Activar</span>
              </>
            )}
          </button>

          <div className="customer-actions-menu__divider" />

          <button
            type="button"
            role="menuitem"
            className="customer-actions-menu__item customer-actions-menu__item--danger"
            disabled={!onArchive}
            onClick={() => handleAction(onArchive)}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Archivar</span>
          </button>
        </div>
      )}
    </div>
  )
}
