// SOLID: SRP — ESTE COMPONENTE PERMITE SELECCIONAR ACCESIBLEMENTE EL TENANT U ORGANIZACIÓN ACTIVA.

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useSession } from '../../hooks/useSession'
import type { Tenant } from '../../types/session'
import './TenantSelector.css'

function getTenantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'OR'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function TenantSelector() {
  const { tenants, activeTenant, setActiveTenant } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)

  // Sincroniza el índice enfocado con el tenant activo al abrir
  useEffect(() => {
    if (isOpen && activeTenant) {
      const idx = tenants.findIndex((t) => t.id === activeTenant.id)
      setFocusedIndex(idx >= 0 ? idx : 0)
    }
  }, [isOpen, activeTenant, tenants])

  // Cierra al hacer clic fuera
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        listboxRef.current &&
        !listboxRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Foco inicial en la opción activa al abrir
  useEffect(() => {
    if (isOpen && listboxRef.current) {
      const options = listboxRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]')
      options[focusedIndex]?.focus()
    }
  }, [isOpen, focusedIndex])

  function handleToggleOpen() {
    setIsOpen((prev) => !prev)
  }

  function handleSelectTenant(tenant: Tenant) {
    void setActiveTenant(tenant.id)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!isOpen || tenants.length === 0) return

    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      triggerRef.current?.focus()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev < tenants.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : tenants.length - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const selected = tenants[focusedIndex]
      if (selected) {
        handleSelectTenant(selected)
      }
    }
  }

  const activeName = activeTenant?.name ?? 'Seleccionar organización'

  return (
    <div className={`tenant-selector-container${isOpen ? ' tenant-selector-container--open' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="tenant-selector__trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Organización activa: ${activeName}`}
        title={`Organización: ${activeName}`}
        onClick={handleToggleOpen}
      >
        <span className="tenant-selector__avatar" aria-hidden="true">
          {getTenantInitials(activeName)}
        </span>
      </button>

      {isOpen && (
        <div
          ref={listboxRef}
          role="listbox"
          aria-label="Seleccionar organización"
          className="tenant-selector__dropdown"
          onKeyDown={handleKeyDown}
        >
          <div className="tenant-selector__header">
            <span className="tenant-selector__header-title">Organizaciones</span>
            <span className="tenant-selector__header-subtitle">
              Selecciona una empresa para gestionar
            </span>
          </div>

          <div className="tenant-selector__options">
            {tenants.map((t, idx) => {
              const isSelected = t.id === activeTenant?.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={focusedIndex === idx ? 0 : -1}
                  className={`tenant-selector__option${
                    isSelected ? ' tenant-selector__option--selected' : ''
                  }`}
                  onClick={() => handleSelectTenant(t)}
                >
                  <span className="tenant-selector__option-avatar" aria-hidden="true">
                    {getTenantInitials(t.name)}
                  </span>
                  <div className="tenant-selector__option-info">
                    <span className="tenant-selector__option-name">{t.name}</span>
                    <span className="tenant-selector__option-tier">{t.tier}</span>
                  </div>
                  {isSelected && (
                    <span className="tenant-selector__check" aria-hidden="true">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
