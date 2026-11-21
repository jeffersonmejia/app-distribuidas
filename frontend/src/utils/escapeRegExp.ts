// SOLID: SRP — UTILIDAD PARA ESCAPAR CARACTERES ESPECIALES EN EXPRESIONES REGULARES DE FORMA SEGURA.

/**
 * Escapa todos los caracteres especiales de una cadena para su uso seguro en RegExp.
 * Utiliza un reemplazo global con la bandera /g para evitar escapes incompletos.
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
