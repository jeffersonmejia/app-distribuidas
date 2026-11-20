import type { ReactNode } from 'react'
import { Link } from '../../../app/router/Link'
import { TenantSelector } from '../../../features/identity/components/TenantSelector'
import { UserMenu } from '../../../features/identity/components/UserMenu'
import './Sidebar.css'

//SOLID: SRP — RENDERIZA LA BARRA LATERAL PRINCIPAL DE NAVEGACIÓN GLOBAL DEL ERP + CRM CON ESTILO STITCH.

export interface NavItemConfig {
  path: string
  label: string
  icon: (active: boolean) => ReactNode
}

export interface SidebarProps {
  currentPath: string
  footer?: ReactNode
}

function DashboardIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  )
}

function AccountingIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 10h3v7H4v-7zm6 0h3v7h-3v-7zm6 0h3v7h-3v-7zm-14 9h19v2H2v-2zm9.5-17 10 5H2.5l9.5-5z" />
    </svg>
  )
}

function CustomersIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  )
}

function InventoryIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v3.01c0 .72.38 1.36.95 1.7L3 9.7V20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9.7l.05-.99c.57-.34.95-.98.95-1.7V4c0-1.1-.9-2-2-2zM4 4h16v3H4V4zm15 16H5V10h14v10zm-9-8h4v2h-4v-2z" />
    </svg>
  )
}

function ReceiptLongIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.5 3.5 18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v20l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5zM19 19.09H5V4.91h14v14.18zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
    </svg>
  )
}

function ProjectsIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
  )
}

function MarketingIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 4c-.4.53-.8 1.07-1.2 1.6.96.72 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.67-3.2-2.39zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1l5 4V5L5 9H4zm11.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  )
}

export const SIDEBAR_NAV_ITEMS: NavItemConfig[] = [
  { path: '/', label: 'Panel general', icon: DashboardIcon },
  { path: '/accounting', label: 'Contabilidad', icon: AccountingIcon },
  { path: '/crm', label: 'Clientes', icon: CustomersIcon },
  { path: '/inventory', label: 'Inventario', icon: InventoryIcon },
  { path: '/pos', label: 'Ventas', icon: ReceiptLongIcon },
  { path: '/projects', label: 'Proyectos', icon: ProjectsIcon },
  { path: '/marketing', label: 'Marketing', icon: MarketingIcon },
  { path: '/settings', label: 'Configuración', icon: SettingsIcon },
]

export function isSidebarItemActive(itemPath: string, currentPath: string): boolean {
  if (itemPath === '/') {
    return currentPath === '/'
  }
  return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
}

export function Sidebar({ currentPath, footer }: SidebarProps) {
  return (
    <aside className="app-sidebar" aria-label="Navegación principal">
      <div className="app-sidebar__top">
        <Link
          to="/"
          className="app-sidebar__brand"
          title="ERP + CRM"
          aria-label="Ir a Panel general"
        >
          <svg
            className="app-sidebar__brand-icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect width="20" height="20" x="2" y="2" rx="6" fill="var(--brand)" />
            {/* Ícono SVG de cubo isométrico neutro Stitch */}
            <path
              d="M12 6.5l5.5 3.2v6.4L12 19.3l-5.5-3.2V9.7L12 6.5z"
              stroke="var(--text-on-brand)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M12 6.5v12.8M12 12.9l5.5-3.2M12 12.9l-5.5-3.2"
              stroke="var(--text-on-brand)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <nav className="app-sidebar__nav" aria-label="Módulos del sistema">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const isActive = isSidebarItemActive(item.path, currentPath)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`app-sidebar__item${isActive ? ' app-sidebar__item--active' : ''}`}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="app-sidebar__icon" aria-hidden="true">
                  {item.icon(isActive)}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="app-sidebar__footer">
        {footer ? (
          footer
        ) : (
          <>
            <TenantSelector />
            <UserMenu />
          </>
        )}
      </div>
    </aside>
  )
}
