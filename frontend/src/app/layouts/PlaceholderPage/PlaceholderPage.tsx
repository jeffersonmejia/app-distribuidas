import { PageHeader } from '../../../components/navigation/PageHeader'
import { Card } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/feedback/EmptyState'

//SOLID: SRP — RENDERIZA LA VISTA ESTÁNDAR PARA MÓDULOS DEL ERP + CRM CUYA PANTALLA ESTÁ EN DESARROLLO.

export interface PlaceholderPageProps {
  title: string
  description?: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader
        title={title}
        description={description}
      />
      <Card>
        <EmptyState
          title="Módulo en desarrollo"
          description="Este módulo estará disponible próximamente."
        />
      </Card>
    </>
  )
}
