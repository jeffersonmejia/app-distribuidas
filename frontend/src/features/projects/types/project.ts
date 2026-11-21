export type ProjectStatus = 'ACTIVE'

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED'

export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface Project {
  id: string
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface ProjectInput {
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
}

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string | null
  assigneeId?: string | null
  priority?: TaskPriority | null
  dueDate?: string | null
  status: TaskStatus
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface TaskInput {
  title: string
  description?: string | null
  assigneeId?: string | null
  priority?: TaskPriority | null
  dueDate?: string | null
}

export interface ProjectFilters {
  search?: string
}

export interface ProjectPage {
  items: Project[]
  page: number
  size: number
  hasNext: boolean
}

export interface TaskPage {
  items: Task[]
  page: number
  size: number
  hasNext: boolean
}

export interface ProjectProgress {
  totalTasks: number
  completedTasks: number
  percentage: number
}
