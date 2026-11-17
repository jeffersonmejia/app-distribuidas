import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import LoginPage from './LoginPage'

describe('LoginPage', () => {
  it('renderiza la tarjeta derecha con el formulario', () => {
    render(<LoginPage />)
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('contiene el campo de correo electrónico', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument()
  })

  it('contiene el campo de contraseña', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument()
  })

  it('el botón "Iniciar sesión" está deshabilitado', () => {
    render(<LoginPage />)
    const btn = screen.getByRole('button', { name: /iniciar sesión/i })
    expect(btn).toBeDisabled()
  })

  it('el botón de Google está deshabilitado', () => {
    render(<LoginPage />)
    const btn = screen.getByRole('button', { name: /google/i })
    expect(btn).toBeDisabled()
  })

  it('el botón de Microsoft está deshabilitado', () => {
    render(<LoginPage />)
    const btn = screen.getByRole('button', { name: /microsoft/i })
    expect(btn).toBeDisabled()
  })

  it('"¿Olvidaste tu contraseña?" tiene aria-disabled="true"', () => {
    render(<LoginPage />)
    const link = screen.getByRole('link', { name: /olvidaste tu contraseña/i })
    expect(link).toHaveAttribute('aria-disabled', 'true')
  })

  it('el checkbox "Recordarme" está deshabilitado', () => {
    render(<LoginPage />)
    const checkbox = screen.getByRole('checkbox', { name: /recordarme/i })
    expect(checkbox).toBeDisabled()
  })

  it('existe un elemento role="status" (aviso de IdP)', () => {
    render(<LoginPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('el aviso de estado tiene aria-live="polite"', () => {
    render(<LoginPage />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  describe('envío del formulario', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response())
    })

    afterEach(() => {
      fetchSpy.mockRestore()
    })

    it('NO llama a fetch al enviar el formulario', () => {
      render(<LoginPage />)
      const form = document.querySelector('form')!
      fireEvent.submit(form)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  it('la sección de branding (tarjeta izquierda) tiene aria-labelledby apuntando a un heading', () => {
    render(<LoginPage />)
    const brandSection = document.querySelector('.login-brand-card')
    expect(brandSection).toBeInTheDocument()
  })
})
