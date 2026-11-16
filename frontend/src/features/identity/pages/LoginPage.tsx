import { useState, type FormEvent } from 'react'
import './LoginPage.css'

function LoginPage() {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [notice, setNotice] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice('El proveedor de identidad aún no está configurado. No se enviaron tus credenciales.')
  }

  return (
    <main className="login-screen">
      <section className="login-showcase" aria-labelledby="product-title">
        <header className="login-brand">
          <span className="login-brand__mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>ERP <span className="login-brand__plus">+</span> CRM</span>
        </header>

        <div className="login-showcase__copy">
          <p className="login-eyebrow">ESPACIO DE TRABAJO</p>
          <h1 id="product-title">Tu operación, en un solo lugar.</h1>
          <p className="login-showcase__description">
            Ingresa para continuar con las herramientas de gestión de tu organización.
          </p>
        </div>

        <div className="login-art" aria-hidden="true">
          <div className="login-art__halo" />
          <div className="login-art__window">
            <div className="login-art__window-bar">
              <span />
              <span />
              <span />
              <i />
            </div>
            <div className="login-art__window-content">
              <div className="login-art__sidebar">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="login-art__dashboard">
                <div className="login-art__heading" />
                <div className="login-art__metrics">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="login-art__chart">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </div>
          <div className="login-art__spark login-art__spark--one" />
          <div className="login-art__spark login-art__spark--two" />
        </div>

        <p className="login-showcase__footer">Gestión clara para equipos que avanzan.</p>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-card__intro">
            <p className="login-eyebrow">ACCESO A LA PLATAFORMA</p>
            <h2 id="login-title">Bienvenido</h2>
            <p>Ingresa tus datos para continuar.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>Correo electrónico</span>
              <input
                autoComplete="username"
                name="email"
                placeholder="nombre@organizacion.com"
                required
                type="email"
              />
            </label>

            <label className="login-field">
              <span>Contraseña</span>
              <span className="login-password">
                <input
                  autoComplete="current-password"
                  name="password"
                  placeholder="Ingresa tu contraseña"
                  required
                  type={passwordVisible ? 'text' : 'password'}
                />
                <button
                  aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="login-password__toggle"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  type="button"
                >
                  {passwordVisible ? 'Ocultar' : 'Mostrar'}
                </button>
              </span>
            </label>

            <button className="login-submit" type="submit">
              <span>Continuar</span>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="M4.167 10h11.666M10 4.167 15.833 10 10 15.833" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <p aria-live="polite" className="login-notice" role="status">
              {notice}
            </p>
          </form>

          <div className="login-card__divider" />
          <p className="login-card__help">
            ¿Necesitas acceso? Contacta al administrador de tu organización.
          </p>
        </div>

        <footer className="login-panel__footer">
          <span>ERP + CRM</span>
          <span>© ERP + CRM</span>
        </footer>
      </section>
    </main>
  )
}

export default LoginPage
