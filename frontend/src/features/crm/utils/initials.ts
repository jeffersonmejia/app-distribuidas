// SOLID: SRP — ESTA FUNCIÓN CALCULA LAS INICIALES REPRESENTATIVAS DE UN CLIENTE.

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
