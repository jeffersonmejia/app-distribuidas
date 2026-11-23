// SOLID: ISP - DEFINE EL CONTRATO Y ERRORES DEL REPOSITORIO DE PROYECTOS Y TAREAS.

import type {
  Project,
  ProjectFilters,
  ProjectInput,
  ProjectPage,
  Task,
  TaskInput,
  TaskPage,
  TaskStatus,
} from '../types/project'

export type ProjectErrorKind =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'service_unavailable'
  | 'unknown'

export class ProjectApiError extends Error {
  readonly kind: ProjectErrorKind
  readonly details?: Record<string, string>

  constructor(
    message: string,
    kind: ProjectErrorKind,
    details?: Record<string, string>
  ) {
    super(message)
    this.name = 'ProjectApiError'
    this.kind = kind
    this.details = details
  }
}

export interface ProjectRepository {
  list(filters?: ProjectFilters, page?: number): Promise<ProjectPage>
  getById(id: string): Promise<Project>
  create(input: ProjectInput): Promise<Project>
  update(id: string, input: ProjectInput): Promise<Project>
  listTasks(projectId: string, status?: TaskStatus | '', page?: number): Promise<TaskPage>
  createTask(projectId: string, input: TaskInput): Promise<Task>
  updateTaskStatus(projectId: string, taskId: string, status: TaskStatus): Promise<Task>
}
