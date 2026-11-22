import type { ReactNode } from 'react'
import './PageHeader.css'

//SOLID: SRP — RENDERIZA LA CABECERA HERO PRINCIPAL CON DEGRADADO DE MARCA Y ACCIONES SEGÚN EL DISEÑO DE STITCH.

export interface PageHeaderProps {
  title: string
  description?: string
  badgeText?: string
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  actions?: ReactNode
  footer?: ReactNode
}

export function PageHeader({
  title,
  description,
  badgeText,
  searchPlaceholder = 'Buscar...',
  searchValue,
  onSearchChange,
  actions,
  footer,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      {/* Círculos decorativos translúcidos de ambiente */}
      <div className="page-header__glow page-header__glow--top-right" aria-hidden="true" />
      <div className="page-header__glow page-header__glow--bottom-left" aria-hidden="true" />

      <div className="page-header__inner">
        {/* Lado izquierdo: Información y título */}
        <div className="page-header__info">
          {badgeText && (
            <div className="page-header__badge-wrapper">
              <span className="page-header__badge">{badgeText}</span>
            </div>
          )}
          <h1 className="page-header__title">{title}</h1>
          {description && (
            <p className="page-header__description">{description}</p>
          )}
        </div>

        {/* Lado derecho: Buscador interactivo y acciones */}
        {(onSearchChange || actions) && (
          <div className="page-header__controls">
            {onSearchChange && (
              <div className="page-header__search">
                <span className="page-header__search-icon" aria-hidden="true">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  className="page-header__search-input"
                  placeholder={searchPlaceholder}
                  value={searchValue ?? ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  aria-label={searchPlaceholder}
                />
              </div>
            )}

            {actions && <div className="page-header__actions">{actions}</div>}
          </div>
        )}
      </div>

      {footer && <div className="page-header__footer">{footer}</div>}
    </header>
  )
}
