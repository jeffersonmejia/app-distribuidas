import type { ReactNode } from 'react'
import './Alert.css'

//SOLID: SRP — ESTE COMPONENTE TIENE UNA SOLA RESPONSABILIDAD: COMUNICAR UN MENSAJE DE ESTADO O RETROALIMENTACIÓN AL USUARIO.

export type AlertVariant = 'info' | 'success' | 'warning' | 'error'

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: ReactNode
}

/** Variants that require immediate attention get role="alert" (assertive);
 *  informational / positive variants use role="status" (polite). */
function resolveRole(variant: AlertVariant): 'alert' | 'status' {
  return variant === 'error' || variant === 'warning' ? 'alert' : 'status'
}

export function Alert({ variant = 'info', title, children }: AlertProps) {
  return (
    <div
      className={`alert alert--${variant}`}
      role={resolveRole(variant)}
    >
      <div className="alert__icon" aria-hidden="true">
        {variant === 'info' && (
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 9v5M10 7h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        )}
        {variant === 'success' && (
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6.5 10.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {variant === 'warning' && (
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 2.5 18 17H2L10 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M10 8v4M10 14h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        )}
        {variant === 'error' && (
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="alert__content">
        {title && <p className="alert__title">{title}</p>}
        <div className="alert__body">{children}</div>
      </div>
    </div>
  )
}
