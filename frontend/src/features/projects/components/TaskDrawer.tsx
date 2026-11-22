// SOLID: SRP - ESTE COMPONENTE GESTIONA EXCLUSIVAMENTE EL FORMULARIO DE CREACION DE TAREAS.

import { useState, type FormEvent } from 'react'
import './TaskDrawer.css'
import { Drawer, Button } from '../../../components/ui'
import { Input, Select } from '../../../components/forms'
import { Alert } from '../../../components/feedback'
import { ProjectApiError, type ProjectRepository } from '../services'
import type { Task, TaskInput, TaskPriority } from '../types/project'

export interface TaskDrawerProps {
  isOpen: boolean
  projectId: string
  onClose: () => void
  onCreated: (task: Task) => void
  repository: ProjectRepository
}

interface TaskFormState {
  title: string
  description: string
  assigneeId: string
  priority: TaskPriority | ''
  dueDate: string
}

const INITIAL_STATE: TaskFormState = {
  title: '',
  description: '',
  assigneeId: '',
  priority: '',
  dueDate: '',
}

const PRIORITY_OPTIONS: Array<{ value: TaskPriority | ''; label: string }> = [
  { value: '', label: 'Sin prioridad' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'LOW', label: 'Baja' },
]

export function TaskDrawer({ isOpen, projectId, onClose, onCreated, repository }: TaskDrawerProps) {
  const [form, setForm] = useState<TaskFormState>(INITIAL_STATE)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function reset() {
    setForm(INITIAL_STATE)
    setFieldErrors({})
    setGeneralError(null)
    setIsSubmitting(false)
  }

  function handleClose() {
    if (isSubmitting) return
    reset()
    onClose()
  }

  function validate(): TaskInput | null {
    const errors: Record<string, string> = {}
    const title = form.title.trim()
    if (!title) errors.title = 'El título de la tarea es obligatorio.'

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return null

    return {
      title,
      description: form.description.trim() || null,
      assigneeId: form.assigneeId.trim() || null,
      priority: form.priority || null,
      dueDate: form.dueDate || null,
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setGeneralError(null)
    const input = validate()
    if (!input) return

    setIsSubmitting(true)
    try {
      const created = await repository.createTask(projectId, input)
      onCreated(created)
      reset()
      onClose()
    } catch (error) {
      if (error instanceof ProjectApiError) {
        if (error.kind === 'validation' && error.details) {
          setFieldErrors(error.details)
        } else {
          setGeneralError(error.message)
        }
      } else {
        setGeneralError('No se pudo guardar la tarea. Intenta nuevamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const footer = (
    <div className="task-drawer__footer">
      <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button type="submit" form="task-create-form" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : 'Guardar tarea'}
      </Button>
    </div>
  )

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="Nueva tarea" footer={footer}>
      <form id="task-create-form" className="task-drawer__form" onSubmit={handleSubmit} noValidate>
        {generalError && (
          <Alert variant="error" title="No se pudo crear la tarea">
            {generalError}
          </Alert>
        )}

        <Input
          id="task-title"
          label="Título"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          error={fieldErrors.title}
          required
        />

        <div className="task-drawer__field">
          <label className="task-drawer__label" htmlFor="task-description">
            Descripción
          </label>
          <textarea
            id="task-description"
            className="task-drawer__textarea"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <Input
          id="task-assignee"
          label="Responsable (ID)"
          value={form.assigneeId}
          onChange={(e) => setForm((prev) => ({ ...prev, assigneeId: e.target.value }))}
          hint="Opcional. Identificador del responsable si está disponible."
          error={fieldErrors.assigneeId}
        />

        <div className="task-drawer__row">
          <Select
            id="task-priority"
            label="Prioridad"
            options={PRIORITY_OPTIONS}
            value={form.priority}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, priority: e.target.value as TaskPriority | '' }))
            }
            error={fieldErrors.priority}
          />
          <Input
            id="task-due-date"
            label="Fecha límite"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            error={fieldErrors.dueDate}
          />
        </div>
      </form>
    </Drawer>
  )
}



