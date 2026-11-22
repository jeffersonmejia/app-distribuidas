// SOLID: SRP — ESTE COMPONENTE GESTIONA EL MENÚ DE ACCIONES POR FILA DE PRODUCTO EN INVENTARIO.

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import type { Product } from '../../types/product'
import './ProductActionsMenu.css'

export interface ProductActionsMenuProps {
  product: Product
  onViewAvailability?: (product: Product) => void
}

export function ProductActionsMenu({ product, onViewAvailability }: ProductActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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

  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstItem = menuRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]')
      firstItem?.focus()
    }
  }, [isOpen])

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!menuRef.current) return

    const items = Array.from(menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
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

  return (
    <div className={`product-actions-menu-container${isOpen ? ' product-actions-menu-container--open' : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        className="product-actions-menu__trigger"
        aria-label={`Acciones para ${product.name}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Opciones"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Acciones para ${product.name}`}
          className="product-actions-menu"
          onKeyDown={handleMenuKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            className="product-actions-menu__item"
            onClick={() => {
              setIsOpen(false)
              onViewAvailability?.(product)
            }}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="product-actions-menu__item-icon" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Ver disponibilidad</span>
          </button>

          <button
            type="button"
            role="menuitem"
            disabled
            aria-disabled="true"
            className="product-actions-menu__item"
            title="Próximamente disponible"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="product-actions-menu__item-icon" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Editar artículo</span>
          </button>

          <button
            type="button"
            role="menuitem"
            disabled
            aria-disabled="true"
            className="product-actions-menu__item"
            title="Próximamente disponible"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="product-actions-menu__item-icon" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Dar de baja</span>
          </button>
        </div>
      )}
    </div>
  )
}
