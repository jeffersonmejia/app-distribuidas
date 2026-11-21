// SOLID: SRP - DEFINE UTILIDADES PURAS PARA FORMATEO Y CALCULO DE PROYECTOS Y TAREAS.

import type { ProjectProgress, Task, TaskPriority, TaskStatus } from '../types/project'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  BLOCKED: 'Bloqueada',
  COMPLETED: 'Completada',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
}

export function formatProjectDate(value?: string | null): string {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function getProjectProgress(tasks: Task[]): ProjectProgress {
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((task) => task.status === 'COMPLETED').length
  const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
  return { totalTasks, completedTasks, percentage }
}
