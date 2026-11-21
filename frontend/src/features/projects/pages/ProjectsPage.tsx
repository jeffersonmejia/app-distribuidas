// SOLID: SRP - RENDERIZA LA VISTA PRINCIPAL DE PROYECTOS CON LISTADO, METRICAS Y CREACION.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PageHeader } from '../../../components/navigation'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { Pagination } from '../../../components/navigation/Pagination'
import { Button, Badge, MetricCard } from '../../../components/ui'
import { Spinner, Alert, EmptyState } from '../../../components/feedback'
import { useSession } from '../../identity/hooks'
import { getProjectRepository, type ProjectRepository } from '../services'
import type { Project, Task } from '../types/project'
import { formatProjectDate, getProjectProgress } from '../utils/projectFormat'
import { ProjectDrawer } from '../components/ProjectDrawer'
import { ProjectDetailDrawer } from '../components/ProjectDetailDrawer'
import './ProjectsPage.css'

const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Proyecto' },
  { key: 'dates', label: 'Fechas' },
  { key: 'progress', label: 'Avance' },
  { key: 'tasks', label: 'Tareas' },
  { key: 'actions', label: 'Acciones', align: 'right' },
]

type LoadState = 'idle' | 'loading' | 'success' | 'error'

interface ProjectMetrics {
  totalProjects: number
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
}

export interface ProjectsPageProps {
  repository?: ProjectRepository
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

async function fetchAllProjects(repo: ProjectRepository): Promise<Project[]> {
  const all: Project[] = []
  let page = 0
  let hasNext = true
  while (hasNext) {
    const result = await repo.list({}, page)
    all.push(...result.items)
    hasNext = result.hasNext
    page += 1
  }
  return all
}

// SOLID: SRP - ORQUESTA LA CARGA, FILTRADO Y VISUALIZACION DEL MODULO DE PROYECTOS.
export function ProjectsPage({ repository }: ProjectsPageProps) {
  const { tenant } = useSession()
  const tenantId = tenant?.id
  const repo = useMemo(() => {
    void tenantId
    return repository ?? getProjectRepository()
  }, [repository, tenantId])

  const [projects, setProjects] = useState<Project[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({})
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [metricsReloadKey, setMetricsReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false

    async function loadProjects() {
      try {
        const result = await repo.list({ search: search || undefined }, page)
        if (ignore) return
        setProjects(result.items)
        setHasNext(result.hasNext)

        const entries = await Promise.all(
          result.items.map(
            async (project) => [project.id, await fetchAllProjectTasks(repo, project.id)] as const
          )
        )
        if (ignore) return
        const map: Record<string, Task[]> = {}
        for (const [id, tasks] of entries) map[id] = tasks
        setTasksByProject((prev) => ({ ...prev, ...map }))
        setErrorMessage(null)
        setLoadState('success')
      } catch (error) {
        if (ignore) return
        const message = error instanceof Error ? error.message : 'No se pudieron cargar los proyectos.'
        setErrorMessage(message)
        setLoadState('error')
      }
    }

    void loadProjects()
    return () => {
      ignore = true
    }
  }, [repo, page, search, reloadKey])

  useEffect(() => {
    let ignore = false

    async function loadMetrics() {
      try {
        const allProjects = await fetchAllProjects(repo)
        const allTasksArrays = await Promise.all(
          allProjects.map((project) => fetchAllProjectTasks(repo, project.id))
        )
        if (ignore) return
        const allTasks = allTasksArrays.flat()
        setMetrics({
          totalProjects: allProjects.length,
          totalTasks: allTasks.length,
          completedTasks: allTasks.filter((t) => t.status === 'COMPLETED').length,
          inProgressTasks: allTasks.filter((t) => t.status === 'IN_PROGRESS').length,
        })
      } catch {
        if (!ignore) setMetrics(null)
      } finally {
        if (!ignore) setMetricsLoading(false)
      }
    }

    void loadMetrics()
    return () => {
      ignore = true
    }
  }, [repo, reloadKey, metricsReloadKey])

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoadState('loading')
      setErrorMessage(null)
      setSearch(value)
      setPage(0)
    }, 300)
  }

  function handleRetry() {
    setLoadState('loading')
    setErrorMessage(null)
    setMetricsLoading(true)
    setReloadKey((prev) => prev + 1)
  }

  function handleCreated(project: Project) {
    setSuccessNotice(`Proyecto "${project.name}" creado correctamente.`)
    setLoadState('loading')
    setMetricsLoading(true)
    setPage(0)
    setReloadKey((prev) => prev + 1)
  }

  function handleDetailTasksChange(projectId: string, tasks: Task[]) {
    setTasksByProject((prev) => ({ ...prev, [projectId]: tasks }))
    setMetricsLoading(true)
    setMetricsReloadKey((prev) => prev + 1)
  }

  const totalLabel = metrics?.totalProjects ?? projects.length
  const description = `${totalLabel} proyectos registrados · Seguimiento de avance por tareas`

  let content: ReactNode

  if (loadState === 'loading') {
    content = (
      <div className="projects-page__state">
        <Spinner size="lg" label="Cargando proyectos..." />
      </div>
    )
  } else if (loadState === 'error') {
    content = (
      <Alert variant="error" title="Error al cargar proyectos">
        <p>{errorMessage}</p>
        <Button variant="secondary" size="sm" onClick={handleRetry}>
          Reintentar
        </Button>
      </Alert>
    )
  } else if (projects.length === 0) {
    content = (
      <EmptyState
        title="Sin proyectos"
        description={
          search
            ? 'No se encontraron proyectos con los filtros aplicados.'
            : 'No hay proyectos registrados en esta organización.'
        }
        action={
          search ? undefined : (
            <Button variant="primary" onClick={() => setDrawerOpen(true)}>
              Crear proyecto
            </Button>
          )
        }
      />
    )
  } else {
    content = (
      <>
        <Table columns={COLUMNS} caption="Listado de proyectos y avance">
          {projects.map((project) => {
            const tasks = tasksByProject[project.id] ?? []
            const progress = getProjectProgress(tasks)
            return (
              <tr key={project.id} className="projects-page__row">
                <td className="projects-page__cell">
                  <div className="projects-page__name-cell">
                    <span className="projects-page__name">{project.name}</span>
                    {project.description && (
                      <span className="projects-page__description">{project.description}</span>
                    )}
                  </div>
                </td>
                <td className="projects-page__cell">
                  <div className="projects-page__dates">
                    <span>{formatProjectDate(project.startDate)}</span>
                    <span className="projects-page__dates-sep">-</span>
                    <span>{formatProjectDate(project.endDate)}</span>
                  </div>
                </td>
                <td className="projects-page__cell">
                  <div
                    className="projects-page__progress"
                    aria-label={`Avance ${progress.percentage} por ciento`}
                  >
                    <div className="projects-page__progress-meta">
                      <span className="projects-page__progress-value">{progress.percentage}%</span>
                      <span className="projects-page__progress-count">
                        {progress.completedTasks}/{progress.totalTasks}
                      </span>
                    </div>
                    <div
                      className="projects-page__progress-track"
                      role="progressbar"
                      aria-valuenow={progress.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="projects-page__progress-bar"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="projects-page__cell">
                  <Badge variant={progress.totalTasks > 0 ? 'info' : 'neutral'}>
                    {progress.totalTasks} tareas
                  </Badge>
                </td>
                <td className="projects-page__cell projects-page__cell--right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedProject(project)}
                    aria-label={`Ver tablero de ${project.name}`}
                  >
                    Ver tablero
                  </Button>
                </td>
              </tr>
            )
          })}
        </Table>

        <Pagination
          currentPage={page}
          hasNext={hasNext}
          onPageChange={(next) => {
            setLoadState('loading')
            setPage(next)
          }}
          isLoading={false}
          itemsCount={projects.length}
          itemLabel="proyecto"
          itemLabelPlural="proyectos"
        />
      </>
    )
  }

  return (
    <div className="projects-page">
      <PageHeader
        title="Proyectos"
        description={description}
        badgeText="Módulo operativo · Seguimiento de proyectos"
        searchPlaceholder="Buscar por nombre o descripción..."
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        actions={
          <Button
            variant="primary"
            className="projects-page__header-btn--primary"
            onClick={() => setDrawerOpen(true)}
          >
            + Nuevo proyecto
          </Button>
        }
      />

      {successNotice && (
        <div role="status" className="projects-page__status-banner">
          {successNotice}
        </div>
      )}

      <section className="projects-page__metrics" aria-label="Métricas de proyectos">
        <MetricCard
          title="Proyectos"
          value={metrics?.totalProjects ?? (metricsLoading ? '…' : 0)}
          subtitle="Registrados en la organización"
          iconVariant="primary"
          icon={<span aria-hidden="true">P</span>}
        />
        <MetricCard
          title="Tareas totales"
          value={metrics?.totalTasks ?? (metricsLoading ? '…' : 0)}
          subtitle="En todos los proyectos"
          iconVariant="neutral"
          icon={<span aria-hidden="true">T</span>}
        />
        <MetricCard
          title="Completadas"
          value={metrics?.completedTasks ?? (metricsLoading ? '…' : 0)}
          subtitle="Tareas finalizadas"
          iconVariant="success"
          icon={<span aria-hidden="true">✓</span>}
        />
        <MetricCard
          title="En progreso"
          value={metrics?.inProgressTasks ?? (metricsLoading ? '…' : 0)}
          subtitle="Tareas en ejecución"
          iconVariant="warning"
          icon={<span aria-hidden="true">↻</span>}
        />
      </section>

      {content}

      <ProjectDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={handleCreated}
        repository={repo}
      />

      <ProjectDetailDrawer
        key={selectedProject?.id ?? 'closed'}
        isOpen={selectedProject !== null}
        project={selectedProject}
        repository={repo}
        onClose={() => setSelectedProject(null)}
        onTasksChange={handleDetailTasksChange}
      />
    </div>
  )
}

