// SOLID: OCP - DEFINE LA FABRICA DEL REPOSITORIO DE PROYECTOS SEGUN LA FUENTE DE DATOS.

import type { ProjectRepository } from './projectRepository'
import { ProjectMockRepository } from './projectMock'
import { ProjectApiRepository } from './projectApi'

export * from './projectRepository'
export * from './projectMock'

let repositoryInstance: ProjectRepository | null = null

export function getProjectRepository(): ProjectRepository {
  if (repositoryInstance) return repositoryInstance

  const dataSource = (import.meta.env.VITE_DATA_SOURCE || 'mock').toLowerCase().trim()
  repositoryInstance =
    dataSource === 'api' ? new ProjectApiRepository() : new ProjectMockRepository()
  return repositoryInstance
}

export function setProjectRepositoryForTesting(repo: ProjectRepository | null): void {
  repositoryInstance = repo
}
