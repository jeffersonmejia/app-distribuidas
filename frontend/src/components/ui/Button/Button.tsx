import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

//SOLID: SRP — ESTE COMPONENTE TIENE UNA SOLA RESPONSABILIDAD: RENDERIZAR UN BOTÓN INTERACTIVO ACCESIBLE.

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  icon?: ReactNode
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || isLoading

  return (
    <button
      {...rest}
      className={`btn btn--${variant} btn--${size} ${className}`.trim()}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
    >
      {isLoading && (
        <span className="btn__spinner" aria-hidden="true" />
      )}
      {icon && !isLoading && (
        <span className="btn__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="btn__label">{children}</span>
    </button>
  )
}
