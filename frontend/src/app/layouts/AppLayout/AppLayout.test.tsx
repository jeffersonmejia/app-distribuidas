import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RouterProvider } from '../../router/router'
import { AppLayout } from './AppLayout'
import { PlaceholderPage } from '../PlaceholderPage'

describe('AppLayout and PlaceholderPage', () => {
  it('renderiza el skip link con destino #main-content', () => {
    render(
      <RouterProvider initialPath="/crm">
        <AppLayout currentPath="/crm">
          <div>Contenido de prueba</div>
        </AppLayout>
      </RouterProvider>
    )

    const skipLink = screen.getByRole('link', { name: 'Saltar al contenido principal' })
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  it('renderiza el elemento main con id="main-content" y tabIndex={-1}', () => {
    render(
      <RouterProvider initialPath="/crm">
        <AppLayout currentPath="/crm">
          <div>Contenido</div>
        </AppLayout>
      </RouterProvider>
    )

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main-content')
    expect(main).toHaveAttribute('tabIndex', '-1')
  })

  it('renderiza la barra lateral con aria-current en el ítem activo', () => {
    render(
      <RouterProvider initialPath="/crm">
        <AppLayout currentPath="/crm">
          <div>Contenido CRM</div>
        </AppLayout>
      </RouterProvider>
    )

    const crmLink = screen.getByRole('link', { name: 'Clientes' })
    expect(crmLink).toHaveAttribute('aria-current', 'page')
  })

  it('PlaceholderPage renderiza el PageHeader y Card con EmptyState conforme a arquitectura', () => {
    render(
      <RouterProvider initialPath="/projects">
        <AppLayout currentPath="/projects">
          <PlaceholderPage
            title="Proyectos"
            description="18 proyectos activos · Seguimiento y ejecución de entregables"
          />
        </AppLayout>
      </RouterProvider>
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeInTheDocument()
    expect(
      screen.getByText('18 proyectos activos · Seguimiento y ejecución de entregables')
    ).toBeInTheDocument()
    expect(screen.getByText('Módulo en desarrollo')).toBeInTheDocument()
  })
})
