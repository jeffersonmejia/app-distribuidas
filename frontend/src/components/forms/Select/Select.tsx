import type { SelectHTMLAttributes } from 'react'
import './Select.css'

//SOLID: SRP — RENDERIZA UN CONTROL DE SELECCIÓN DESPLEGABLE ACCESIBLE CON ETIQUETA, AYUDA Y ERROR.

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  id: string
  options: SelectOption[]
  hint?: string
  error?: string
}

export function Select({
  label,
  id,
  options,
  hint,
  error,
  disabled,
  className = '',
  ...rest
}: SelectProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={`select-field ${className}`.trim()}>
      <label className="select-field__label" htmlFor={id}>
        {label}
      </label>

      <div className="select-field__wrapper">
        <select
          {...rest}
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`select-field__control${error ? ' select-field__control--error' : ''}`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="select-field__arrow" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>

      {error && (
        <span id={errorId} className="select-field__error" role="alert">
          {error}
        </span>
      )}

      {!error && hint && (
        <span id={hintId} className="select-field__hint">
          {hint}
        </span>
      )}
    </div>
  )
}
