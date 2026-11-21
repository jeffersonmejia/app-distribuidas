import { useState, type FormEvent } from 'react'
import { Input } from '../../../components/forms'
import { Button } from '../../../components/ui'
import { useSession } from '../hooks'
import { useRouter } from '../../../app/router'
import { LoginPreviewCard } from '../components/LoginPreviewCard'
import './LoginPage.css'

// SOLID: SRP — ESTA PÁGINA SE ENCARGA EXCLUSIVAMENTE DE RENDERIZAR LA PANTALLA DE INICIO DE SESIÓN.

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function LoginPage() {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [notice, setNotice] = useState('')
  const { signIn } = useSession()
  const { navigate } = useRouter()

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      const formData = new FormData(e.currentTarget)
      const email = (formData.get('email') as string) || ''
      if (signIn) {
        await signIn(email)
      }
      setNotice('Sesión iniciada con éxito. Redirigiendo...')
      navigate('/')
    } catch {
      setNotice('El proveedor de identidad aún no está configurado. No se enviaron credenciales.')
    }
  }

  return (
    <main className="login-screen">
      <div className="login-shell">
      {/* ── TARJETA IZQUIERDA: Branding + Mockup ── */}
      <section className="login-brand-card" aria-labelledby="login-brand-heading">
        {/* Destellos decorativos */}
        <div className="login-glow login-glow--top" aria-hidden="true" />
        <div className="login-glow login-glow--bottom" aria-hidden="true" />

        {/* Encabezado de texto */}
        <div className="login-brand-copy">
          <h1 id="login-brand-heading" className="login-brand-heading">
            Gestiona tu organización en un solo lugar
          </h1>
          <p className="login-brand-subheading">
            Controla contabilidad, clientes, inventario y ventas desde un solo panel.
          </p>
        </div>

        <div className="login-perspective" aria-hidden="true">
          <LoginPreviewCard />
        </div>

      </section>

      {/* ── TARJETA DERECHA: Formulario ── */}
      <section className="login-form-card" aria-labelledby="login-title">
        {/* Logo + nombre */}
        <header className="login-logo-header">
          <div className="login-logo-mark" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="login-logo-name">ERP + CRM</p>
            <p className="login-logo-desc">Panel de gestión empresarial</p>
          </div>
        </header>

        {/* Formulario centrado */}
        <div className="login-form-wrapper">
          <div className="login-form-intro">
            <h2 id="login-title" className="login-form-title">
              Iniciar sesión
            </h2>
            <p className="login-form-subtitle">
              Bienvenido de nuevo, ingresa tus datos para continuar.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <Input
              id="email"
              label="Correo electrónico"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="nombre@empresa.com"
            />

            <Input
              id="password"
              label="Contraseña"
              name="password"
              type={passwordVisible ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Ingresa tu contraseña"
              endAdornment={
                <button
                  type="button"
                  className="login-eye-btn"
                  aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setPasswordVisible((v) => !v)}
                  tabIndex={-1}
                >
                  <EyeIcon open={passwordVisible} />
                </button>
              }
            />

            {/* Recordarme + Olvidaste contraseña */}
            <div className="login-form-row">
              <label className="login-remember">
                <input
                  type="checkbox"
                  name="remember"
                  className="login-remember__checkbox"
                  disabled
                  aria-disabled="true"
                />
                <span>Recordarme</span>
              </label>
              {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
              <a
                role="link"
                aria-disabled="true"
                className="login-forgot"
                onClick={(e) => e.preventDefault()}
                href="#"
                tabIndex={-1}
              >
                ¿Olvidaste tu contraseña?
              </a>            </div>

            <Button type="submit" variant="primary" style={{ width: '100%' }}>
              Iniciar sesión →
            </Button>

            {/* Separador */}
            <div className="login-divider" aria-hidden="true">
              <span className="login-divider__line" />
              <span className="login-divider__text">o continúa con</span>
              <span className="login-divider__line" />
            </div>

            {/* Botones sociales — deshabilitados */}
            <div className="login-social">
              <button type="button" className="login-social__btn" disabled aria-disabled="true">
                {/* SVG inline Google */}
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button type="button" className="login-social__btn" disabled aria-disabled="true">
                {/* SVG inline Microsoft */}
                <svg width="20" height="20" viewBox="0 0 23 23" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" fill="#f25022" />
                  <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
                  <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
                  <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
                </svg>
                <span>Microsoft</span>
              </button>
            </div>
          </form>

          {/* Aviso de estado */}
          <p role="status" aria-live="polite" className="login-notice">
            {notice || 'El proveedor de identidad aún no está configurado. No se enviaron credenciales.'}
          </p>
        </div>

        {/* Pie */}
        <footer className="login-footer">
          <span>� 2026 ERP + CRM</span>
        </footer>
      </section>
      </div>
    </main>
  )
}

export default LoginPage
