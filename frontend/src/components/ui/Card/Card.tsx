import type { ReactNode } from 'react'
import './Card.css'

//SOLID: SRP — ESTE COMPONENTE TIENE UNA SOLA RESPONSABILIDAD: PROPORCIONAR UN CONTENEDOR VISUAL ELEVADO Y SEMÁNTICO.

export interface CardProps {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function Card({ title, actions, children, className = '' }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || actions) && (
        <div className="card__header">
          {title && <h3 className="card__title">{title}</h3>}
          {actions && <div className="card__actions">{actions}</div>}
        </div>
      )}
      <div className="card__body">{children}</div>
    </section>
  )
}
