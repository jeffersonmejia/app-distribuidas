import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    expect(screen.getByLabelText('Contraseña', { selector: 'input' })).toBeInTheDocument()
  })

  it('el campo de correo electrónico está habilitado y acepta texto', async () => {
    render(<LoginPage />)
    const input = screen.getByLabelText(/correo electrónico/i)
    expect(input).not.toBeDisabled()
    await userEvent.type(input, 'test@empresa.com')
    expect(input).toHaveValue('test@empresa.com')
  })

  it('el campo de contraseña está habilitado y acepta texto', async () => {
    render(<LoginPage />)
    const input = screen.getByLabelText('Contraseña', { selector: 'input' })
    expect(input).not.toBeDisabled()
    await userEvent.type(input, 'secret123')
    expect(input).toHaveValue('secret123')
  })

  it('existe el botón "Mostrar contraseña" y es un button', () => {
    render(<LoginPage />)
    const btn = screen.getByRole('button', { name: /mostrar contraseña/i })
    expect(btn.tagName).toBe('BUTTON')
  })

  it('el botón "Iniciar sesión" está habilitado', () => {
    render(<LoginPage />)
    const btn = screen.getByRole('button', { name: /iniciar sesión/i })
    expect(btn).not.toBeDisabled()
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
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
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

    it('muestra el aviso de IdP en role="status" al enviar', async () => {
      render(<LoginPage />)
      const form = document.querySelector('form')!
      fireEvent.submit(form)
      const notice = screen.getByRole('status')
      expect(notice).toHaveTextContent(/proveedor de identidad/i)
    })
  })

  it('la sección de branding (tarjeta izquierda) está presente', () => {
    render(<LoginPage />)
    const brandSection = document.querySelector('.login-brand-card')
    expect(brandSection).toBeInTheDocument()
  })
})
