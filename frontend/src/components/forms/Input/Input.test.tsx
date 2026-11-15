import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  // --- Asociación label → input ---

  it('asocia el label con el input mediante htmlFor/id', () => {
    render(<Input id="email" label="Correo electrónico" />)
    // getByLabelText busca el input cuyo label tiene el texto dado
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
  })

  it('el input tiene el id correcto', () => {
    render(<Input id="email" label="Correo" />)
    expect(screen.getByLabelText('Correo')).toHaveAttribute('id', 'email')
  })

  // --- Escritura con user-event ---

  it('permite escribir texto en el campo', async () => {
    const user = userEvent.setup()
    render(<Input id="nombre" label="Nombre" />)
    const input = screen.getByLabelText('Nombre')
    await user.type(input, 'Dayanara')
    expect(input).toHaveValue('Dayanara')
  })

  // --- Foco con Tab ---

  it('recibe foco al navegar con Tab', async () => {
    const user = userEvent.setup()
    render(<Input id="nombre" label="Nombre" />)
    await user.tab()
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
  })

  // --- Estado inválido ---

  it('tiene aria-invalid="true" cuando se pasa error', () => {
    render(<Input id="email" label="Correo" error="El correo es inválido" />)
    expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true')
  })

  it('no tiene aria-invalid cuando no hay error', () => {
    render(<Input id="email" label="Correo" />)
    expect(screen.getByLabelText('Correo')).not.toHaveAttribute('aria-invalid')
  })

  it('muestra el mensaje de error con role="alert"', () => {
    render(<Input id="email" label="Correo" error="Campo requerido" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Campo requerido')
  })

  it('apunta aria-describedby al id del error cuando hay error', () => {
    render(<Input id="email" label="Correo" error="Campo requerido" />)
    const input = screen.getByLabelText('Correo')
    expect(input).toHaveAttribute('aria-describedby', 'email-error')
    expect(document.getElementById('email-error')).toBeInTheDocument()
  })

  // --- Estado deshabilitado ---

  it('deshabilita el input cuando se pasa disabled', () => {
    render(<Input id="nombre" label="Nombre" disabled />)
    expect(screen.getByLabelText('Nombre')).toBeDisabled()
  })

  it('no recibe foco con Tab cuando está deshabilitado', async () => {
    const user = userEvent.setup()
    render(<Input id="nombre" label="Nombre" disabled />)
    await user.tab()
    expect(screen.getByLabelText('Nombre')).not.toHaveFocus()
  })

  it('no permite escritura cuando está deshabilitado', async () => {
    const user = userEvent.setup()
    render(<Input id="nombre" label="Nombre" disabled />)
    const input = screen.getByLabelText('Nombre')
    await user.type(input, 'texto')
    expect(input).toHaveValue('')
  })

  // --- Ayuda (hint) ---

  it('muestra el texto de ayuda cuando se pasa hint', () => {
    render(<Input id="email" label="Correo" hint="Usa tu correo corporativo" />)
    expect(screen.getByText('Usa tu correo corporativo')).toBeInTheDocument()
  })

  it('apunta aria-describedby al id del hint cuando hay hint y no hay error', () => {
    render(<Input id="email" label="Correo" hint="Usa tu correo corporativo" />)
    const input = screen.getByLabelText('Correo')
    expect(input).toHaveAttribute('aria-describedby', 'email-hint')
  })

  it('no muestra hint cuando hay error (el error tiene prioridad)', () => {
    render(
      <Input
        id="email"
        label="Correo"
        hint="Usa tu correo corporativo"
        error="Campo requerido"
      />
    )
    expect(screen.queryByText('Usa tu correo corporativo')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Campo requerido')
  })

  it('no tiene aria-describedby cuando no hay hint ni error', () => {
    render(<Input id="email" label="Correo" />)
    expect(screen.getByLabelText('Correo')).not.toHaveAttribute('aria-describedby')
  })

  // --- endAdornment ---

  it('renderiza el endAdornment cuando se pasa', () => {
    render(
      <Input
        id="password"
        label="Contraseña"
        endAdornment={<button type="button">Mostrar</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Mostrar' })).toBeInTheDocument()
  })
})
