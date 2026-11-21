// SOLID: SRP — FORMATEO DETERMINISTA DE FECHAS DE CALENDARIO EN ESPAÑOL SIN DESFASE DE ZONA HORARIA NI HORA.

/**
 * Formatea una fecha de calendario ('YYYY-MM-DD' o ISO) a formato legible en español ('18 de noviembre de 2026').
 * Trata la fecha como fecha local pura de calendario para evitar desfases de zona horaria (por ejemplo UTC vs UTC-5)
 * y NUNCA incluye hora ni sufijos de tiempo (como 'a. m.' o 'p. m.').
 */
export function formatCalendarDate(dateString: string): string {
  if (!dateString) return ''

  // Extracción regex de componentes de fecha YYYY-MM-DD
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1 // 0-based
    const day = parseInt(match[3], 10)

    // Se instancia a mediodía local (12:00) para evitar cualquier salto de día por husos o DST
    const localDate = new Date(year, month, day, 12, 0, 0)
    return localDate.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Fallback si no inicia con formato YYYY-MM-DD
  try {
    const parsed = new Date(dateString)
    if (isNaN(parsed.getTime())) return dateString
    return parsed.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}
