import type { ReactNode } from 'react'
import './Badge.css'

//SOLID: SRP — ESTE COMPONENTE TIENE UNA SOLA RESPONSABILIDAD: RENDERIZAR UNA ETIQUETA DE ESTADO SEMÁNTICA.

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'brand'

export interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span className={`badge badge--${variant}`}>
      {children}
    </span>
  )
}
