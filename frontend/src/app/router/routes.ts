//SOLID: SRP — ESTE ARCHIVO DEFINE EXCLUSIVAMENTE LA TABLA Y METADATOS DE RUTAS DEL SISTEMA.

export interface RouteDefinition {
  path: string
  title: string
  label: string
  requiresLayout: boolean
}

export const APP_ROUTES: Record<string, RouteDefinition> = {
  home: {
    path: '/',
    title: 'Panel General — ERP + CRM',
    label: 'Panel general',
    requiresLayout: true,
  },
  login: {
    path: '/login',
    title: 'Iniciar sesión — ERP + CRM',
    label: 'Iniciar sesión',
    requiresLayout: false,
  },
  accounting: {
    path: '/accounting',
    title: 'Contabilidad — ERP + CRM',
    label: 'Contabilidad',
    requiresLayout: true,
  },
  crm: {
    path: '/crm',
    title: 'Clientes — ERP + CRM',
    label: 'Clientes',
    requiresLayout: true,
  },
  inventory: {
    path: '/inventory',
    title: 'Inventario — ERP + CRM',
    label: 'Inventario',
    requiresLayout: true,
  },
  pos: {
    path: '/pos',
    title: 'Ventas — ERP + CRM',
    label: 'Ventas',
    requiresLayout: true,
  },
  projects: {
    path: '/projects',
    title: 'Proyectos — ERP + CRM',
    label: 'Proyectos',
    requiresLayout: true,
  },
  marketing: {
    path: '/marketing',
    title: 'Marketing — ERP + CRM',
    label: 'Marketing',
    requiresLayout: true,
  },
  settings: {
    path: '/settings',
    title: 'Configuración — ERP + CRM',
    label: 'Configuración',
    requiresLayout: true,
  },
}

export const NOT_FOUND_ROUTE: RouteDefinition = {
  path: '*',
  title: 'Página no encontrada — ERP + CRM',
  label: 'No encontrada',
  requiresLayout: true,
}

export function matchRoute(pathname: string): RouteDefinition {
  const normalized = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname

  for (const route of Object.values(APP_ROUTES)) {
    if (route.path === normalized) {
      return route
    }
  }

  return NOT_FOUND_ROUTE
}
