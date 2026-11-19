// SOLID: SRP — ESTE COMPONENTE SE ENCARGA EXCLUSIVAMENTE DEL FORMULARIO DE ALTA DE UN CLIENTE.

import { useState, useId, type FormEvent } from 'react'
import { Drawer } from '../../../components/ui/Drawer'
import { Input } from '../../../components/forms'
import { Button } from '../../../components/ui'
import { Alert } from '../../../components/feedback'
import { CustomerApiError, type CustomerRepository } from '../services/customerRepository'
import type { CustomerInput, CustomerView } from '../types/customer'
import './CustomerDrawer.css'

export interface CustomerDrawerProps {
  isOpen: boolean
  onClose: () => void
  repository: CustomerRepository
  onCreated: (customer: CustomerView) => void
}

interface FormState {
  fullName: string
  cedula: string
  email: string
  phone: string
}

interface FormErrors {
  fullName?: string
  cedula?: string
  email?: string
  phone?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

//SOLID: SRP — VALIDA EL FORMULARIO EN EL CLIENTE ANTES DE ENVIAR LA PETICIÓN.
function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!values.fullName.trim()) {
    errors.fullName = 'El nombre completo es obligatorio.'
  }

  if (values.cedula.trim() !== '') {
    if (!/^\d{10}$/.test(values.cedula.trim())) {
      errors.cedula = 'La cédula debe tener exactamente 10 dígitos numéricos.'
    }
  }

  if (values.email.trim() !== '') {
    if (!EMAIL_REGEX.test(values.email.trim())) {
      errors.email = 'Ingresa un correo electrónico válido.'
    }
  }

  if (values.phone.trim() !== '') {
    if (values.phone.trim().length < 7 || values.phone.trim().length > 15) {
      errors.phone = 'El teléfono debe tener entre 7 y 15 caracteres.'
    }
  }

  return errors
}

const EMPTY_FORM: FormState = { fullName: '', cedula: '', email: '', phone: '' }

export function CustomerDrawer({ isOpen, onClose, repository, onCreated }: CustomerDrawerProps) {
  const formId = useId()
  const [values, setValues] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function field(name: keyof FormState) {
    return `${formId}-${name}`
  }

  function handleChange(name: keyof FormState, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
    // Limpia el error del campo al editar
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
    if (serverError) setServerError(null)
  }

  function handleClose() {
    if (submitting) return
    setValues(EMPTY_FORM)
    setErrors({})
    setServerError(null)
    onClose()
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const validation = validate(values)
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      return
    }

    setSubmitting(true)
    setServerError(null)

    const input: CustomerInput = {
      fullName: values.fullName.trim(),
      cedula: values.cedula.trim() || null,
      email: values.email.trim().toLowerCase() || null,
      phone: values.phone.trim() || null,
    }

    try {
      const created = await repository.create(input)
      setValues(EMPTY_FORM)
      setErrors({})
      onCreated(created)
      onClose()
    } catch (err) {
      if (err instanceof CustomerApiError) {
        if (err.kind === 'duplicate') {
          setServerError('Ya existe un cliente con esa cédula o correo.')
        } else if (err.kind === 'validation') {
          setServerError('Los datos ingresados no son válidos. Revísalos e inténtalo de nuevo.')
        } else if (err.kind === 'forbidden') {
          setServerError('No tienes permiso para crear clientes.')
        } else {
          setServerError('Ocurrió un error inesperado. Inténtalo de nuevo.')
        }
      } else {
        setServerError('Ocurrió un error inesperado. Inténtalo de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const footer = (
    <div className="customer-drawer-footer">
      <Button
        type="button"
        variant="secondary"
        onClick={handleClose}
        disabled={submitting}
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        form={`${formId}-form`}
        variant="primary"
        isLoading={submitting}
        disabled={submitting}
      >
        Guardar
      </Button>
    </div>
  )

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="Nuevo cliente" footer={footer}>
      {serverError && (
        <Alert variant="error" title="No se pudo guardar">
          {serverError}
        </Alert>
      )}

      <form id={`${formId}-form`} onSubmit={handleSubmit} noValidate className="customer-drawer-form">
        <Input
          id={field('fullName')}
          label="Nombre completo"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Nombre y apellidos"
          value={values.fullName}
          onChange={(e) => handleChange('fullName', e.target.value)}
          error={errors.fullName}
          aria-required="true"
          disabled={submitting}
        />

        <Input
          id={field('cedula')}
          label="Cédula"
          name="cedula"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="10 dígitos (opcional)"
          value={values.cedula}
          onChange={(e) => handleChange('cedula', e.target.value)}
          error={errors.cedula}
          hint="Exactamente 10 dígitos numéricos."
          disabled={submitting}
        />

        <Input
          id={field('email')}
          label="Correo electrónico"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nombre@empresa.com (opcional)"
          value={values.email}
          onChange={(e) => handleChange('email', e.target.value)}
          error={errors.email}
          disabled={submitting}
        />

        <Input
          id={field('phone')}
          label="Teléfono"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="Número de contacto (opcional)"
          value={values.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          error={errors.phone}
          disabled={submitting}
        />
      </form>
    </Drawer>
  )
}
