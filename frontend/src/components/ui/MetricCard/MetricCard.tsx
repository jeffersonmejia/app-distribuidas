// SOLID: SRP — ESTE COMPONENTE RENDERIZA UNA TARJETA MÉTRICA RESUMEN CON ESTILO STITCH.

import type { ReactNode } from 'react'
import './MetricCard.css'

export interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  badge?: ReactNode
  icon?: ReactNode
  iconVariant?: 'primary' | 'success' | 'warning' | 'neutral'
  className?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  badge,
  icon,
  iconVariant = 'primary',
  className = '',
}: MetricCardProps) {
  return (
    <div className={`ui-metric-card ${className}`.trim()}>
      <div className="ui-metric-card__content">
        <div className="ui-metric-card__header">
          <p className="ui-metric-card__title">{title}</p>
          {badge}
        </div>
        <div className="ui-metric-card__value-row">
          <p className="ui-metric-card__value">{value}</p>
        </div>
        {subtitle && <p className="ui-metric-card__subtitle">{subtitle}</p>}
      </div>
      {icon && (
        <div
          className={`ui-metric-card__icon-wrapper ui-metric-card__icon-wrapper--${iconVariant}`}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
    </div>
  )
}
