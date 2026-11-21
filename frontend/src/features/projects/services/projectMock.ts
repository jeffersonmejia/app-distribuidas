// SOLID: SRP - IMPLEMENTA UN REPOSITORIO SIMULADO DE PROYECTOS Y TAREAS AISLADO POR TENANT.

import type {
  Project,
  ProjectFilters,
  ProjectInput,
  ProjectPage,
  Task,
  TaskInput,
  TaskPage,
  TaskStatus,
} from '../types/project'
import { ProjectApiError, type ProjectRepository } from './projectRepository'
import { MOCK_USER } from '../../identity/services/sessionMock'

const DEFAULT_TENANT_ID = MOCK_USER.tenantId
const PAGE_SIZE = 5
const LATENCY_MS = 300
const TASK_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED']

interface ProjectSeed extends Omit<Project, 'deletedAt'> {
  deletedAt?: string | null
}

interface TaskSeed extends Omit<Task, 'deletedAt'> {
  deletedAt?: string | null
}

function delay(ms = LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeText(value?: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function compareDateStrings(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}

function buildSeed(): Record<string, { projects: Project[]; tasks: Task[] }> {
  const andinaProjects: ProjectSeed[] = [
    {
      id: 'prj-andina-001',
      name: 'Implantación ERP Comercial',
      description: 'Despliegue de módulos operativos para ventas e inventario.',
      startDate: '2026-09-01',
      endDate: '2026-12-20',
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-11-10T10:00:00.000Z',
    },
    {
      id: 'prj-andina-002',
      name: 'Portal de clientes corporativos',
      description: 'Autogestión de pedidos y estado de cuenta para cuentas clave.',
      startDate: '2026-10-05',
      endDate: '2027-01-30',
      createdAt: '2026-10-05T09:00:00.000Z',
      updatedAt: '2026-11-12T11:30:00.000Z',
    },
    {
      id: 'prj-andina-003',
      name: 'Automatización de cobranza',
      description: 'Flujos de seguimiento y recordatorios para cartera vencida.',
      startDate: '2026-08-15',
      endDate: '2026-11-30',
      createdAt: '2026-08-15T13:00:00.000Z',
      updatedAt: '2026-11-05T15:20:00.000Z',
    },
    {
      id: 'prj-andina-004',
      name: 'Campaña de reactivación B2B',
      description: 'Segmentación y contacto de clientes inactivos del canal mayorista.',
      startDate: '2026-11-01',
      endDate: '2027-02-15',
      createdAt: '2026-11-01T08:30:00.000Z',
      updatedAt: '2026-11-18T09:45:00.000Z',
    },
    {
      id: 'prj-andina-005',
      name: 'Optimización de almacén norte',
      description: 'Reordenamiento de ubicaciones y control de rotación de inventario.',
      startDate: '2026-07-10',
      endDate: '2026-10-25',
      createdAt: '2026-07-10T14:00:00.000Z',
      updatedAt: '2026-10-25T17:00:00.000Z',
    },
    {
      id: 'prj-andina-006',
      name: 'Integración logística regional',
      description: 'Coordinación de despachos y trazabilidad con transportistas.',
      startDate: '2026-11-12',
      endDate: '2027-03-10',
      createdAt: '2026-11-12T10:15:00.000Z',
      updatedAt: '2026-11-19T16:00:00.000Z',
    },
    {
      id: 'prj-andina-007',
      name: 'Tablero ejecutivo de proyectos',
      description: 'Consolidación de indicadores de avance y cumplimiento por área.',
      startDate: '2026-09-20',
      endDate: '2026-12-05',
      createdAt: '2026-09-20T07:45:00.000Z',
      updatedAt: '2026-11-14T12:10:00.000Z',
    },
  ]

  const andinaTasks: TaskSeed[] = [
    // prj-andina-001 (7)
    { id: 'tsk-andina-001', projectId: 'prj-andina-001', title: 'Levantamiento de procesos comerciales', description: 'Reuniones con ventas y facturación.', assigneeId: 'usr-andina-002', priority: 'HIGH', dueDate: '2026-09-10', status: 'COMPLETED', createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-10T18:00:00.000Z' },
    { id: 'tsk-andina-002', projectId: 'prj-andina-001', title: 'Configuración de catálogo maestro', description: 'Carga inicial de productos y precios.', assigneeId: 'usr-andina-003', priority: 'HIGH', dueDate: '2026-09-25', status: 'COMPLETED', createdAt: '2026-09-11T09:00:00.000Z', updatedAt: '2026-09-24T16:00:00.000Z' },
    { id: 'tsk-andina-003', projectId: 'prj-andina-001', title: 'Migración de inventario inicial', description: 'Conciliación de existencias por bodega.', assigneeId: 'usr-andina-004', priority: 'MEDIUM', dueDate: '2026-10-05', status: 'IN_PROGRESS', createdAt: '2026-09-20T09:00:00.000Z', updatedAt: '2026-11-10T10:00:00.000Z' },
    { id: 'tsk-andina-004', projectId: 'prj-andina-001', title: 'Capacitación a usuarios POS', description: 'Sesiones prácticas para cajeros.', assigneeId: 'usr-andina-005', priority: 'MEDIUM', dueDate: '2026-11-25', status: 'PENDING', createdAt: '2026-10-01T09:00:00.000Z', updatedAt: '2026-11-01T09:00:00.000Z' },
    { id: 'tsk-andina-005', projectId: 'prj-andina-001', title: 'Pruebas de cierre diario', description: 'Validación de arqueos y reportes.', assigneeId: 'usr-andina-006', priority: 'HIGH', dueDate: '2026-11-28', status: 'BLOCKED', createdAt: '2026-10-10T09:00:00.000Z', updatedAt: '2026-11-08T14:00:00.000Z' },
    { id: 'tsk-andina-006', projectId: 'prj-andina-001', title: 'Ajuste de permisos por rol', description: 'Revisión de accesos operativos.', assigneeId: null, priority: 'LOW', dueDate: '2026-12-02', status: 'PENDING', createdAt: '2026-10-15T09:00:00.000Z', updatedAt: '2026-11-02T09:00:00.000Z' },
    { id: 'tsk-andina-007', projectId: 'prj-andina-001', title: 'Acta de salida a producción', description: 'Checklist final de aprobación.', assigneeId: 'usr-andina-002', priority: 'MEDIUM', dueDate: '2026-12-15', status: 'PENDING', createdAt: '2026-10-20T09:00:00.000Z', updatedAt: '2026-11-03T09:00:00.000Z' },

    // prj-andina-002 (6)
    { id: 'tsk-andina-008', projectId: 'prj-andina-002', title: 'Diseño de flujo de acceso', description: 'Definición de ingreso para clientes.', assigneeId: 'usr-andina-003', priority: 'HIGH', dueDate: '2026-10-20', status: 'COMPLETED', createdAt: '2026-10-06T09:00:00.000Z', updatedAt: '2026-10-19T17:00:00.000Z' },
    { id: 'tsk-andina-009', projectId: 'prj-andina-002', title: 'Maquetación de listado de pedidos', description: 'Vista histórica con filtros básicos.', assigneeId: 'usr-andina-007', priority: 'MEDIUM', dueDate: '2026-11-05', status: 'COMPLETED', createdAt: '2026-10-12T09:00:00.000Z', updatedAt: '2026-11-04T18:00:00.000Z' },
    { id: 'tsk-andina-010', projectId: 'prj-andina-002', title: 'Integración de estado de cuenta', description: 'Resumen de saldos y documentos.', assigneeId: 'usr-andina-004', priority: 'HIGH', dueDate: '2026-11-22', status: 'IN_PROGRESS', createdAt: '2026-10-25T09:00:00.000Z', updatedAt: '2026-11-12T11:30:00.000Z' },
    { id: 'tsk-andina-011', projectId: 'prj-andina-002', title: 'Notificaciones de despacho', description: 'Avisos de cambios de estado.', assigneeId: 'usr-andina-005', priority: 'MEDIUM', dueDate: '2026-12-10', status: 'PENDING', createdAt: '2026-11-01T09:00:00.000Z', updatedAt: '2026-11-06T09:00:00.000Z' },
    { id: 'tsk-andina-012', projectId: 'prj-andina-002', title: 'Pruebas con clientes piloto', description: 'Validación con tres cuentas.', assigneeId: 'usr-andina-002', priority: 'HIGH', dueDate: '2026-12-20', status: 'BLOCKED', createdAt: '2026-11-05T09:00:00.000Z', updatedAt: '2026-11-15T10:00:00.000Z' },
    { id: 'tsk-andina-013', projectId: 'prj-andina-002', title: 'Manual de autogestión', description: 'Guía breve para usuarios finales.', assigneeId: null, priority: 'LOW', dueDate: '2027-01-10', status: 'PENDING', createdAt: '2026-11-10T09:00:00.000Z', updatedAt: '2026-11-10T09:00:00.000Z' },

    // prj-andina-003 (6)
    { id: 'tsk-andina-014', projectId: 'prj-andina-003', title: 'Mapeo de reglas de mora', description: 'Definición de rangos y acciones.', assigneeId: 'usr-andina-006', priority: 'HIGH', dueDate: '2026-08-30', status: 'COMPLETED', createdAt: '2026-08-16T09:00:00.000Z', updatedAt: '2026-08-29T17:00:00.000Z' },
    { id: 'tsk-andina-015', projectId: 'prj-andina-003', title: 'Plantillas de recordatorio', description: 'Mensajes por canal y segmento.', assigneeId: 'usr-andina-003', priority: 'MEDIUM', dueDate: '2026-09-20', status: 'COMPLETED', createdAt: '2026-08-25T09:00:00.000Z', updatedAt: '2026-09-19T16:00:00.000Z' },
    { id: 'tsk-andina-016', projectId: 'prj-andina-003', title: 'Automatización de agenda', description: 'Programación de gestiones diarias.', assigneeId: 'usr-andina-004', priority: 'HIGH', dueDate: '2026-10-15', status: 'COMPLETED', createdAt: '2026-09-10T09:00:00.000Z', updatedAt: '2026-10-14T18:00:00.000Z' },
    { id: 'tsk-andina-017', projectId: 'prj-andina-003', title: 'Reporte de recuperaciones', description: 'Indicadores semanales de cartera.', assigneeId: 'usr-andina-002', priority: 'MEDIUM', dueDate: '2026-11-10', status: 'IN_PROGRESS', createdAt: '2026-10-01T09:00:00.000Z', updatedAt: '2026-11-05T15:20:00.000Z' },
    { id: 'tsk-andina-018', projectId: 'prj-andina-003', title: 'Ajuste de escalamiento', description: 'Casos críticos a gestión manual.', assigneeId: 'usr-andina-005', priority: 'MEDIUM', dueDate: '2026-11-20', status: 'PENDING', createdAt: '2026-10-20T09:00:00.000Z', updatedAt: '2026-11-01T09:00:00.000Z' },
    { id: 'tsk-andina-019', projectId: 'prj-andina-003', title: 'Cierre de fase piloto', description: 'Revisión de resultados iniciales.', assigneeId: null, priority: 'LOW', dueDate: '2026-11-28', status: 'PENDING', createdAt: '2026-11-01T09:00:00.000Z', updatedAt: '2026-11-01T09:00:00.000Z' },

    // prj-andina-004 (7)
    { id: 'tsk-andina-020', projectId: 'prj-andina-004', title: 'Segmentación de cuentas inactivas', description: 'Corte por antigüedad y volumen.', assigneeId: 'usr-andina-003', priority: 'HIGH', dueDate: '2026-11-08', status: 'COMPLETED', createdAt: '2026-11-01T09:00:00.000Z', updatedAt: '2026-11-08T17:00:00.000Z' },
    { id: 'tsk-andina-021', projectId: 'prj-andina-004', title: 'Diseño de oferta comercial', description: 'Condiciones para reactivación.', assigneeId: 'usr-andina-002', priority: 'HIGH', dueDate: '2026-11-15', status: 'COMPLETED', createdAt: '2026-11-03T09:00:00.000Z', updatedAt: '2026-11-14T16:00:00.000Z' },
    { id: 'tsk-andina-022', projectId: 'prj-andina-004', title: 'Asignación de cartera a ejecutivos', description: 'Distribución por zona.', assigneeId: 'usr-andina-006', priority: 'MEDIUM', dueDate: '2026-11-20', status: 'IN_PROGRESS', createdAt: '2026-11-09T09:00:00.000Z', updatedAt: '2026-11-18T09:45:00.000Z' },
    { id: 'tsk-andina-023', projectId: 'prj-andina-004', title: 'Primera ronda de llamadas', description: 'Contacto inicial con prioridad alta.', assigneeId: 'usr-andina-007', priority: 'HIGH', dueDate: '2026-11-30', status: 'IN_PROGRESS', createdAt: '2026-11-10T09:00:00.000Z', updatedAt: '2026-11-18T09:45:00.000Z' },
    { id: 'tsk-andina-024', projectId: 'prj-andina-004', title: 'Registro de objeciones frecuentes', description: 'Consolidado para ajustes.', assigneeId: 'usr-andina-005', priority: 'LOW', dueDate: '2026-12-05', status: 'PENDING', createdAt: '2026-11-12T09:00:00.000Z', updatedAt: '2026-11-12T09:00:00.000Z' },
    { id: 'tsk-andina-025', projectId: 'prj-andina-004', title: 'Seguimiento a cotizaciones enviadas', description: 'Control de respuestas pendientes.', assigneeId: 'usr-andina-004', priority: 'MEDIUM', dueDate: '2026-12-12', status: 'PENDING', createdAt: '2026-11-13T09:00:00.000Z', updatedAt: '2026-11-13T09:00:00.000Z' },
    { id: 'tsk-andina-026', projectId: 'prj-andina-004', title: 'Validación de datos de contacto', description: 'Corrección de correos y teléfonos.', assigneeId: null, priority: 'MEDIUM', dueDate: '2026-11-22', status: 'BLOCKED', createdAt: '2026-11-14T09:00:00.000Z', updatedAt: '2026-11-17T11:00:00.000Z' },

    // prj-andina-005 (5)
    { id: 'tsk-andina-027', projectId: 'prj-andina-005', title: 'Conteo físico inicial', description: 'Inventario completo de bodega.', assigneeId: 'usr-andina-004', priority: 'HIGH', dueDate: '2026-07-25', status: 'COMPLETED', createdAt: '2026-07-11T09:00:00.000Z', updatedAt: '2026-07-24T18:00:00.000Z' },
    { id: 'tsk-andina-028', projectId: 'prj-andina-005', title: 'Redistribución de pasillos', description: 'Nueva ubicación por rotación.', assigneeId: 'usr-andina-006', priority: 'MEDIUM', dueDate: '2026-08-20', status: 'COMPLETED', createdAt: '2026-07-26T09:00:00.000Z', updatedAt: '2026-08-19T17:00:00.000Z' },
    { id: 'tsk-andina-029', projectId: 'prj-andina-005', title: 'Etiquetado de ubicaciones', description: 'Señalética y códigos internos.', assigneeId: 'usr-andina-005', priority: 'MEDIUM', dueDate: '2026-09-05', status: 'COMPLETED', createdAt: '2026-08-21T09:00:00.000Z', updatedAt: '2026-09-04T16:00:00.000Z' },
    { id: 'tsk-andina-030', projectId: 'prj-andina-005', title: 'Capacitación en picking', description: 'Buenas prácticas de preparación.', assigneeId: 'usr-andina-003', priority: 'LOW', dueDate: '2026-09-30', status: 'COMPLETED', createdAt: '2026-09-06T09:00:00.000Z', updatedAt: '2026-09-29T15:00:00.000Z' },
    { id: 'tsk-andina-031', projectId: 'prj-andina-005', title: 'Informe de resultados', description: 'Comparativo antes y después.', assigneeId: 'usr-andina-002', priority: 'MEDIUM', dueDate: '2026-10-20', status: 'COMPLETED', createdAt: '2026-10-01T09:00:00.000Z', updatedAt: '2026-10-20T17:00:00.000Z' },

    // prj-andina-006 (6)
    { id: 'tsk-andina-032', projectId: 'prj-andina-006', title: 'Registro de transportistas', description: 'Alta de proveedores logísticos.', assigneeId: 'usr-andina-004', priority: 'HIGH', dueDate: '2026-11-18', status: 'COMPLETED', createdAt: '2026-11-12T11:00:00.000Z', updatedAt: '2026-11-17T17:00:00.000Z' },
    { id: 'tsk-andina-033', projectId: 'prj-andina-006', title: 'Definición de rutas frecuentes', description: 'Priorización por volumen.', assigneeId: 'usr-andina-006', priority: 'MEDIUM', dueDate: '2026-11-25', status: 'IN_PROGRESS', createdAt: '2026-11-13T11:00:00.000Z', updatedAt: '2026-11-19T16:00:00.000Z' },
    { id: 'tsk-andina-034', projectId: 'prj-andina-006', title: 'Formato de guía de despacho', description: 'Estandarización de datos.', assigneeId: 'usr-andina-003', priority: 'MEDIUM', dueDate: '2026-12-02', status: 'PENDING', createdAt: '2026-11-14T11:00:00.000Z', updatedAt: '2026-11-14T11:00:00.000Z' },
    { id: 'tsk-andina-035', projectId: 'prj-andina-006', title: 'Prueba de rastreo básico', description: 'Seguimiento de entregas piloto.', assigneeId: 'usr-andina-005', priority: 'HIGH', dueDate: '2026-12-12', status: 'BLOCKED', createdAt: '2026-11-15T11:00:00.000Z', updatedAt: '2026-11-18T12:00:00.000Z' },
    { id: 'tsk-andina-036', projectId: 'prj-andina-006', title: 'Acuerdos de tiempos de entrega', description: 'Niveles de servicio por zona.', assigneeId: null, priority: 'MEDIUM', dueDate: '2026-12-20', status: 'PENDING', createdAt: '2026-11-16T11:00:00.000Z', updatedAt: '2026-11-16T11:00:00.000Z' },
    { id: 'tsk-andina-037', projectId: 'prj-andina-006', title: 'Tablero de incidencias', description: 'Registro de retrasos y novedades.', assigneeId: 'usr-andina-002', priority: 'LOW', dueDate: '2027-01-10', status: 'PENDING', createdAt: '2026-11-17T11:00:00.000Z', updatedAt: '2026-11-17T11:00:00.000Z' },

    // prj-andina-007 (6)
    { id: 'tsk-andina-038', projectId: 'prj-andina-007', title: 'Definición de indicadores clave', description: 'KPIs de avance y cumplimiento.', assigneeId: 'usr-andina-002', priority: 'HIGH', dueDate: '2026-10-01', status: 'COMPLETED', createdAt: '2026-09-21T08:00:00.000Z', updatedAt: '2026-09-30T17:00:00.000Z' },
    { id: 'tsk-andina-039', projectId: 'prj-andina-007', title: 'Consolidación de fuentes de datos', description: 'Inventario de reportes existentes.', assigneeId: 'usr-andina-003', priority: 'MEDIUM', dueDate: '2026-10-20', status: 'COMPLETED', createdAt: '2026-10-02T08:00:00.000Z', updatedAt: '2026-10-19T16:00:00.000Z' },
    { id: 'tsk-andina-040', projectId: 'prj-andina-007', title: 'Diseño de vistas por área', description: 'Resumen para dirección y operación.', assigneeId: 'usr-andina-007', priority: 'MEDIUM', dueDate: '2026-11-08', status: 'IN_PROGRESS', createdAt: '2026-10-21T08:00:00.000Z', updatedAt: '2026-11-14T12:10:00.000Z' },
    { id: 'tsk-andina-041', projectId: 'prj-andina-007', title: 'Validación de métricas de tareas', description: 'Cruce con estados reales.', assigneeId: 'usr-andina-004', priority: 'HIGH', dueDate: '2026-11-22', status: 'PENDING', createdAt: '2026-11-01T08:00:00.000Z', updatedAt: '2026-11-01T08:00:00.000Z' },
    { id: 'tsk-andina-042', projectId: 'prj-andina-007', title: 'Revisión de permisos de visualización', description: 'Acceso según responsabilidad.', assigneeId: 'usr-andina-005', priority: 'LOW', dueDate: '2026-11-28', status: 'BLOCKED', createdAt: '2026-11-05T08:00:00.000Z', updatedAt: '2026-11-13T09:00:00.000Z' },
    { id: 'tsk-andina-043', projectId: 'prj-andina-007', title: 'Presentación a gerencia', description: 'Demostración del tablero.', assigneeId: 'usr-andina-002', priority: 'MEDIUM', dueDate: '2026-12-03', status: 'PENDING', createdAt: '2026-11-08T08:00:00.000Z', updatedAt: '2026-11-08T08:00:00.000Z' },
  ]

  const pacificoProjects: ProjectSeed[] = [
    {
      id: 'prj-pacifico-001',
      name: 'Renovación de catálogo costero',
      description: 'Actualización de referencias para sucursales del litoral.',
      startDate: '2026-10-01',
      endDate: '2026-12-10',
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-11-09T09:00:00.000Z',
    },
  ]
  const pacificoTasks: TaskSeed[] = [
    { id: 'tsk-pacifico-001', projectId: 'prj-pacifico-001', title: 'Revisión de precios locales', description: null, assigneeId: 'usr-pacifico-001', priority: 'MEDIUM', dueDate: '2026-11-20', status: 'IN_PROGRESS', createdAt: '2026-10-02T08:00:00.000Z', updatedAt: '2026-11-09T09:00:00.000Z' },
  ]

  return {
    [DEFAULT_TENANT_ID]: {
      projects: andinaProjects.map((p) => ({ ...p, deletedAt: p.deletedAt ?? null })),
      tasks: andinaTasks.map((t) => ({ ...t, deletedAt: t.deletedAt ?? null })),
    },
    'tnt-pacifico-002': {
      projects: pacificoProjects.map((p) => ({ ...p, deletedAt: p.deletedAt ?? null })),
      tasks: pacificoTasks.map((t) => ({ ...t, deletedAt: t.deletedAt ?? null })),
    },
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

let stores = new Map<string, { projects: Project[]; tasks: Task[] }>()
let nextProjectId = 1000
let nextTaskId = 5000

function initStores(): void {
  stores = new Map<string, { projects: Project[]; tasks: Task[] }>()
  const seed = buildSeed()
  for (const [tenantId, data] of Object.entries(seed)) {
    stores.set(tenantId, {
      projects: data.projects.map((p) => ({ ...p })),
      tasks: data.tasks.map((t) => ({ ...t })),
    })
  }
  nextProjectId = 1000
  nextTaskId = 5000
}

initStores()

function paginate<T>(items: T[], page: number): { items: T[]; hasNext: boolean } {
  const start = page * PAGE_SIZE
  const pageItems = items.slice(start, start + PAGE_SIZE)
  return { items: pageItems, hasNext: start + PAGE_SIZE < items.length }
}

// SOLID: SRP - ADMINISTRA PROYECTOS Y TAREAS EN MEMORIA RESPETANDO EL CONTRATO Y EL TENANT ACTIVO.
export class ProjectMockRepository implements ProjectRepository {
  private explicitTenantId?: string

  constructor(explicitTenantId?: string) {
    this.explicitTenantId = explicitTenantId
  }

  private getActiveTenant(): string {
    return this.explicitTenantId ?? DEFAULT_TENANT_ID
  }

  private getStore(): { projects: Project[]; tasks: Task[] } {
    const tenantId = this.getActiveTenant()
    if (!stores.has(tenantId)) {
      stores.set(tenantId, { projects: [], tasks: [] })
    }
    return stores.get(tenantId)!
  }

  async list(filters: ProjectFilters = {}, page = 0): Promise<ProjectPage> {
    await delay()
    this.validatePage(page)
    let items = this.getStore().projects.filter((p) => !p.deletedAt)

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase()
      items = items.filter((p) => {
        const name = p.name.toLowerCase()
        const description = (p.description ?? '').toLowerCase()
        return name.includes(term) || description.includes(term)
      })
    }

    items = [...items].sort((a, b) => {
      const byStart = compareDateStrings(b.startDate, a.startDate)
      if (byStart !== 0) return byStart
      return b.updatedAt.localeCompare(a.updatedAt)
    })

    const { items: pageItems, hasNext } = paginate(items, page)
    return {
      items: pageItems.map((p) => ({ ...p })),
      page,
      size: PAGE_SIZE,
      hasNext,
    }
  }

  async getById(id: string): Promise<Project> {
    await delay()
    const project = this.getStore().projects.find((p) => p.id === id && !p.deletedAt)
    if (!project) {
      throw new ProjectApiError('Proyecto no encontrado.', 'not_found')
    }
    return { ...project }
  }

  async create(input: ProjectInput): Promise<Project> {
    await delay()
    const normalized = this.validateProjectInput(input)
    const store = this.getStore()
    const duplicate = store.projects.find(
      (p) => !p.deletedAt && p.name.toLowerCase() === normalized.name.toLowerCase()
    )
    if (duplicate) {
      throw new ProjectApiError('Ya existe un proyecto con el mismo nombre.', 'conflict', {
        name: 'Ya existe un proyecto con el mismo nombre.',
      })
    }

    nextProjectId += 1
    const timestamp = nowIso()
    const project: Project = {
      id: `prj-${this.getActiveTenant().slice(-3)}-${nextProjectId}`,
      name: normalized.name,
      description: normalized.description,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }
    store.projects = [project, ...store.projects]
    return { ...project }
  }

  async update(id: string, input: ProjectInput): Promise<Project> {
    await delay()
    const normalized = this.validateProjectInput(input)
    const store = this.getStore()
    const index = store.projects.findIndex((p) => p.id === id && !p.deletedAt)
    if (index < 0) {
      throw new ProjectApiError('Proyecto no encontrado.', 'not_found')
    }
    const duplicate = store.projects.find(
      (p) => !p.deletedAt && p.id !== id && p.name.toLowerCase() === normalized.name.toLowerCase()
    )
    if (duplicate) {
      throw new ProjectApiError('Ya existe un proyecto con el mismo nombre.', 'conflict', {
        name: 'Ya existe un proyecto con el mismo nombre.',
      })
    }

    const updated: Project = {
      ...store.projects[index],
      name: normalized.name,
      description: normalized.description,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      updatedAt: nowIso(),
    }
    store.projects[index] = updated
    return { ...updated }
  }

  async listTasks(projectId: string, status: TaskStatus | '' = '', page = 0): Promise<TaskPage> {
    await delay()
    this.validatePage(page)
    this.ensureProjectExists(projectId)
    let items = this.getStore().tasks.filter((t) => t.projectId === projectId && !t.deletedAt)
    if (status) {
      items = items.filter((t) => t.status === status)
    }
    items = [...items].sort((a, b) => {
      const byDue = compareDateStrings(a.dueDate, b.dueDate)
      if (byDue !== 0) return byDue
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    const { items: pageItems, hasNext } = paginate(items, page)
    return {
      items: pageItems.map((t) => ({ ...t })),
      page,
      size: PAGE_SIZE,
      hasNext,
    }
  }

  async createTask(projectId: string, input: TaskInput): Promise<Task> {
    await delay()
    this.ensureProjectExists(projectId)
    const normalized = this.validateTaskInput(input)
    const store = this.getStore()

    nextTaskId += 1
    const timestamp = nowIso()
    const task: Task = {
      id: `tsk-${this.getActiveTenant().slice(-3)}-${nextTaskId}`,
      projectId,
      title: normalized.title,
      description: normalized.description,
      assigneeId: normalized.assigneeId,
      priority: normalized.priority,
      dueDate: normalized.dueDate,
      status: 'PENDING',
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }
    store.tasks = [task, ...store.tasks]
    return { ...task }
  }

  async updateTaskStatus(projectId: string, taskId: string, status: TaskStatus): Promise<Task> {
    await delay()
    if (!TASK_STATUSES.includes(status)) {
      throw new ProjectApiError('Estado de tarea no válido.', 'validation', {
        status: 'Estado de tarea no válido.',
      })
    }
    this.ensureProjectExists(projectId)
    const store = this.getStore()
    const index = store.tasks.findIndex(
      (t) => t.id === taskId && t.projectId === projectId && !t.deletedAt
    )
    if (index < 0) {
      throw new ProjectApiError('Tarea no encontrada.', 'not_found')
    }
    const updated: Task = {
      ...store.tasks[index],
      status,
      updatedAt: nowIso(),
    }
    store.tasks[index] = updated
    return { ...updated }
  }

  private validatePage(page: number): void {
    if (!Number.isInteger(page) || page < 0) {
      throw new ProjectApiError('La página solicitada no es válida.', 'validation', {
        page: 'La página debe ser un entero mayor o igual a 0.',
      })
    }
  }

  private ensureProjectExists(projectId: string): Project {
    const project = this.getStore().projects.find((p) => p.id === projectId && !p.deletedAt)
    if (!project) {
      throw new ProjectApiError('Proyecto no encontrado.', 'not_found')
    }
    return project
  }

  private validateProjectInput(input: ProjectInput): {
    name: string
    description: string | null
    startDate: string | null
    endDate: string | null
  } {
    const name = normalizeText(input.name)
    const description = normalizeText(input.description ?? null)
    const startDate = normalizeText(input.startDate ?? null)
    const endDate = normalizeText(input.endDate ?? null)
    const errors: Record<string, string> = {}

    if (!name) {
      errors.name = 'El nombre del proyecto es obligatorio.'
    }
    if (startDate && !isValidDateString(startDate)) {
      errors.startDate = 'La fecha de inicio no es válida.'
    }
    if (endDate && !isValidDateString(endDate)) {
      errors.endDate = 'La fecha de fin no es válida.'
    }
    if (startDate && endDate && endDate < startDate) {
      errors.endDate = 'La fecha de fin no puede ser anterior a la fecha de inicio.'
    }

    if (Object.keys(errors).length > 0) {
      throw new ProjectApiError('Error de validación al guardar el proyecto.', 'validation', errors)
    }

    return { name: name!, description, startDate, endDate }
  }

  private validateTaskInput(input: TaskInput): {
    title: string
    description: string | null
    assigneeId: string | null
    priority: Task['priority']
    dueDate: string | null
  } {
    const title = normalizeText(input.title)
    const description = normalizeText(input.description ?? null)
    const assigneeId = normalizeText(input.assigneeId ?? null)
    const dueDate = normalizeText(input.dueDate ?? null)
    const priority = input.priority ?? null
    const errors: Record<string, string> = {}

    if (!title) {
      errors.title = 'El título de la tarea es obligatorio.'
    }
    if (dueDate && !isValidDateString(dueDate)) {
      errors.dueDate = 'La fecha límite no es válida.'
    }
    if (priority && !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
      errors.priority = 'La prioridad seleccionada no es válida.'
    }

    if (Object.keys(errors).length > 0) {
      throw new ProjectApiError('Error de validación al guardar la tarea.', 'validation', errors)
    }

    return { title: title!, description, assigneeId, priority, dueDate }
  }
}

export function resetProjectMockStore(): void {
  initStores()
}

