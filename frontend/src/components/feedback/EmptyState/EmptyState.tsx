import type { ReactNode } from 'react'
import './EmptyState.css'

//SOLID: SRP — ESTE COMPONENTE TIENE UNA SOLA RESPONSABILIDAD: COMUNICAR QUE UNA SECCIÓN NO TIENE CONTENIDO DISPONIBLE.

export interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      {icon && (
        <span className="empty-state__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="empty-state__body">
        <h3 className="empty-state__title">{title}</h3>
        {description && (
          <p className="empty-state__description">{description}</p>
        )}
      </div>
      {action && (
        <div className="empty-state__action">{action}</div>
      )}
    </div>
  )
}
