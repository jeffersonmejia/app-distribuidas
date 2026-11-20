// SOLID: OCP — FACTORY PARA OBTENER LA INSTANCIA DE REPOSITORIO DE VENTAS SEGÚN LA FUENTE DE DATOS.

import type { PosRepository } from './posRepository'
import type { Sale, SalePage } from '../types/sale'
import { PosMockRepository } from './posMock'
import { PosApiError } from './posRepository'

export * from './posRepository'
export * from './posMock'

/**
 * Repositorio de fallback cuando VITE_DATA_SOURCE=api pero no existe backend HTTP de ventas aún.
 * Se conectará una vez que los contratos y endpoints sean aprobados por el backend.
 */
class UnavailablePosApiRepository implements PosRepository {
  async list(): Promise<SalePage> {
    throw new PosApiError('Servicio de ventas en backend no disponible todavía.', 'service_unavailable')
  }

  async getById(): Promise<Sale> {
    throw new PosApiError('Servicio de ventas en backend no disponible todavía.', 'service_unavailable')
  }
}

let repositoryInstance: PosRepository | null = null

export function getPosRepository(): PosRepository {
  if (repositoryInstance) return repositoryInstance

  const dataSource = (import.meta.env.VITE_DATA_SOURCE || 'mock').toLowerCase().trim()

  const repo = dataSource === 'api'
    ? new UnavailablePosApiRepository()
    : new PosMockRepository()

  repositoryInstance = repo
  return repo
}

export function setPosRepositoryForTesting(repo: PosRepository | null): void {
  repositoryInstance = repo
}
