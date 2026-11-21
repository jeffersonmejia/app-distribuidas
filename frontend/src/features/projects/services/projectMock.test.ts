import { beforeEach, describe, expect, it } from 'vitest'
import {
  ProjectApiError,
  ProjectMockRepository,
  getProjectRepository,
  resetProjectMockStore,
  setProjectRepositoryForTesting,
} from './index'

describe('ProjectMockRepository', () => {
  let repo: ProjectMockRepository

  beforeEach(() => {
    resetProjectMockStore()
    setProjectRepositoryForTesting(null)
    repo = new ProjectMockRepository()
  })

  it('lista proyectos paginados con tamaño máximo de 5', async () => {
    const page0 = await repo.list({}, 0)
    expect(page0.size).toBe(5)
    expect(page0.items.length).toBe(5)
    expect(page0.hasNext).toBe(true)

    const page1 = await repo.list({}, 1)
    expect(page1.items.length).toBeGreaterThan(0)
    expect(page1.items.length).toBeLessThanOrEqual(5)
  })

  it('filtra proyectos por búsqueda en nombre o descripción', async () => {
    const byName = await repo.list({ search: 'logística' })
    expect(byName.items.some((p) => p.name.toLowerCase().includes('logística'))).toBe(true)

    const byDescription = await repo.list({ search: 'inventario' })
    expect(byDescription.items.length).toBeGreaterThan(0)
  })

  it('crea un proyecto con validación y datos normalizados', async () => {
    const created = await repo.create({
      name: '  Proyecto de prueba  ',
      description: '  Seguimiento inicial  ',
      startDate: '2026-12-01',
      endDate: '2026-12-20',
    })

    expect(created.name).toBe('Proyecto de prueba')
    expect(created.description).toBe('Seguimiento inicial')
    expect(created.startDate).toBe('2026-12-01')
    expect(created.id).toBeTruthy()

    const found = await repo.getById(created.id)
    expect(found.name).toBe('Proyecto de prueba')
  })

  it('rechaza fechas inválidas al crear proyecto', async () => {
    await expect(
      repo.create({
        name: 'Proyecto inválido',
        startDate: '2026-12-10',
        endDate: '2026-12-01',
      })
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ProjectApiError)
      expect((error as ProjectApiError).kind).toBe('validation')
      return true
    })
  })

  it('lista tareas por proyecto y estado con paginación de 5', async () => {
    const projects = await repo.list({}, 0)
    const projectId = projects.items[0].id

    const all = await repo.listTasks(projectId, '', 0)
    expect(all.size).toBe(5)
    expect(all.items.length).toBeLessThanOrEqual(5)
    expect(all.items.every((task) => task.projectId === projectId)).toBe(true)

    const completed = await repo.listTasks(projectId, 'COMPLETED', 0)
    expect(completed.items.every((task) => task.status === 'COMPLETED')).toBe(true)
  })

  it('crea tareas y actualiza su estado', async () => {
    const projects = await repo.list({}, 0)
    const projectId = projects.items[0].id

    const task = await repo.createTask(projectId, {
      title: 'Nueva tarea de control',
      description: 'Validar entregables',
      priority: 'HIGH',
      dueDate: '2026-12-05',
    })

    expect(task.status).toBe('PENDING')
    expect(task.title).toBe('Nueva tarea de control')

    const updated = await repo.updateTaskStatus(projectId, task.id, 'IN_PROGRESS')
    expect(updated.status).toBe('IN_PROGRESS')
    expect(updated.projectId).toBe(projectId)
  })

  it('mantiene aislamiento de datos por tenant', async () => {
    const otherRepo = new ProjectMockRepository('tnt-pacifico-002')
    const andina = await repo.list({}, 0)
    const pacifico = await otherRepo.list({}, 0)

    expect(andina.items.length).toBeGreaterThan(0)
    expect(pacifico.items.length).toBeGreaterThan(0)
    expect(andina.items.some((p) => p.id.startsWith('prj-andina-'))).toBe(true)
    expect(pacifico.items.every((p) => p.id.startsWith('prj-pacifico-'))).toBe(true)
  })

  it('devuelve error de servicio no disponible cuando la fuente es api', async () => {
    const original = import.meta.env.VITE_DATA_SOURCE
    import.meta.env.VITE_DATA_SOURCE = 'api'
    setProjectRepositoryForTesting(null)

    await expect(getProjectRepository().list({}, 0)).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ProjectApiError)
      expect((error as ProjectApiError).kind).toBe('service_unavailable')
      return true
    })

    import.meta.env.VITE_DATA_SOURCE = original
  })
})
