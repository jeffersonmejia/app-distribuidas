// SOLID: SRP — ESTE COMPONENTE PERMITE VER EL PERFIL Y CERRAR LA SESIÓN DE FORMA ACCESIBLE.

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useSession } from '../../hooks/useSession'
import { useRouter } from '../../../../app/router'
import './UserMenu.css'

export function UserMenu() {
  const { user, tenant, signOut } = useSession()
  const { navigate } = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Cierra al hacer clic fuera
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Cierre con Escape y devolución de foco
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Foco inicial en el primer elemento al abrir
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const items = menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
      items[0]?.focus()
    }
  }, [isOpen])

  function handleToggleOpen() {
    setIsOpen((prev) => !prev)
  }

  async function handleSignOut() {
    setIsOpen(false)
    await signOut()
    navigate('/login')
  }

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      triggerRef.current?.focus()
    }
  }

  if (!user) return null

  const organizationName = tenant?.name ?? user.tenantName

  return (
    <div className={`user-menu-container${isOpen ? ' user-menu-container--open' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Cuenta de usuario: ${user.fullName}`}
        title="Cuenta de usuario"
        onClick={handleToggleOpen}
      >
        <span className="user-menu__avatar" aria-hidden="true">
          {user.initials}
        </span>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Opciones de usuario"
          className="user-menu__dropdown"
          onKeyDown={handleMenuKeyDown}
        >
          {/* Cabecera con datos del usuario y organización informativa */}
          <div className="user-menu__header">
            <span className="user-menu__name">{user.fullName}</span>
            <span className="user-menu__email">{user.email}</span>
            <span className="user-menu__role">{user.role}</span>
            {organizationName && (
              <span className="user-menu__tenant" title="Organización">{organizationName}</span>
            )}
          </div>

          <div className="user-menu__divider" />

          {/* Acción para cerrar sesión */}
          <button
            type="button"
            role="menuitem"
            className="user-menu__item user-menu__item--danger"
            onClick={() => void handleSignOut()}
          >
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="user-menu__item-icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}
    </div>
  )
}
