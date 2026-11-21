// SOLID: SRP — ESTE COMPONENTE PERMITE NAVEGAR Y FILTRAR LISTAS MEDIANTE PESTAÑAS TIPO PÍLDORA ACCESIBLES.

import { useRef, type KeyboardEvent } from 'react'
import './FilterTabs.css'

export interface FilterTabItem<T extends string = string> {
  id: T
  label: string
  count?: number | string
}

export interface FilterTabsProps<T extends string = string> {
  tabs: FilterTabItem<T>[]
  activeTab: T
  onTabChange: (id: T) => void
  ariaLabel?: string
  className?: string
}

export function FilterTabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel = 'Filtros',
  className = '',
}: FilterTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (tabs.length === 0) return

    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab)
    if (currentIndex < 0) return

    let nextIndex = currentIndex

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % tabs.length
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = tabs.length - 1
    }

    if (nextIndex !== currentIndex) {
      onTabChange(tabs[nextIndex].id)
      const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      buttons?.[nextIndex]?.focus()
    }
  }

  return (
    <div
      ref={containerRef}
      className={`ui-filter-tabs ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const isSelected = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={`ui-filter-tabs__pill${isSelected ? ' ui-filter-tabs__pill--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="ui-filter-tabs__badge">{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
