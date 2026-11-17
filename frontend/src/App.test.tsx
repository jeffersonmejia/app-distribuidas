import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from './app/router'
import { AppContent } from './App'

describe('App Routing Integration', () => {
  const originalTitle = document.title

  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    document.title = originalTitle
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/')
    document.title = originalTitle
  })

  it('renderiza LoginPage en /login SIN barra lateral de navegación', () => {
    render(
      <RouterProvider initialPath="/login">
        <AppContent />
      </RouterProvider>
    )

    // LoginPage está presente
    expect(screen.getByRole('heading', { level: 2, name: 'Iniciar sesión' })).toBeInTheDocument()
    // Sidebar NO está presente
    expect(screen.queryByRole('navigation', { name: 'Módulos del sistema' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Saltar al contenido principal' })).not.toBeInTheDocument()
  })

  it('renderiza /crm dentro de AppLayout con Sidebar y Clientes activo', () => {
    render(
      <RouterProvider initialPath="/crm">
        <AppContent />
      </RouterProvider>
    )

    // Sidebar presente
    expect(screen.getByRole('navigation', { name: 'Módulos del sistema' })).toBeInTheDocument()

    // Enlace Clientes activo
    const crmLink = screen.getByRole('link', { name: 'Clientes' })
    expect(crmLink).toHaveAttribute('aria-current', 'page')

    // PageHeader con título Clientes
    expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument()

    // Card con EmptyState de módulo en desarrollo
    expect(screen.getByText('Módulo en desarrollo')).toBeInTheDocument()
  })

  it('renderiza EmptyState de página no encontrada para rutas desconocidas dentro de AppLayout', () => {
    render(
      <RouterProvider initialPath="/ruta-inexistente">
        <AppContent />
      </RouterProvider>
    )

    // Sidebar presente
    expect(screen.getByRole('navigation', { name: 'Módulos del sistema' })).toBeInTheDocument()
    // Mensaje de página no encontrada
    expect(screen.getByText('Página no encontrada')).toBeInTheDocument()
  })

  it('navegar con un clic en el Sidebar actualiza el contenido y document.title', async () => {
    const user = userEvent.setup()

    render(
      <RouterProvider initialPath="/">
        <AppContent />
      </RouterProvider>
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Panel general' })).toBeInTheDocument()
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
