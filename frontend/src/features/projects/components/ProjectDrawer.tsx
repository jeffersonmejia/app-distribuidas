// SOLID: SRP - ESTE COMPONENTE GESTIONA EXCLUSIVAMENTE EL FORMULARIO DE CREACION DE PROYECTOS.

import { useState, type FormEvent } from 'react'
import './ProjectDrawer.css'
import { Drawer, Button } from '../../../components/ui'
import { Input } from '../../../components/forms'
import { Alert } from '../../../components/feedback'
import { ProjectApiError, type ProjectRepository } from '../services'
import type { Project, ProjectInput } from '../types/project'

export interface ProjectDrawerProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (project: Project) => void
  repository: ProjectRepository
}

interface ProjectFormState {
  name: string
  description: string
  startDate: string
  endDate: string
}

const INITIAL_STATE: ProjectFormState = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
}

export function ProjectDrawer({ isOpen, onClose, onCreated, repository }: ProjectDrawerProps) {
  const [form, setForm] = useState<ProjectFormState>(INITIAL_STATE)
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

  function validate(): ProjectInput | null {
    const errors: Record<string, string> = {}
    const name = form.name.trim()
    if (!name) {
      errors.name = 'El nombre del proyecto es obligatorio.'
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      errors.endDate = 'La fecha de fin no puede ser anterior a la fecha de inicio.'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return null

    return {
      name,
      description: form.description.trim() || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setGeneralError(null)
    const input = validate()
    if (!input) return

    setIsSubmitting(true)
    try {
      const created = await repository.create(input)
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
        setGeneralError('No se pudo guardar el proyecto. Intenta nuevamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const footer = (
    <div className="project-drawer__footer">
      <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button type="submit" form="project-create-form" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : 'Guardar proyecto'}
      </Button>
    </div>
  )

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="Nuevo proyecto" footer={footer}>
      <form id="project-create-form" className="project-drawer__form" onSubmit={handleSubmit} noValidate>
        {generalError && (
          <Alert variant="error" title="No se pudo crear el proyecto">
            {generalError}
          </Alert>
        )}

        <Input
          id="project-name"
          label="Nombre del proyecto"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          error={fieldErrors.name}
          required
        />

        <div className="project-drawer__field">
          <label className="project-drawer__label" htmlFor="project-description">
            Descripción
          </label>
          <textarea
            id="project-description"
            className="project-drawer__textarea"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="project-drawer__row">
          <Input
            id="project-start-date"
            label="Fecha de inicio"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
            error={fieldErrors.startDate}
          />
          <Input
            id="project-end-date"
            label="Fecha de fin"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
            error={fieldErrors.endDate}
          />
        </div>
      </form>
    </Drawer>
  )
}



