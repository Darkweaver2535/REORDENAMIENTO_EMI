import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { getRolDisplay } from '../../config/roles'
import {
  BookOpen, FlaskConical, ArrowLeftRight,
  BarChart2, LogOut, Menu, X, Settings,
  Building2, User, Users, FileText,
  LayoutDashboard, Monitor, ShieldCheck
} from 'lucide-react'
import { useState } from 'react'
import NotificationBell from './NotificationBell'
import { EmiLogo, EmiCastle } from '../ui'

export default function AppLayout() {
  const { user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => { logout(); navigate('/login') }

  const linkBase = {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "12px 16px",
    marginBottom: "2px",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    transition: "all 150ms ease",
  }

  // Enlace activo: fondo translúcido + acento amarillo institucional (firma EMI)
  const linkActive = {
    ...linkBase,
    backgroundColor: "rgba(255,255,255,0.14)",
    color: "#ffffff",
    boxShadow: "inset 3px 0 0 #FFDD00",
  }
  const linkInactive = { ...linkBase, color: "#c5dcf3" }

  const navLinkStyle = ({ isActive }) => isActive ? linkActive : linkInactive

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", backgroundColor: "#eef3fa" }}>

      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <aside
        style={{
          width: sidebarOpen ? "264px" : "0px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, #004F9F 0%, #003D7C 100%)",
          overflow: "hidden",
          transition: "width 300ms ease",
        }}
      >
        {/* Logo institucional EMI */}
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          height: "76px",
          borderBottom: "1px solid rgba(255,255,255,0.14)",
          flexShrink: 0,
        }}>
          <EmiLogo variant="full" theme="dark" markSize={38} subtitle="Gestión de Laboratorios" />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "20px 16px", overflowY: "auto" }}>

          <p style={{ padding: "4px 16px 16px", color: "rgba(255,221,0,0.85)", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em" }}>
            Módulos
          </p>

          <NavLink to="/dashboard" style={navLinkStyle}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/guias" style={navLinkStyle}>
            <BookOpen size={20} />
            <span>Guías de Laboratorio</span>
          </NavLink>

          {hasRole('admin', 'jefe', 'encargado_activos') && (
            <NavLink to="/laboratorios" style={navLinkStyle}>
              <FlaskConical size={20} />
              <span>Laboratorios</span>
            </NavLink>
          )}

          {hasRole('admin', 'jefe', 'encargado_activos') && (
            <NavLink to="/equipos" style={navLinkStyle}>
              <Monitor size={20} />
              <span>Ficha Técnica</span>
            </NavLink>
          )}

          {hasRole('admin', 'jefe') && (
            <>
              <p style={{ padding: "28px 16px 16px 16px", color: "rgba(255,221,0,0.85)", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em" }}>
                Unidades Académicas
              </p>

              <NavLink to="/reordenamientos" end style={navLinkStyle}>
                <ArrowLeftRight size={20} />
                <span>Reordenamiento</span>
              </NavLink>

              {
                <NavLink to="/reordenamientos/comparativa" style={navLinkStyle}>
                  <BarChart2 size={20} />
                  <span>Comparativa U.A.</span>
                </NavLink>
              }

              <NavLink to="/reportes" style={navLinkStyle}>
                <FileText size={20} />
                <span>Reportes</span>
              </NavLink>

              {hasRole('admin') && (
                <>
                  <NavLink to="/admin/usuarios" style={navLinkStyle}>
                    <Users size={20} />
                    <span>Usuarios</span>
                  </NavLink>

                  <NavLink to="/admin/configuracion" style={navLinkStyle}>
                    <Settings size={20} />
                    <span>Configuración</span>
                  </NavLink>
                </>
              )}

              {hasRole('admin', 'jefe') && (
                <NavLink to="/admin/auditoria" style={navLinkStyle}>
                  <ShieldCheck size={20} />
                  <span>Auditoría</span>
                </NavLink>
              )}
            </>
          )}
        </nav>

        {/* Usuario */}
        <div style={{ padding: "20px", borderTop: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              flexShrink: 0, width: "44px", height: "44px", borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.15)", border: "2px solid #FFDD00",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <User size={20} color="white" />
            </div>
            <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
              <p style={{ color: "#ffffff", fontSize: "15px", fontWeight: 700, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.nombre_completo}
              </p>
              <p style={{ color: "#93c5fd", fontSize: "13px", fontWeight: 500, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {getRolDisplay(user?.rol)} · {user?.unidad_academica_nombre || 'EMI'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              color: "#93c5fd", fontSize: "14px", fontWeight: 600,
              width: "100%", padding: "10px 12px", marginTop: "12px",
              borderRadius: "8px", cursor: "pointer", border: "none",
            }}
            className="hover:bg-white/5"
          >
            <LogOut size={17} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Navbar */}
        <header style={{
          height: "72px",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          borderTop: "3px solid #004F9F",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: "16px",
          flexShrink: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "42px", height: "42px", borderRadius: "10px",
              color: "#004F9F", cursor: "pointer", border: "none",
            }}
            className="hover:bg-gray-100"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div style={{ width: "1px", height: "24px", backgroundColor: "#e5e7eb", flexShrink: 0 }} />

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
            <EmiCastle size={30} theme="light" />
            <h2 style={{ fontSize: "17px", fontWeight: 800, color: "#003D7C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Sistema de Gestión de Laboratorios
            </h2>
            <span style={{ color: "#9ca3af", fontWeight: 600, fontSize: "15px", marginLeft: "4px", flexShrink: 0 }}>
              — EMI
            </span>
          </div>

          <NotificationBell />

          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "8px 16px", backgroundColor: "#DFEAF8",
              color: "#003D7C", fontSize: "14px", fontWeight: 700,
              borderRadius: "8px", border: "1px solid #c5dcf3", flexShrink: 0,
            }}
          >
            <Building2 size={16} />
            {user?.unidad_academica_nombre || 'Administración Central'}
          </span>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: "auto", backgroundColor: "#f9fafb", padding: "32px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}