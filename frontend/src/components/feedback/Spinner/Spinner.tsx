import './Spinner.css'

//SOLID: SRP — RENDERIZA UN INDICADOR VISUAL ACCESIBLE DE CARGA QUE RESPETA LA PREFERENCIA DE REDUCED-MOTION.

export type SpinnerSize = 'sm' | 'md' | 'lg'

export interface SpinnerProps {
  size?: SpinnerSize
  label?: string
  className?: string
}

export function Spinner({
  size = 'md',
  label = 'Cargando...',
  className = '',
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`spinner spinner--${size} ${className}`.trim()}
    >
      <span className="spinner__circle" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
