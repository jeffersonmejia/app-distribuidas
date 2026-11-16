import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { useRouter } from './router'

//SOLID: SRP — RENDERIZA UN ENLACE ACCESIBLE QUE INTERCEPTA NAVEGACIÓN CLIENT-SIDE SOLO EN CLICS SIMPLES.

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
  replace?: boolean
}

export function Link({
  to,
  replace = false,
  onClick,
  target,
  children,
  ...rest
}: LinkProps) {
  const { navigate } = useRouter()

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e)
    }

    // Permite que el navegador gestione combinaciones especiales de teclas o clics secundarios
    if (
      e.defaultPrevented ||
      e.button !== 0 || // Solo botón izquierdo (0)
      e.metaKey ||
      e.altKey ||
      e.ctrlKey ||
      e.shiftKey ||
      (target && target !== '_self')
    ) {
      return
    }

    e.preventDefault()
    navigate(to, { replace })
  }

  return (
    <a {...rest} href={to} target={target} onClick={handleClick}>
      {children}
    </a>
  )
}
