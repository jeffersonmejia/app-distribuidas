// SOLID: SRP — ESTA FUNCIÓN CALCULA LAS INICIALES Y VARIANTES DE COLOR DE AVATAR PARA UN CLIENTE.

const IGNORED_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los'])

export function getCustomerInitials(fullName: string): string {
  const rawTokens = fullName.trim().split(/\s+/).filter(Boolean)
  if (rawTokens.length === 0) return 'CL'

  const meaningfulTokens = rawTokens.filter(
    (token) => !IGNORED_PARTICLES.has(token.toLowerCase()),
  )

  const tokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens

  if (tokens.length === 1) {
    return tokens[0].charAt(0).toUpperCase()
  }

  const first = tokens[0].charAt(0).toUpperCase()
  const last = tokens[tokens.length - 1].charAt(0).toUpperCase()
  return `${first}${last}`
}

export type AvatarColorVariant = 'brand' | 'success' | 'warning' | 'neutral'

// SOLID: SRP — ASIGNA DE MANERA DETERMINISTA UNA VARIANTE DE COLOR SUAVE SEGÚN EL NOMBRE DEL CLIENTE.
export function getAvatarColorVariant(fullName: string): AvatarColorVariant {
  let hash = 0
  for (let i = 0; i < fullName.length; i++) {
    hash = (hash << 5) - hash + fullName.charCodeAt(i)
    hash |= 0
  }
  const variants: AvatarColorVariant[] = ['brand', 'success', 'warning', 'neutral']
  return variants[Math.abs(hash) % variants.length]
}
