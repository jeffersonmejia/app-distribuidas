import { RouterProvider, useRouter } from './app/router'
import { AppLayout, PlaceholderPage } from './app/layouts'
import LoginPage from './features/identity/pages/LoginPage'
import { CustomersPage } from './features/crm/pages/CustomersPage'
import { Card } from './components/ui/Card'
import { EmptyState } from './components/feedback/EmptyState'

//SOLID: SRP — ORQUESTA EL RENDERIZADO DE RUTAS BASE DEL SISTEMA DENTRO O FUERA DE APPLAYOUT.

export const MODULE_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Panel general',
    description: 'Resumen operativo y estado general de la organización.',
  },
  '/accounting': {
    title: 'Contabilidad',
    description: 'Cuentas y movimientos contables de la organización.',
  },
  '/crm': {
    title: 'Clientes',
    description: 'Cartera comercial activa y seguimiento de cuentas.',
  },
  '/inventory': {
    title: 'Inventario',
    description: 'Control de productos, existencias y movimientos.',
  },
  '/pos': {
    title: 'Ventas',
    description: 'Flujo de ventas y emisión de comprobantes comerciales.',
  },
  '/projects': {
    title: 'Proyectos',
    description: 'Seguimiento y ejecución de entregables y tareas.',
  },
  '/marketing': {
    title: 'Marketing',
    description: 'Campañas y seguimiento de contactos comerciales.',
  },
  '/settings': {
    title: 'Configuración',
    description: 'Ajustes generales del sistema y preferencias.',
  },
}

export function AppContent() {
  const { pathname, route } = useRouter()

  // Rutas que se renderizan fuera del layout (Login y accesos)
  if (route.path === '/login') {
    return <LoginPage />
  }

  // Si la ruta no está registrada en la tabla de rutas
  if (route.path === '*') {
    return (
      <AppLayout currentPath={pathname}>
        <Card>
          <EmptyState
            title="Página no encontrada"
            description="La ruta solicitada no existe o no se encuentra disponible."
          />
        </Card>
      </AppLayout>
    )
  }

  // Rutas base registradas dentro de AppLayout
  const moduleInfo = MODULE_DESCRIPTIONS[route.path] ?? {
    title: route.label,
    description: `Módulo de ${route.label.toLowerCase()} conforme a arquitectura.`,
  }

  return (
    <AppLayout currentPath={pathname}>
      {route.path === '/crm' ? (
        <CustomersPage />
      ) : (
        <PlaceholderPage
          title={moduleInfo.title}
          description={moduleInfo.description}
        />
      )}
    </AppLayout>
  )
}

function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  )
}

export default App
