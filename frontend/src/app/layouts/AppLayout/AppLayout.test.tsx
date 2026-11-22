import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { AppLayout } from './AppLayout'
import { PlaceholderPage } from '../PlaceholderPage'
import { renderWithProviders, cleanupSessionTestState } from '../../../test/renderWithProviders'

describe('AppLayout and PlaceholderPage', () => {
  beforeEach(() => {
    cleanupSessionTestState()
  })

  afterEach(() => {
    cleanupSessionTestState()
  })

  it('renderiza el skip link con destino #main-content', () => {
    renderWithProviders(
      <AppLayout currentPath="/crm">
        <div>Contenido de prueba</div>
      </AppLayout>,
      { initialPath: '/crm' }
    )

    const skipLink = screen.getByRole('link', { name: 'Saltar al contenido principal' })
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  it('renderiza el elemento main con id="main-content" y tabIndex={-1}', () => {
    renderWithProviders(
      <AppLayout currentPath="/crm">
        <div>Contenido</div>
      </AppLayout>,
      { initialPath: '/crm' }
    )

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main-content')
    expect(main).toHaveAttribute('tabIndex', '-1')
  })

  it('renderiza la barra lateral con aria-current en el ítem activo', () => {
    renderWithProviders(
      <AppLayout currentPath="/crm">
        <div>Contenido CRM</div>
      </AppLayout>,
      { initialPath: '/crm' }
    )

    const crmLink = screen.getByRole('link', { name: 'Clientes' })
    expect(crmLink).toHaveAttribute('aria-current', 'page')
  })

  it('PlaceholderPage renderiza el PageHeader y Card con EmptyState conforme a arquitectura', () => {
    renderWithProviders(
      <AppLayout currentPath="/projects">
        <PlaceholderPage
          title="Proyectos"
          description="18 proyectos activos · Seguimiento y ejecución de entregables"
        />
      </AppLayout>,
      { initialPath: '/projects' }
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeInTheDocument()
    expect(
      screen.getByText('18 proyectos activos · Seguimiento y ejecución de entregables')
    ).toBeInTheDocument()
    expect(screen.getByText('Módulo en desarrollo')).toBeInTheDocument()
  })
})
