// SOLID: SRP — IMPLEMENTA EL ADAPTADOR HTTP DEL MÓDULO DE PROYECTOS.

import { getApiConfig } from '../../crm/config/apiConfig'
import { ProjectApiError, type ProjectRepository } from './projectRepository'
import type { Project, ProjectFilters, ProjectInput, ProjectPage, Task, TaskInput, TaskPage, TaskStatus } from '../types/project'

const BASE = '/api/v1/projects'

//SOLID: SRP — CONSTRUYE HEADERS DE SESIÓN Y TENANT PARA CADA REQUEST.
function headers(): Record<string, string> {
  const config = getApiConfig()
  return {
    'Content-Type': 'application/json',
    ...(config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}),
    ...(config.tenantId ? { 'X-Tenant-ID': config.tenantId } : {}),
  }
}

//SOLID: SRP — MAPEA EL ESTADO HTTP A UN ERROR PÚBLICO DEL MÓDULO.
async function error(response: Response): Promise<ProjectApiError> {
  if (response.status === 404) return new ProjectApiError('No se encontró el proyecto o la tarea.', 'not_found')
  if (response.status === 409) return new ProjectApiError('La transición solicitada entra en conflicto con el estado actual.', 'conflict')
  if (response.status === 400) return new ProjectApiError('Revisa los datos ingresados.', 'validation')
  if (response.status === 401 || response.status === 403) return new ProjectApiError('No tienes una sesión o permiso válido.', 'unknown')
  return new ProjectApiError('No se pudo completar la operación de proyectos.', 'unknown')
}

//SOLID: SRP — EJECUTA REQUESTS REST DEL MÓDULO Y MANEJA ERRORES DE RED.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getApiConfig()
  let response: Response
  try {
    response = await fetch(`${config.baseUrl}${path}`, { ...init, headers: { ...headers(), ...init?.headers } })
  } catch { throw new ProjectApiError('No se pudo conectar con Projects.', 'service_unavailable') }
  if (!response.ok) throw await error(response)
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

//SOLID: SRP — IMPLEMENTA LOS ENDPOINTS REST PÚBLICOS DE PROJECTS.
export class ProjectApiRepository implements ProjectRepository {
  //SOLID: SRP — LISTA PROYECTOS PAGINADOS EN EL SERVIDOR.
  async list(filters: ProjectFilters = {}, page = 0): Promise<ProjectPage> {
    const query = new URLSearchParams({ page: String(page), size: '5' })
    if (filters.search?.trim()) query.set('search', filters.search.trim())
    return request(`${BASE}?${query}`)
  }
  //SOLID: SRP — OBTIENE EL DETALLE DE UN PROYECTO.
  async getById(id: string): Promise<Project> { return request(`${BASE}/${encodeURIComponent(id)}`) }
  //SOLID: SRP — CREA UN PROYECTO CON LOS CAMPOS ACEPTADOS POR EL DTO BACKEND.
  async create(input: ProjectInput): Promise<Project> {
    return request(BASE, { method: 'POST', body: JSON.stringify(input) })
  }
  //SOLID: SRP — ACTUALIZA LOS CAMPOS EDITABLES DE UN PROYECTO.
  async update(id: string, input: ProjectInput): Promise<Project> {
    return request(`${BASE}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })
  }
  //SOLID: SRP — LISTA TAREAS DEL PROYECTO CON FILTRO Y PÁGINA DE CINCO.
  async listTasks(projectId: string, status?: TaskStatus | '', page = 0): Promise<TaskPage> {
    const query = new URLSearchParams({ page: String(page), size: '5' })
    if (status) query.set('status', status)
    return request(`${BASE}/${encodeURIComponent(projectId)}/tasks?${query}`)
  }
  //SOLID: SRP — CREA UNA TAREA BAJO EL PROYECTO SELECCIONADO.
  async createTask(projectId: string, input: TaskInput): Promise<Task> {
    return request(`${BASE}/${encodeURIComponent(projectId)}/tasks`, { method: 'POST', body: JSON.stringify(input) })
  }
  //SOLID: SRP — ACTUALIZA EL ESTADO POR EL ENDPOINT DE TRANSICIÓN DEL BACKEND.
  async updateTaskStatus(projectId: string, taskId: string, status: TaskStatus): Promise<Task> {
    return request(`${BASE}/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) })
  }
}
