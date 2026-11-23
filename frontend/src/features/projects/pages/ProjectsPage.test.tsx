import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectsPage } from './ProjectsPage'
import type { ProjectRepository } from '../services'
import type { Project, ProjectFilters, ProjectPage, Task, TaskInput, TaskPage, TaskStatus } from '../types/project'
import { cleanupSessionTestState, renderWithProviders } from '../../../test/renderWithProviders'

class FastProjectRepo implements ProjectRepository {
  private projects: Project[]
  private tasks: Task[]
  private nextProject = 100
  private nextTask = 1000

  constructor(seed?: { projects?: Project[]; tasks?: Task[] }) {
    this.projects = seed?.projects?.map((p) => ({ ...p })) ?? [
      {
        id: 'prj-1',
        name: 'Proyecto Alfa',
        description: 'Implementación inicial',
        startDate: '2026-10-01',
        endDate: '2026-12-01',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
        deletedAt: null,
      },
      {
        id: 'prj-2',
        name: 'Proyecto Beta',
        description: 'Mejora logística',
        startDate: '2026-09-01',
        endDate: '2026-11-30',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-11-02T00:00:00Z',
        deletedAt: null,
      },
    ]
    this.tasks = seed?.tasks?.map((t) => ({ ...t })) ?? [
      { id: 'tsk-1', projectId: 'prj-1', title: 'Tarea A', description: 'Desc A', assigneeId: null, priority: 'HIGH', dueDate: '2026-11-20', status: 'COMPLETED', createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z', deletedAt: null },
      { id: 'tsk-2', projectId: 'prj-1', title: 'Tarea B', description: 'Desc B', assigneeId: 'usr-1', priority: 'MEDIUM', dueDate: '2026-11-25', status: 'IN_PROGRESS', createdAt: '2026-10-03T00:00:00Z', updatedAt: '2026-10-11T00:00:00Z', deletedAt: null },
      { id: 'tsk-3', projectId: 'prj-1', title: 'Tarea C', description: null, assigneeId: null, priority: 'LOW', dueDate: null, status: 'PENDING', createdAt: '2026-10-04T00:00:00Z', updatedAt: '2026-10-12T00:00:00Z', deletedAt: null },
      { id: 'tsk-4', projectId: 'prj-1', title: 'Tarea D', description: null, assigneeId: null, priority: null, dueDate: null, status: 'BLOCKED', createdAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z', deletedAt: null },
      { id: 'tsk-5', projectId: 'prj-2', title: 'Tarea Beta 1', description: null, assigneeId: null, priority: 'MEDIUM', dueDate: '2026-11-10', status: 'COMPLETED', createdAt: '2026-09-02T00:00:00Z', updatedAt: '2026-09-10T00:00:00Z', deletedAt: null },
    ]
  }

  async list(filters: ProjectFilters = {}, page = 0): Promise<ProjectPage> {
    let items = [...this.projects]
    if (filters.search?.trim()) {
      const term = filters.search.trim().toLowerCase()
      items = items.filter(
        (p) => p.name.toLowerCase().includes(term) || (p.description ?? '').toLowerCase().includes(term)
      )
    }
    const start = page * 5
    const pageItems = items.slice(start, start + 5)
    return { items: pageItems.map((p) => ({ ...p })), page, size: 5, hasNext: start + 5 < items.length }
  }

  async getById(id: string): Promise<Project> {
    const project = this.projects.find((p) => p.id === id)
    if (!project) throw new Error('Proyecto no encontrado.')
    return { ...project }
  }

  async create(input: { name: string; description?: string | null; startDate?: string | null; endDate?: string | null }): Promise<Project> {
    if (!input.name.trim()) throw new Error('El nombre del proyecto es obligatorio.')
    const now = new Date().toISOString()
    this.nextProject += 1
    const project: Project = {
      id: `prj-new-${this.nextProject}`,
      name: input.name.trim(),
      description: input.description ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    this.projects = [project, ...this.projects]
    return { ...project }
  }

  async update(id: string, input: Project): Promise<Project> {
    this.projects = this.projects.map((p) => (p.id === id ? { ...p, ...input } : p))
    return this.getById(id)
  }

  async listTasks(projectId: string, status: TaskStatus | '' = '', page = 0): Promise<TaskPage> {
    let items = this.tasks.filter((t) => t.projectId === projectId)
    if (status) items = items.filter((t) => t.status === status)
    const start = page * 5
    const pageItems = items.slice(start, start + 5)
    return { items: pageItems.map((t) => ({ ...t })), page, size: 5, hasNext: start + 5 < items.length }
  }

  async createTask(projectId: string, input: TaskInput): Promise<Task> {
    if (!input.title.trim()) throw new Error('El título de la tarea es obligatorio.')
    const now = new Date().toISOString()
    this.nextTask += 1
    const task: Task = {
      id: `tsk-new-${this.nextTask}`,
      projectId,
      title: input.title.trim(),
      description: input.description ?? null,
      assigneeId: input.assigneeId ?? null,
      priority: input.priority ?? null,
      dueDate: input.dueDate ?? null,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    this.tasks = [task, ...this.tasks]
    return { ...task }
  }

  async updateTaskStatus(projectId: string, taskId: string, status: TaskStatus): Promise<Task> {
    const idx = this.tasks.findIndex((t) => t.id === taskId && t.projectId === projectId)
    if (idx < 0) throw new Error('Tarea no encontrada.')
    this.tasks[idx] = { ...this.tasks[idx], status, updatedAt: new Date().toISOString() }
    return { ...this.tasks[idx] }
  }
}

function makeManyProjects(count: number): Project[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `prj-many-${i + 1}`,
    name: `Proyecto ${i + 1}`,
    description: null,
    startDate: null,
    endDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
  }))
}

describe('ProjectsPage', () => {
  afterEach(() => {
    cleanupSessionTestState()
  })

  it('renderiza encabezado, métricas y tabla con proyectos cargados', async () => {
    renderWithProviders(<ProjectsPage repository={new FastProjectRepo()} />, { initialPath: '/projects' })

    expect(screen.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Proyecto Alfa')).toBeInTheDocument()
      expect(screen.getByText('Proyecto Beta')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('Tareas totales')).toBeInTheDocument()
      expect(screen.getByText('Completadas')).toBeInTheDocument()
      expect(screen.getByText('En progreso')).toBeInTheDocument()
    })
  })

  it('permite buscar proyectos con debounce', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProjectsPage repository={new FastProjectRepo()} />, { initialPath: '/projects' })

    await waitFor(() => expect(screen.getByText('Proyecto Alfa')).toBeInTheDocument())

    const search = screen.getByPlaceholderText(/buscar por nombre o descripción/i)
    await user.type(search, 'logística')

    await waitFor(() => {
      expect(screen.getByText('Proyecto Beta')).toBeInTheDocument()
      expect(screen.queryByText('Proyecto Alfa')).not.toBeInTheDocument()
    })
  })

  it('permite paginar el listado de proyectos', async () => {
    const user = userEvent.setup()
    const repo = new FastProjectRepo({ projects: makeManyProjects(6), tasks: [] })
    renderWithProviders(<ProjectsPage repository={repo} />, { initialPath: '/projects' })

    await waitFor(() => expect(screen.getByText('Proyecto 1')).toBeInTheDocument())
    expect(screen.getByText('Proyecto 5')).toBeInTheDocument()
    expect(screen.queryByText('Proyecto 6')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ir a página siguiente/i }))

    await waitFor(() => {
      expect(screen.getByText('Proyecto 6')).toBeInTheDocument()
    })
  })

  it('valida y crea un proyecto mostrando éxito', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProjectsPage repository={new FastProjectRepo({ projects: [], tasks: [] })} />, {
      initialPath: '/projects',
    })

    await waitFor(() => expect(screen.getByText('Sin proyectos')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /\+ nuevo proyecto/i }))
    const dialog = await screen.findByRole('dialog', { name: /nuevo proyecto/i })

    await user.click(within(dialog).getByRole('button', { name: /guardar proyecto/i }))
    expect(await within(dialog).findByText(/el nombre del proyecto es obligatorio/i)).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/nombre del proyecto/i), 'Proyecto Nuevo')
    await user.type(within(dialog).getByLabelText(/descripción/i), 'Descripción breve')
    await user.click(within(dialog).getByRole('button', { name: /guardar proyecto/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/proyecto "proyecto nuevo" creado correctamente/i)
      expect(screen.getByText('Proyecto Nuevo')).toBeInTheDocument()
    })
  })

  it('muestra estado vacío cuando no hay resultados de búsqueda', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProjectsPage repository={new FastProjectRepo()} />, { initialPath: '/projects' })

    await waitFor(() => expect(screen.getByText('Proyecto Alfa')).toBeInTheDocument())
    await user.type(screen.getByPlaceholderText(/buscar por nombre o descripción/i), 'sin-coincidencias-xyz')

    await waitFor(() => {
      expect(screen.getByText('Sin proyectos')).toBeInTheDocument()
      expect(screen.getByText(/no se encontraron proyectos/i)).toBeInTheDocument()
    })
  })

  it('muestra error y permite reintentar', async () => {
    const user = userEvent.setup()
    const failingRepo: ProjectRepository = {
      list: vi.fn().mockRejectedValueOnce(new Error('Fallo de conexión')).mockResolvedValue({
        items: [],
        page: 0,
        size: 5,
        hasNext: false,
      }),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      listTasks: vi.fn().mockResolvedValue({ items: [], page: 0, size: 5, hasNext: false }),
      createTask: vi.fn(),
      updateTaskStatus: vi.fn(),
    }

    renderWithProviders(<ProjectsPage repository={failingRepo} />, { initialPath: '/projects' })

    await waitFor(() => {
      expect(screen.getByText(/error al cargar proyectos/i)).toBeInTheDocument()
      expect(screen.getByText(/fallo de conexión/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    await waitFor(() => expect(screen.getByText('Sin proyectos')).toBeInTheDocument())
  })

  it('respeta el aislamiento por tenant mediante repositorio', async () => {
    const tenantRepo = new FastProjectRepo({
      projects: [
        {
          id: 'prj-pacifico-1',
          name: 'Proyecto Pacífico',
          description: null,
          startDate: null,
          endDate: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
      ],
      tasks: [],
    })

    renderWithProviders(<ProjectsPage repository={tenantRepo} />, { initialPath: '/projects' })

    await waitFor(() => {
      expect(screen.getByText('Proyecto Pacífico')).toBeInTheDocument()
      expect(screen.queryByText('Proyecto Alfa')).not.toBeInTheDocument()
    })
  })

  it('muestra tablero kanban, permite cambiar estado y crear tareas con validación', async () => {
    const user = userEvent.setup()
    const repo = new FastProjectRepo()
    renderWithProviders(<ProjectsPage repository={repo} />, { initialPath: '/projects' })

    await waitFor(() => expect(screen.getByText('Proyecto Alfa')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /ver tablero de proyecto alfa/i }))

    const detail = await screen.findByRole('dialog', { name: /proyecto alfa/i })
    expect(within(detail).getByRole('heading', { name: 'Pendiente' })).toBeInTheDocument()
    expect(within(detail).getByRole('heading', { name: 'En progreso' })).toBeInTheDocument()
    expect(within(detail).getByRole('heading', { name: 'Bloqueada' })).toBeInTheDocument()
    expect(within(detail).getByRole('heading', { name: 'Completada' })).toBeInTheDocument()

    await waitFor(() => expect(within(detail).getByText('Tarea B')).toBeInTheDocument())

    const statusSelect = within(detail).getByLabelText(/cambiar estado de tarea b/i)
    await user.selectOptions(statusSelect, 'COMPLETED')

    await waitFor(() => {
      expect(within(detail).getByText(/estado de tarea actualizado/i)).toBeInTheDocument()
    })

    await user.click(within(detail).getByRole('button', { name: /\+ nueva tarea/i }))
    const taskDialog = await screen.findByRole('dialog', { name: /nueva tarea/i })

    await user.click(within(taskDialog).getByRole('button', { name: /guardar tarea/i }))
    expect(await within(taskDialog).findByText(/el título de la tarea es obligatorio/i)).toBeInTheDocument()

    await user.type(within(taskDialog).getByLabelText(/^título$/i), 'Tarea nueva QA')
    await user.click(within(taskDialog).getByRole('button', { name: /guardar tarea/i }))

    await waitFor(() => {
      expect(within(detail).getByText('Tarea nueva QA')).toBeInTheDocument()
      expect(within(detail).getByText(/tarea "tarea nueva qa" creada correctamente/i)).toBeInTheDocument()
    })
  })
})
