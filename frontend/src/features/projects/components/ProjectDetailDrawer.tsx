// SOLID: SRP - MUESTRA EL DETALLE DE UN PROYECTO Y SU TABLERO KANBAN DE TAREAS.

import { useEffect, useMemo, useState } from 'react'
import { Drawer, Button, Badge } from '../../../components/ui'
import { Alert, Spinner } from '../../../components/feedback'
import type { Project, Task, TaskStatus } from '../types/project'
import type { ProjectRepository } from '../services'
import { formatProjectDate, getProjectProgress } from '../utils/projectFormat'
import { KanbanBoard, type KanbanColumnState } from '../components/KanbanBoard'
import { TaskDrawer } from '../components/TaskDrawer'

export interface ProjectDetailDrawerProps {
  isOpen: boolean
  project: Project | null
  repository: ProjectRepository
  onClose: () => void
  onTasksChange: (projectId: string, tasks: Task[]) => void
}

const STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED']
const COLUMN_PAGE_SIZE = 5

function emptyColumnState(loading: boolean, error: string | null = null): Record<TaskStatus, KanbanColumnState> {
  return {
    PENDING: { page: null, loading, error, pageIndex: 0 },
    IN_PROGRESS: { page: null, loading, error, pageIndex: 0 },
    BLOCKED: { page: null, loading, error, pageIndex: 0 },
    COMPLETED: { page: null, loading, error, pageIndex: 0 },
  }
}

async function fetchAllProjectTasks(repo: ProjectRepository, projectId: string): Promise<Task[]> {
  const all: Task[] = []
  let page = 0
  let hasNext = true
  while (hasNext) {
    const result = await repo.listTasks(projectId, '', page)
    all.push(...result.items)
    hasNext = result.hasNext
    page += 1
  }
  return all
}

function buildColumns(tasks: Task[], pageIndexes: Record<TaskStatus, number>): Record<TaskStatus, KanbanColumnState> {
  const result = {} as Record<TaskStatus, KanbanColumnState>
  for (const status of STATUSES) {
    const filtered = tasks.filter((t) => t.status === status)
    const pageIndex = pageIndexes[status] ?? 0
    const start = pageIndex * COLUMN_PAGE_SIZE
    const items = filtered.slice(start, start + COLUMN_PAGE_SIZE)
    const hasNext = start + COLUMN_PAGE_SIZE < filtered.length
    result[status] = {
      page: { items, page: pageIndex, size: COLUMN_PAGE_SIZE, hasNext },
      loading: false,
      error: null,
      pageIndex,
    }
  }
  return result
}

// SOLID: SRP - COORDINA LA CARGA Y ACTUALIZACION DE TAREAS DEL PROYECTO EN EL TABLERO.
export function ProjectDetailDrawer({
  isOpen,
  project,
  repository,
  onClose,
  onTasksChange,
}: ProjectDetailDrawerProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [pageIndexes, setPageIndexes] = useState<Record<TaskStatus, number>>({
    PENDING: 0,
    IN_PROGRESS: 0,
    BLOCKED: 0,
    COMPLETED: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!isOpen || !project) return
    let ignore = false
    const projectId = project.id

    async function load() {
      try {
        const all = await fetchAllProjectTasks(repository, projectId)
        if (ignore) return
        setTasks(all)
        setError(null)
      } catch (err) {
        if (ignore) return
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las tareas.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [isOpen, project, repository, reloadKey])

  const columns = useMemo(() => {
    if (loading) return emptyColumnState(true)
    if (error) return emptyColumnState(false, error)
    return buildColumns(tasks, pageIndexes)
  }, [tasks, pageIndexes, loading, error])

  const progress = useMemo(() => getProjectProgress(tasks), [tasks])

  function handlePageChange(status: TaskStatus, page: number) {
    setPageIndexes((prev) => ({ ...prev, [status]: page }))
  }

  function handleRetry() {
    setLoading(true)
    setError(null)
    setPageIndexes({ PENDING: 0, IN_PROGRESS: 0, BLOCKED: 0, COMPLETED: 0 })
    setReloadKey((prev) => prev + 1)
  }

  async function handleStatusChange(taskId: string, fromStatus: TaskStatus, toStatus: TaskStatus) {
    if (!project || fromStatus === toStatus) return
    setUpdatingTaskId(taskId)
    setNotice(null)
    try {
      const updated = await repository.updateTaskStatus(project.id, taskId, toStatus)
      const next = tasks.map((t) => (t.id === taskId ? updated : t))
      setTasks(next)
      onTasksChange(project.id, next)
      setNotice('Estado de tarea actualizado.')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la tarea.')
    } finally {
      setUpdatingTaskId(null)
    }
  }

  function handleTaskCreated(task: Task) {
    if (!project) return
    const next = [task, ...tasks]
    setTasks(next)
    onTasksChange(project.id, next)
    setNotice(`Tarea "${task.title}" creada correctamente.`)
  }

  if (!project) return null

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={project.name}
      panelClassName="projects-detail-drawer"
      footer={
        <div className="projects-detail-drawer__footer">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button variant="primary" onClick={() => setTaskDrawerOpen(true)}>
            + Nueva tarea
          </Button>
        </div>
      }
    >
      <div className="projects-detail-drawer__content">
        <section className="projects-detail-drawer__summary" aria-label="Resumen del proyecto">
          {project.description && <p className="projects-detail-drawer__description">{project.description}</p>}
          <div className="projects-detail-drawer__meta">
            <div>
              <span className="projects-detail-drawer__meta-label">Inicio</span>
              <span className="projects-detail-drawer__meta-value">{formatProjectDate(project.startDate)}</span>
            </div>
            <div>
              <span className="projects-detail-drawer__meta-label">Fin</span>
              <span className="projects-detail-drawer__meta-value">{formatProjectDate(project.endDate)}</span>
            </div>
            <div>
              <span className="projects-detail-drawer__meta-label">Avance</span>
              <span className="projects-detail-drawer__meta-value">
                <Badge variant={progress.percentage === 100 ? 'success' : 'info'}>
                  {progress.percentage}% ({progress.completedTasks}/{progress.totalTasks})
                </Badge>
              </span>
            </div>
          </div>
        </section>

        {notice && (
          <div role="status" className="projects-detail-drawer__notice">
            {notice}
          </div>
        )}

        {loading ? (
          <div className="projects-detail-drawer__loading">
            <Spinner size="lg" label="Cargando tareas..." />
          </div>
        ) : error && tasks.length === 0 ? (
          <Alert variant="error" title="Error al cargar tareas">
            <p>{error}</p>
            <Button variant="secondary" size="sm" onClick={handleRetry}>
              Reintentar
            </Button>
          </Alert>
        ) : (
          <>
            {error && (
              <Alert variant="error" title="No se pudo actualizar la tarea">
                <p>{error}</p>
              </Alert>
            )}
            <KanbanBoard
              columns={columns}
              onPageChange={handlePageChange}
              onRetry={handleRetry}
              onStatusChange={handleStatusChange}
              updatingTaskId={updatingTaskId}
            />
          </>
        )}
      </div>

      <TaskDrawer
        isOpen={taskDrawerOpen}
        projectId={project.id}
        onClose={() => setTaskDrawerOpen(false)}
        onCreated={handleTaskCreated}
        repository={repository}
      />
    </Drawer>
  )
}
