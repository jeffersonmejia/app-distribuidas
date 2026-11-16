import type { ReactNode } from 'react'
import { Sidebar } from '../../../components/navigation/Sidebar'
import './AppLayout.css'

//SOLID: SRP — ESTRUCTURA EL CONTENEDOR PRINCIPAL, SKIP LINK Y SIDEBAR PARA RUTAS CON LAYOUT.

export interface AppLayoutProps {
  currentPath: string
  children: ReactNode
}

export function AppLayout({ currentPath, children }: AppLayoutProps) {
  return (
    <div className="app-layout">
      {/* Enlace accesible para saltar directamente al contenido */}
      <a href="#main-content" className="app-layout__skip-link">
        Saltar al contenido principal
      </a>

      {/* Barra lateral fija */}
      <Sidebar currentPath={currentPath} />

      {/* Contenedor principal con id para foco y navegación */}
      <main id="main-content" className="app-layout__content" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
