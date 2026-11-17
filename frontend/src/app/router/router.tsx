import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { matchRoute, type RouteDefinition } from './routes'

//SOLID: SRP — GESTIONA EL ESTADO DE NAVEGACIÓN Y SINCRONIZACIÓN CON EL HISTORIAL DEL NAVEGADOR.

export interface RouterContextValue {
  pathname: string
  route: RouteDefinition
  navigate: (to: string, options?: { replace?: boolean }) => void
}

const RouterContext = createContext<RouterContextValue | null>(null)

export interface RouterProviderProps {
  children: ReactNode
  initialPath?: string
}

export function RouterProvider({ children, initialPath }: RouterProviderProps) {
  const [pathname, setPathname] = useState<string>(() => {
    if (initialPath) return initialPath
    return typeof window !== 'undefined' ? window.location.pathname || '/' : '/'
  })

  const route = matchRoute(pathname)

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') return

    if (options?.replace) {
      window.history.replaceState({}, '', to)
    } else {
      window.history.pushState({}, '', to)
    }

    setPathname(to)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      setPathname(window.location.pathname || '/')
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  // Sincroniza título del documento y foco accesible al cambiar de ruta
  useEffect(() => {
    if (typeof document === 'undefined') return

    document.title = route.title

    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
    }
  }, [route])

  return (
    <RouterContext.Provider value={{ pathname, route, navigate }}>
      {children}
    </RouterContext.Provider>
  )
}

export function useRouter(): RouterContextValue {
  const context = useContext(RouterContext)
  if (!context) {
    throw new Error('useRouter debe utilizarse dentro de un RouterProvider')
  }
  return context
}
