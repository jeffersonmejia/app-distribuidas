import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, useRouter } from './router'
import { Link } from './Link'
import { matchRoute, APP_ROUTES, NOT_FOUND_ROUTE } from './routes'

function TestConsumer() {
  const { pathname, route, navigate } = useRouter()
  return (
    <div>
      <span data-testid="pathname">{pathname}</span>
      <span data-testid="route-label">{route.label}</span>
      <button onClick={() => navigate('/crm')}>Ir a CRM</button>
      <Link to="/inventory">Enlace Inventario</Link>
      <Link to="/pos" target="_blank">Enlace POS Blank</Link>
      <main id="main-content" tabIndex={-1}>
        Contenido principal
      </main>
    </div>
  )
}

describe('Router & Link', () => {
  const originalTitle = document.title

  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    document.title = originalTitle
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/')
    document.title = originalTitle
  })

  // --- Resolución de rutas ---

  it('resuelve correctamente las rutas base', () => {
    expect(matchRoute('/')).toEqual(APP_ROUTES.home)
    expect(matchRoute('/crm')).toEqual(APP_ROUTES.crm)
    expect(matchRoute('/inventory')).toEqual(APP_ROUTES.inventory)
    expect(matchRoute('/pos')).toEqual(APP_ROUTES.pos)
    expect(matchRoute('/projects')).toEqual(APP_ROUTES.projects)
    expect(matchRoute('/marketing')).toEqual(APP_ROUTES.marketing)
    expect(matchRoute('/accounting')).toEqual(APP_ROUTES.accounting)
    expect(matchRoute('/settings')).toEqual(APP_ROUTES.settings)
    expect(matchRoute('/login')).toEqual(APP_ROUTES.login)
  })

  it('resuelve rutas con barra diagonal final', () => {
    expect(matchRoute('/crm/')).toEqual(APP_ROUTES.crm)
  })

  it('resuelve ruta no encontrada para caminos inexistentes', () => {
    expect(matchRoute('/ruta-desconocida')).toEqual(NOT_FOUND_ROUTE)
  })

  // --- RouterProvider y navegación client-side ---

  it('renderiza la ruta inicial y actualiza document.title', () => {
    render(
      <RouterProvider initialPath="/crm">
        <TestConsumer />
      </RouterProvider>
    )

    expect(screen.getByTestId('pathname')).toHaveTextContent('/crm')
    expect(screen.getByTestId('route-label')).toHaveTextContent('Clientes')
    expect(document.title).toBe(APP_ROUTES.crm.title)
  })

  it('navega mediante navigate() sin recargar la página', async () => {
    const user = userEvent.setup()
    render(
      <RouterProvider initialPath="/">
        <TestConsumer />
      </RouterProvider>
    )

    expect(screen.getByTestId('pathname')).toHaveTextContent('/')
    await user.click(screen.getByRole('button', { name: 'Ir a CRM' }))

    expect(screen.getByTestId('pathname')).toHaveTextContent('/crm')
    expect(window.location.pathname).toBe('/crm')
    expect(document.title).toBe(APP_ROUTES.crm.title)
  })

  it('responde a eventos de popstate (atrás/adelante)', () => {
    render(
      <RouterProvider initialPath="/">
        <TestConsumer />
      </RouterProvider>
    )

    act(() => {
      window.history.pushState({}, '', '/projects')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(screen.getByTestId('pathname')).toHaveTextContent('/projects')
    expect(screen.getByTestId('route-label')).toHaveTextContent('Proyectos')
    expect(document.title).toBe(APP_ROUTES.projects.title)
  })

  it('lleva el foco a #main-content al cambiar de ruta', async () => {
    const user = userEvent.setup()
    render(
      <RouterProvider initialPath="/">
        <TestConsumer />
      </RouterProvider>
    )

    const main = screen.getByRole('main')
    await user.click(screen.getByRole('button', { name: 'Ir a CRM' }))
    expect(main).toHaveFocus()
  })

  // --- Link Component ---

  it('navega con Link en clic izquierdo simple', async () => {
    const user = userEvent.setup()
    render(
      <RouterProvider initialPath="/">
        <TestConsumer />
      </RouterProvider>
    )

    await user.click(screen.getByRole('link', { name: 'Enlace Inventario' }))
    expect(screen.getByTestId('pathname')).toHaveTextContent('/inventory')
    expect(window.location.pathname).toBe('/inventory')
  })

  it('no intercepta cuando se usa target distinto de _self', async () => {
    render(
      <RouterProvider initialPath="/">
        <TestConsumer />
      </RouterProvider>
    )

    const link = screen.getByRole('link', { name: 'Enlace POS Blank' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('href', '/pos')
  })
})
