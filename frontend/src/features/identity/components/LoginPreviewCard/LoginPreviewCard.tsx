// SOLID: SRP - RENDERIZA LA TARJETA DECORATIVA DE VISTA PREVIA DEL LOGIN CON DATOS FICTICIOS FIJOS.
import './LoginPreviewCard.css'

export function LoginPreviewCard() {
  return (
    <div className="login-preview" aria-hidden="true">
      <div className="login-preview__bar">
        <div className="login-preview__dots">
          <span className="login-preview__dot login-preview__dot--red" />
          <span className="login-preview__dot login-preview__dot--amber" />
          <span className="login-preview__dot login-preview__dot--green" />
          <span className="login-preview__label">Panel Ejecutivo</span>
        </div>
        <div className="login-preview__bar-right">
          <span className="login-preview__badge">En línea</span>
          <span className="login-preview__avatar">EA</span>
        </div>
      </div>

      <div className="login-preview__kpis">
        <div className="login-preview__kpi">
          <span className="login-preview__kpi-title">Facturación</span>
          <span className="login-preview__kpi-value">$148,250</span>
          <span className="login-preview__kpi-delta login-preview__kpi-delta--up">↑ +14.2%</span>
        </div>
        <div className="login-preview__kpi">
          <span className="login-preview__kpi-title">Clientes Activos</span>
          <span className="login-preview__kpi-value">342</span>
          <span className="login-preview__kpi-delta login-preview__kpi-delta--up">↑ +18 este mes</span>
        </div>
        <div className="login-preview__kpi">
          <span className="login-preview__kpi-title">Por Cobrar</span>
          <span className="login-preview__kpi-value">$34,890</span>
          <span className="login-preview__kpi-delta login-preview__kpi-delta--warn">• 4 pendientes</span>
        </div>
      </div>

      <div className="login-preview__table">
        <div className="login-preview__table-header">
          <span>Últimas operaciones</span>
          <span className="login-preview__table-link">Ver todas</span>
        </div>
        <div className="login-preview__row">
          <div className="login-preview__row-main">
            <span className="login-preview__row-title">Inversiones del Pacífico</span>
            <span className="login-preview__row-sub">Factura #F001-492</span>
          </div>
          <div className="login-preview__row-side">
            <span className="login-preview__row-amount">$20,690.50</span>
            <span className="login-preview__status login-preview__status--paid">Pagado</span>
          </div>
        </div>
        <div className="login-preview__row">
          <div className="login-preview__row-main">
            <span className="login-preview__row-title">TechSupply Global</span>
            <span className="login-preview__row-sub">Orden #OC-4921</span>
          </div>
          <div className="login-preview__row-side">
            <span className="login-preview__row-amount">$18,340.50</span>
            <span className="login-preview__status login-preview__status--pending">Pendiente</span>
          </div>
        </div>
        <div className="login-preview__row">
          <div className="login-preview__row-main">
            <span className="login-preview__row-title">Andina Mining Solutions</span>
            <span className="login-preview__row-sub">Contrato suscripción</span>
          </div>
          <div className="login-preview__row-side">
            <span className="login-preview__row-amount">$62,800.00</span>
            <span className="login-preview__status login-preview__status--paid">Pagado</span>
          </div>
        </div>
      </div>

      <div className="login-preview__footer-pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>Plataforma empresarial unificada</span>
      </div>
    </div>
  )
}
