// src/pages/DashboardPage.jsx
import { useAuth } from '../store/AuthContext'
import {
  BookOpen, FlaskConical, ArrowLeftRight, ChevronRight,
  BarChart2, FileText, Monitor, AlertTriangle, AlertCircle, Calendar
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../api'

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize = (d) => d?.data ?? d ?? {};
const safeNum   = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const formatPct = (v) => safeNum(v).toFixed(1) + "%";
const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function DashboardPage() {
  const { user, hasRole } = useAuth()

  // Módulos
  const cards = [
    {
      title: 'Guías de Laboratorio',
      desc: 'Consulta y descarga prácticas de laboratorio por asignatura y sede.',
      icon: BookOpen, href: '/guias', iconBg: '#EFF6FF', iconColor: '#002B5E',
      visible: true,
    },
    {
      title: 'Laboratorios',
      desc: 'Gestión de equipos, activos y evaluaciones in-situ.',
      icon: FlaskConical, href: '/laboratorios', iconBg: '#ECFDF5', iconColor: '#065f46',
      visible: hasRole('admin', 'jefe', 'decano', 'encargado_activos'),
    },
    {
      title: 'Reordenamiento',
      desc: 'Traslado y reasignación de equipos entre las 5 sedes.',
      icon: ArrowLeftRight, href: '/reordenamientos', iconBg: '#FFFBEB', iconColor: '#92400e',
      visible: hasRole('admin', 'jefe', 'decano'),
    },
    {
      title: 'Comparativa Sedes',
      desc: 'Análisis comparativo de disponibilidad de recursos.',
      icon: BarChart2, href: '/reordenamientos/comparativa', iconBg: '#F5F3FF', iconColor: '#5b21b6',
      visible: hasRole('admin', 'jefe', 'decano'),
    },
    {
      title: 'Reportes',
      desc: 'Exportación de métricas e inventarios en formato PDF.',
      icon: FileText, href: '/reportes', iconBg: '#F0F9FF', iconColor: '#0284c7',
      visible: hasRole('admin', 'jefe', 'decano'),
    },
  ].filter((c) => c.visible)

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard_metricas'],
    queryFn: () => dashboardApi.fetchDashboardMetrics(),
    staleTime: 60 * 1000,
  });

  const metrics = normalize(data);

  // Barra equipos malos
  const pctMalos = safeNum(metrics?.equipos_malos_porcentaje);
  const colorMalos = pctMalos < 10 ? "#16a34a" : pctMalos <= 25 ? "#f59e0b" : "#dc2626";

  const kpis = [
    { label: "Guías Publicadas", value: safeNum(metrics?.total_guias_publicadas), icon: BookOpen, color: "#002B5E" },
    { label: "Total Equipos", value: safeNum(metrics?.total_equipos), icon: Monitor, color: "#4f46e5" },
    { label: "Equipos Malos (%)", value: formatPct(pctMalos), icon: AlertTriangle, color: colorMalos, isPct: true },
    { label: "Labs Activos", value: safeNum(metrics?.laboratorios_activos), icon: FlaskConical, color: "#0d9488" },
  ];

  const proximas = Array.isArray(metrics?.proximas_practicas) ? metrics.proximas_practicas : [];
  const pendientes = safeNum(metrics?.reordenamientos_pendientes);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "40px" }} className="animate-fade-in">

      {/* ── Header ──────────────────────────────────── */}
      <div style={{ backgroundColor: "#002B5E", borderRadius: "16px", padding: "40px", marginBottom: "32px", boxShadow: "0 10px 25px rgba(0,43,94,0.3)" }}>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "12px" }}>Escuela Militar de Ingeniería</p>
        <h1 style={{ fontSize: "30px", fontWeight: 800, color: "#ffffff", lineHeight: 1.2, letterSpacing: "-0.02em" }}>Bienvenido, {user?.nombre_completo?.split(' ')[0] || 'Usuario'}</h1>
        <p style={{ fontSize: "16px", fontWeight: 500, color: "#93c5fd", marginTop: "12px", lineHeight: 1.6, maxWidth: "560px" }}>Panel central para gestionar guías, recursos y operaciones de laboratorios.</p>
      </div>

      {/* ── Banner Alerta Reordenamientos ────────────────────── */}
      {!isLoading && pendientes > 0 && hasRole('admin', 'decano') && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", padding: "16px 24px", borderRadius: "12px", backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", marginBottom: "32px", boxShadow: "0 2px 4px rgba(245,158,11,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <AlertCircle size={24} color="#D97706" />
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#92400E" }}>
              Tienes {pendientes} traslado{pendientes > 1 ? "s" : ""} pendiente{pendientes > 1 ? "s" : ""} de autorización.
            </p>
          </div>
          <Link to="/reordenamientos" style={{ backgroundColor: "#D97706", color: "#fff", padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 4px rgba(217,119,6,0.3)" }} className="hover:bg-amber-700 transition-colors">
            Ver traslados
          </Link>
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────── */}
      <h2 style={{ fontSize: "15px", fontWeight: 800, color: "#111827", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}><BarChart2 size={18} color="#002B5E" />Métricas Generales</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "40px" }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: isLoading ? "#f3f4f6" : `${kpi.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {!isLoading && <kpi.icon size={20} color={kpi.color} />}
              </div>
            </div>
            {isLoading ? (
              <>
                <div style={{ height: "30px", width: "60%", backgroundColor: "#f3f4f6", borderRadius: "6px", marginBottom: "8px" }} className="animate-pulse" />
                <div style={{ height: "14px", width: "40%", backgroundColor: "#f3f4f6", borderRadius: "6px" }} className="animate-pulse" />
              </>
            ) : (
              <>
                <h3 style={{ fontSize: "28px", fontWeight: 800, color: "#111827", lineHeight: 1, marginBottom: "8px" }}>{kpi.value}</h3>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</p>
                {/* Visual indicator for bad equipment percentage */}
                {kpi.isPct && (
                  <div style={{ height: "6px", width: "100%", backgroundColor: "#f3f4f6", borderRadius: "3px", marginTop: "12px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(pctMalos, 100)}%`, backgroundColor: kpi.color, borderRadius: "3px", transition: "width 500ms ease" }} />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "40px" }} className="lg:grid-cols-2">
        {/* ── Accesos Rápidos ─────────────────────────────────── */}
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: 800, color: "#111827", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}><Monitor size={18} color="#002B5E" />Accesos Rápidos</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {cards.map((card) => (
              <Link key={card.href} to={card.href} style={{ display: "flex", alignItems: "center", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "20px", textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 200ms ease" }} className="hover:shadow-md hover:border-gray-300">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "12px", backgroundColor: card.iconBg, flexShrink: 0, marginRight: "16px" }}><card.icon size={22} color={card.iconColor} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>{card.title}</h3>
                  <p style={{ fontSize: "13px", fontWeight: 500, color: "#6b7280", lineHeight: 1.4, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.desc}</p>
                </div>
                <ChevronRight size={20} color="#9ca3af" />
              </Link>
            ))}
          </div>
        </div>

        {/* ── Próximas Prácticas ──────────────────────────────── */}
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: 800, color: "#111827", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}><Calendar size={18} color="#002B5E" />Próximas Prácticas Programadas</h2>
          <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            {isLoading ? (
              <div style={{ padding: "24px" }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: "64px", backgroundColor: "#f3f4f6", borderRadius: "8px", marginBottom: i < 3 ? "12px" : 0 }} className="animate-pulse" />)}
              </div>
            ) : proximas.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <Calendar size={32} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#6b7280" }}>No hay prácticas programadas próximamente.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                      {["Asignatura", "Práctica", "Laboratorio", "Fecha"].map((h) => (
                        <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {proximas.map((p, i) => (
                      <tr key={i} style={{ borderBottom: i < proximas.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                        <td style={{ padding: "16px 20px", fontSize: "14px", fontWeight: 700, color: "#111827" }}>{p.asignatura || "—"}</td>
                        <td style={{ padding: "16px 20px", fontSize: "14px", fontWeight: 600, color: "#4b5563" }}>N.º {p.practica || "—"}</td>
                        <td style={{ padding: "16px 20px", fontSize: "14px", fontWeight: 500, color: "#4b5563" }}>{p.laboratorio || "—"}</td>
                        <td style={{ padding: "16px 20px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#002B5E", backgroundColor: "#EFF6FF", padding: "4px 8px", borderRadius: "6px" }}>{formatDate(p.fecha)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}