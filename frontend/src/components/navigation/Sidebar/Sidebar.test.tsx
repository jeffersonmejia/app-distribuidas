import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from '../../../app/router/router'
import { Sidebar, SIDEBAR_NAV_ITEMS, isSidebarItemActive } from './Sidebar'

function renderSidebar(currentPath = '/') {
  return render(
    <RouterProvider initialPath={currentPath}>
      <Sidebar currentPath={currentPath} />
    </RouterProvider>
  )
}

describe('Sidebar Component', () => {
  // --- Renderizado de enlaces ---

  it('renderiza exactamente los 8 enlaces de navegación', () => {
    renderSidebar('/')
    const nav = screen.getByRole('navigation', { name: 'Módulos del sistema' })
    const links = nav.querySelectorAll('a')
    expect(links).toHaveLength(8)
  })

  it('asigna título y aria-label correctos en español a cada enlace', () => {
    renderSidebar('/')
    for (const item of SIDEBAR_NAV_ITEMS) {
      const link = screen.getByRole('link', { name: item.label })
      expect(link).toHaveAttribute('title', item.label)
      expect(link).toHaveAttribute('href', item.path)
    }
  })

  // --- Regla de estado activo ---

  it('aplica aria-current="page" únicamente a la ruta exacta para "/"', () => {
    expect(isSidebarItemActive('/', '/')).toBe(true)
    expect(isSidebarItemActive('/', '/crm')).toBe(false)
    expect(isSidebarItemActive('/', '/inventory/items')).toBe(false)
  })

  it('aplica aria-current="page" en subrutas de módulos (ej. /crm/123)', () => {
    expect(isSidebarItemActive('/crm', '/crm')).toBe(true)
    expect(isSidebarItemActive('/crm', '/crm/123')).toBe(true)
    expect(isSidebarItemActive('/crm', '/crm/nuevo')).toBe(true)
    expect(isSidebarItemActive('/crm', '/inventory')).toBe(false)
  })

  it('refleja en el DOM el estado activo para subrutas sin activar la raíz "/"', () => {
    renderSidebar('/crm/123')
    const crmLink = screen.getByRole('link', { name: 'Clientes' })
    expect(crmLink).toHaveAttribute('aria-current', 'page')
    expect(crmLink).toHaveClass('app-sidebar__item--active')

    const homeLink = screen.getByRole('link', { name: 'Panel general' })
    expect(homeLink).not.toHaveAttribute('aria-current')
    expect(homeLink).not.toHaveClass('app-sidebar__item--active')
  })

  // --- Aislamiento de datos: Sin notificaciones ni avatar ---

  it('NO renderiza botones de notificaciones ni avatar de usuario por defecto', () => {
    const { container } = renderSidebar('/')
    expect(screen.queryByTitle('Notificaciones')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Cuenta de usuario')).not.toBeInTheDocument()
    expect(container.querySelector('.app-sidebar__footer')).not.toBeInTheDocument()
  })

  it('permite renderizar footer personalizado mediante prop footer', () => {
    render(
      <RouterProvider initialPath="/">
        <Sidebar currentPath="/" footer={<div data-testid="custom-footer">Footer</div>} />
      </RouterProvider>
    )
    expect(screen.getByTestId('custom-footer')).toBeInTheDocument()
  })

  // --- Navegación accesible por teclado ---

  it('permite navegar y hacer foco en los enlaces usando Tab', async () => {
    const user = userEvent.setup()
    renderSidebar('/')

    // Primer tab: marca/logo
    await user.tab()
    expect(screen.getByRole('link', { name: 'Ir a Panel general' })).toHaveFocus()

    // Segundo tab: primer enlace de la lista
    await user.tab()
    expect(screen.getByRole('link', { name: 'Panel general' })).toHaveFocus()

    // Tercer tab: Contabilidad
    await user.tab()
    expect(screen.getByRole('link', { name: 'Contabilidad' })).toHaveFocus()
  })
})
