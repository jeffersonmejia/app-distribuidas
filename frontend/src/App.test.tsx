import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from './app/router'
import { AppContent } from './App'
import { SessionProvider } from './features/identity/context'
import { resetSessionMockStore } from './features/identity/services/sessionMock'

describe('App Routing Integration', () => {
  const originalTitle = document.title

  beforeEach(() => {
    resetSessionMockStore()
    window.history.replaceState({}, '', '/')
    document.title = originalTitle
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/')
    document.title = originalTitle
  })

  it('renderiza LoginPage en /login SIN barra lateral de navegación', () => {
    render(
      <SessionProvider>
        <RouterProvider initialPath="/login">
          <AppContent />
        </RouterProvider>
      </SessionProvider>
    )

    // LoginPage está presente
    expect(screen.getByRole('heading', { level: 2, name: 'Iniciar sesión' })).toBeInTheDocument()
    // Sidebar NO está presente
    expect(screen.queryByRole('navigation', { name: 'Módulos del sistema' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Saltar al contenido principal' })).not.toBeInTheDocument()
  })

  it('renderiza /crm dentro de AppLayout con Sidebar y la página de Clientes', async () => {
    render(
      <SessionProvider>
        <RouterProvider initialPath="/crm">
          <AppContent />
        </RouterProvider>
      </SessionProvider>
    )

    // Espera a que cargue la sesión y el layout esté presente
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Módulos del sistema' })).toBeInTheDocument()
    })

    // Enlace Clientes activo
    const crmLink = screen.getByRole('link', { name: 'Clientes' })
    expect(crmLink).toHaveAttribute('aria-current', 'page')

    // PageHeader con título Clientes
    expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument()

    // CustomersPage cargando (spinner o tabla — esperamos que el spinner aparezca o la tabla)
    await waitFor(() => {
      const hasSpinner = screen.queryByRole('status', { name: /cargando/i }) !== null
      const hasTable = screen.queryByRole('table') !== null
      const hasEmpty = screen.queryByText(/sin clientes/i) !== null
      const hasError = screen.queryByText(/no se pudo/i) !== null
      expect(hasSpinner || hasTable || hasEmpty || hasError).toBe(true)
    })
  })

  it('renderiza EmptyState de página no encontrada para rutas desconocidas dentro de AppLayout', async () => {
    render(
      <SessionProvider>
        <RouterProvider initialPath="/ruta-inexistente">
          <AppContent />
        </RouterProvider>
      </SessionProvider>
    )

    // Espera a que cargue la sesión y se muestre el Sidebar
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Módulos del sistema' })).toBeInTheDocument()
    })
    // Mensaje de página no encontrada
    expect(screen.getByText('Página no encontrada')).toBeInTheDocument()
  })

  it('navegar con un clic en el Sidebar actualiza el contenido y document.title', async () => {
    const user = userEvent.setup()

    render(
      <SessionProvider>
        <RouterProvider initialPath="/">
          <AppContent />
        </RouterProvider>
      </SessionProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Panel general' })).toBeInTheDocument()
    })
    expect(document.title).toBe('Panel General — ERP + CRM')

    // Clic en Proyectos en el Sidebar
    const projectsLink = screen.getByRole('link', { name: 'Proyectos' })
    await user.click(projectsLink)

    // Contenido cambia a Proyectos
    expect(screen.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeInTheDocument()
    expect(projectsLink).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Proyectos — ERP + CRM')
  })
})
