// SOLID: OCP — PROVEE EL REPOSITORIO DE SESIÓN CONFIGURABLE SEGÚN LA VARIABLE DE ENTORNO VITE_DATA_SOURCE.

import type { SessionRepository } from './sessionRepository'
import { SessionMockRepository } from './sessionMock'

export * from './sessionRepository'
export * from './sessionMock'

let sessionRepositoryInstance: SessionRepository | null = null

export function getSessionRepository(): SessionRepository {
  if (sessionRepositoryInstance) {
    return sessionRepositoryInstance
  }

  sessionRepositoryInstance = new SessionMockRepository()
  return sessionRepositoryInstance
}

export function setSessionRepository(repository: SessionRepository | null): void {
  sessionRepositoryInstance = repository
}
