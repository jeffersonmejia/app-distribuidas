// SOLID: SRP - RENDERIZA EL TABLERO KANBAN DE TAREAS CON COLUMNAS Y PAGINACION INDEPENDIENTE.

import { Pagination } from '../../../components/navigation/Pagination'
import { Spinner, Alert, EmptyState } from '../../../components/feedback'
import type { Task, TaskPage, TaskStatus } from '../types/project'
import { TASK_STATUS_LABELS } from '../utils/projectFormat'
import { KanbanCard } from './KanbanCard'

export type KanbanColumnState = {
  page: TaskPage | null
  loading: boolean
  error: string | null
  pageIndex: number
}

export interface KanbanBoardProps {
  columns: Record<TaskStatus, KanbanColumnState>
  onPageChange: (status: TaskStatus, page: number) => void
  onRetry: (status: TaskStatus) => void
  onStatusChange: (taskId: string, fromStatus: TaskStatus, toStatus: TaskStatus) => void
  updatingTaskId: string | null
}

const COLUMN_ORDER: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED']

export function KanbanBoard({
  columns,
  onPageChange,
  onRetry,
  onStatusChange,
  updatingTaskId,
}: KanbanBoardProps) {
  return (
    <div className="kanban-board" aria-label="Tablero de tareas del proyecto">
      {COLUMN_ORDER.map((status) => {
        const column = columns[status]
        const items = column.page?.items ?? []
        const count = items.length

        return (
          <section key={status} className="kanban-column" aria-label={TASK_STATUS_LABELS[status]}>
            <header className="kanban-column__header">
              <h3 className="kanban-column__title">{TASK_STATUS_LABELS[status]}</h3>
              <span className="kanban-column__count" aria-label={`${count} tareas`}>
                {count}
              </span>
            </header>

            <div className="kanban-column__body">
              {column.loading ? (
                <div className="kanban-column__state">
                  <Spinner size="sm" label="Cargando tareas..." />
                </div>
              ) : column.error ? (
                <Alert variant="error" title="No se pudieron cargar las tareas">
                  <p>{column.error}</p>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => onRetry(status)}>
                    Reintentar
                  </button>
                </Alert>
              ) : items.length === 0 ? (
                <EmptyState
                  title="Sin tareas"
                  description="No hay tareas en este estado."
                />
              ) : (
                <ul className="kanban-column__list">
                  {items.map((task: Task) => (
                    <li key={task.id} className="kanban-column__item">
                      <KanbanCard
                        task={task}
                        isUpdating={updatingTaskId === task.id}
                        onStatusChange={(taskId, nextStatus) => onStatusChange(taskId, status, nextStatus)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="kanban-column__footer">
              <Pagination
                currentPage={column.pageIndex}
                hasNext={Boolean(column.page?.hasNext)}
                onPageChange={(page) => onPageChange(status, page)}
                isLoading={column.loading}
                itemsCount={items.length}
                itemLabel="tarea"
                itemLabelPlural="tareas"
              />
            </footer>
          </section>
        )
      })}
    </div>
  )
}
