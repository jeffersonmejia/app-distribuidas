import type { InputHTMLAttributes, ReactNode } from 'react'
import './Input.css'

//SOLID: SRP — ESTE COMPONENTE TIENE UNA SOLA RESPONSABILIDAD: RENDERIZAR UN CAMPO DE TEXTO ACCESIBLE CON SU ETIQUETA, AYUDA Y ERROR.

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  id: string
  hint?: string
  error?: string
  endAdornment?: ReactNode
}

export function Input({
  label,
  id,
  hint,
  error,
  endAdornment,
  disabled,
  className = '',
  ...rest
}: InputProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={`input-field ${className}`.trim()}>
      <label className="input-field__label" htmlFor={id}>
        {label}
      </label>

      <div className="input-field__wrapper">
        <input
          {...rest}
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`input-field__control${error ? ' input-field__control--error' : ''}`}
        />
        {endAdornment && (
          <span className="input-field__adornment">
            {endAdornment}
          </span>
        )}
      </div>

      {error && (
        <span id={errorId} className="input-field__error" role="alert">
          {error}
        </span>
      )}

      {!error && hint && (
        <span id={hintId} className="input-field__hint">
          {hint}
        </span>
      )}
    </div>
  )
}
