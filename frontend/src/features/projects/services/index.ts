// SOLID: OCP - DEFINE LA FABRICA DEL REPOSITORIO DE PROYECTOS SEGUN LA FUENTE DE DATOS.

import type { ProjectRepository } from './projectRepository'
import type { Project, ProjectPage, Task, TaskPage } from '../types/project'
import { ProjectMockRepository } from './projectMock'
import { ProjectApiError } from './projectRepository'

export * from './projectRepository'
export * from './projectMock'

class UnavailableProjectApiRepository implements ProjectRepository {
  async list(): Promise<ProjectPage> {
    throw new ProjectApiError('Servicio de proyectos no disponible todavía.', 'service_unavailable')
  }

  async getById(): Promise<Project> {
    throw new ProjectApiError('Servicio de proyectos no disponible todavía.', 'service_unavailable')
  }

  async create(): Promise<Project> {
    throw new ProjectApiError('Servicio de proyectos no disponible todavía.', 'service_unavailable')
  }

  async update(): Promise<Project> {
    throw new ProjectApiError('Servicio de proyectos no disponible todavía.', 'service_unavailable')
  }

  async listTasks(): Promise<TaskPage> {
    throw new ProjectApiError('Servicio de proyectos no disponible todavía.', 'service_unavailable')
  }

  async createTask(): Promise<Task> {
    throw new ProjectApiError('Servicio de proyectos no disponible todavía.', 'service_unavailable')
  }

  async updateTaskStatus(): Promise<Task> {
    throw new ProjectApiError('Servicio de proyectos no disponible todavía.', 'service_unavailable')
  }
}

let repositoryInstance: ProjectRepository | null = null

export function getProjectRepository(): ProjectRepository {
  if (repositoryInstance) return repositoryInstance

  const dataSource = (import.meta.env.VITE_DATA_SOURCE || 'mock').toLowerCase().trim()
  repositoryInstance =
    dataSource === 'api' ? new UnavailableProjectApiRepository() : new ProjectMockRepository()
  return repositoryInstance
}

export function setProjectRepositoryForTesting(repo: ProjectRepository | null): void {
  repositoryInstance = repo
}
