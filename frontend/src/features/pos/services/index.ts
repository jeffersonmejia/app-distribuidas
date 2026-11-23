// SOLID: OCP — SELECCIONA EL REPOSITORIO DE POS SEGÚN LA FUENTE DE DATOS.

import type { PosRepository } from './posRepository'
import { PosMockRepository } from './posMock'
import { PosApiRepository } from './posApi'

export * from './posRepository'
export * from './posMock'

/**
 * Repositorio de fallback cuando VITE_DATA_SOURCE=api pero no existe backend HTTP de ventas aún.
 * Se conectará una vez que los contratos y endpoints sean aprobados por el backend.
 */
let repositoryInstance: PosRepository | null = null

export function getPosRepository(): PosRepository {
  if (repositoryInstance) return repositoryInstance

  const dataSource = (import.meta.env.VITE_DATA_SOURCE || 'mock').toLowerCase().trim()

  const repo = dataSource === 'api'
    ? new PosApiRepository()
    : new PosMockRepository()

  repositoryInstance = repo
  return repo
}

export function setPosRepositoryForTesting(repo: PosRepository | null): void {
  repositoryInstance = repo
}
