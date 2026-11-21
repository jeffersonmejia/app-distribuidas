// SOLID: SRP - RENDERIZA UNA TARJETA DE TAREA CON SUS DATOS VISIBLES Y CAMBIO DE ESTADO ACCESIBLE.

import { Badge, type BadgeVariant } from '../../../components/ui'
import type { Task, TaskStatus } from '../types/project'
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  formatProjectDate,
} from '../utils/projectFormat'

export interface KanbanCardProps {
  task: Task
  onStatusChange: (taskId: string, status: TaskStatus) => void
  isUpdating?: boolean
}

const STATUS_OPTIONS: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED']

function getPriorityVariant(priority: Task['priority']): BadgeVariant {
  switch (priority) {
    case 'HIGH':
      return 'error'
    case 'MEDIUM':
      return 'warning'
    case 'LOW':
      return 'success'
    default:
      return 'neutral'
  }
}

export function KanbanCard({ task, onStatusChange, isUpdating = false }: KanbanCardProps) {
  const priorityLabel = task.priority ? TASK_PRIORITY_LABELS[task.priority] : 'Sin prioridad'

  return (
    <article className="kanban-card" aria-label={`Tarea ${task.title}`}>
      <div className="kanban-card__header">
        <h4 className="kanban-card__title">{task.title}</h4>
        <Badge variant={getPriorityVariant(task.priority ?? null)}>{priorityLabel}</Badge>
      </div>

      {task.description && <p className="kanban-card__description">{task.description}</p>}

      <dl className="kanban-card__meta">
        <div className="kanban-card__meta-row">
          <dt>Fecha límite</dt>
          <dd>{formatProjectDate(task.dueDate)}</dd>
        </div>
        {task.assigneeId && (
          <div className="kanban-card__meta-row">
            <dt>Responsable</dt>
            <dd>{task.assigneeId}</dd>
          </div>
        )}
      </dl>

      <label className="kanban-card__status-control">
        <span className="kanban-card__status-label">Estado</span>
        <select
          className="kanban-card__status-select"
          value={task.status}
          disabled={isUpdating}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          aria-label={`Cambiar estado de ${task.title}`}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {TASK_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
    </article>
  )
}
