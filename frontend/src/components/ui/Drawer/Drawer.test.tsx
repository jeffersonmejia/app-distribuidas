import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Drawer } from './Drawer'

function setup(isOpen = true, onClose = vi.fn(), footer?: React.ReactNode) {
  return render(
    <Drawer isOpen={isOpen} onClose={onClose} title="Nuevo cliente" footer={footer}>
      <button>Primer foco</button>
      <input placeholder="Campo" />
      <button>Último foco</button>
    </Drawer>,
  )
}

describe('Drawer', () => {
  it('no renderiza el panel cuando isOpen es false', () => {
    setup(false)
    const panel = screen.getByRole('dialog', { hidden: true })
    expect(panel).not.toHaveClass('drawer-panel--open')
  })

  it('muestra el panel cuando isOpen es true', () => {
    setup(true)
    expect(screen.getByRole('dialog')).toHaveClass('drawer-panel--open')
  })

  it('muestra el título correctamente', () => {
    setup()
    expect(screen.getByText('Nuevo cliente')).toBeInTheDocument()
  })

  it('llama a onClose al hacer clic en el botón de cierre', async () => {
    const onClose = vi.fn()
    setup(true, onClose)
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar panel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('llama a onClose al hacer clic en el overlay', () => {
    const onClose = vi.fn()
    setup(true, onClose)
    // El overlay tiene aria-hidden; lo buscamos por clase
    const overlay = document.querySelector('.drawer-overlay--visible')!
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('llama a onClose al presionar Escape', () => {
    const onClose = vi.fn()
    setup(true, onClose)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('NO llama a onClose con Escape si el drawer está cerrado', () => {
    const onClose = vi.fn()
    setup(false, onClose)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('tiene role="dialog" y aria-modal="true"', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('aria-labelledby apunta al título', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    const labelId = dialog.getAttribute('aria-labelledby')!
    expect(document.getElementById(labelId)?.textContent).toBe('Nuevo cliente')
  })

  it('renderiza el footer cuando se pasa la prop footer', () => {
    setup(true, vi.fn(), <span>Acciones</span>)
    expect(screen.getByText('Acciones')).toBeInTheDocument()
  })

  it('no renderiza footer si no se pasa la prop', () => {
    setup(true, vi.fn())
    expect(document.querySelector('.drawer-footer')).toBeNull()
  })

  it('trampa de foco: Tab desde el último elemento vuelve al primero', async () => {
    setup()
    const user = userEvent.setup()
    const buttons = screen.getAllByRole('button')
    const lastButton = buttons[buttons.length - 1]
    lastButton.focus()
    await user.tab()
    // El foco debe haber vuelto al primero dentro del panel
    const dialog = screen.getByRole('dialog')
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    )
    expect(document.activeElement).toBe(focusable[0])
  })

  it('trampa de foco: Shift+Tab desde el primer elemento va al último', async () => {
    setup()
    const user = userEvent.setup()
    const dialog = screen.getByRole('dialog')
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    )
    focusable[0].focus()
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(focusable[focusable.length - 1])
  })
})
