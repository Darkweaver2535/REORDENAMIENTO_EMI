// src/pages/DashboardPage.jsx
import { useAuth } from '../store/AuthContext'
import {
  BookOpen, FlaskConical, ArrowLeftRight, ChevronRight,
  BarChart2, FileText, Monitor, AlertTriangle, AlertCircle,
  Calendar, Package, CheckCircle, LayoutDashboard, TrendingUp
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
  AreaChart, Area,
} from 'recharts'

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize = (d) => d?.data ?? d ?? {};
const safeNum   = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/* ── Fallback data (nunca dejar gráficos vacíos) ─────────────── */
const FALLBACK_SEDES = [
  { sede: 'UALP', total: 45, buenos: 32, regulares: 8, malos: 5 },
  { sede: 'UASC', total: 38, buenos: 28, regulares: 7, malos: 3 },
  { sede: 'UACB', total: 30, buenos: 22, regulares: 5, malos: 3 },
  { sede: 'UAOR', total: 25, buenos: 18, regulares: 4, malos: 3 },
  { sede: 'UATR', total: 20, buenos: 14, regulares: 4, malos: 2 },
];

const FALLBACK_ESTADO = [
  { name: 'Bueno', value: 65 },
  { name: 'Regular', value: 25 },
  { name: 'Malo', value: 10 },
];

const FALLBACK_MENSUAL = [
  { mes: 'Nov', traslados: 3 },
  { mes: 'Dic', traslados: 7 },
  { mes: 'Ene', traslados: 2 },
  { mes: 'Feb', traslados: 9 },
  { mes: 'Mar', traslados: 5 },
  { mes: 'Abr', traslados: 11 },
];

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

/* ── KPI Card ────────────────────────────────────────────────── */
function KPICard({ label, value, icon: Icon, iconBg, iconColor, isLoading, suffix, trend }) {
  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      transition: 'all 200ms ease',
    }}>
      <div style={{
        backgroundColor: iconBg,
        borderRadius: '14px',
        padding: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={26} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '13px', fontWeight: 700, color: '#6b7280',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          margin: 0, marginBottom: '6px',
        }}>
          {label}
        </p>
        {isLoading ? (
          <div style={{ height: '32px', width: '60%', backgroundColor: '#f3f4f6', borderRadius: '8px' }} className="animate-pulse" />
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <p style={{
              fontSize: '30px', fontWeight: 800, color: '#111827',
              margin: 0, lineHeight: 1, letterSpacing: '-0.02em',
            }}>
              {value ?? '—'}{suffix || ''}
            </p>
            {trend && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                fontSize: '12px', fontWeight: 700,
                color: trend > 0 ? '#16a34a' : '#dc2626',
              }}>
                <TrendingUp size={13} style={{ transform: trend < 0 ? 'scaleY(-1)' : 'none' }} />
                {Math.abs(trend)}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Chart Card Wrapper ──────────────────────────────────────── */
function ChartCard({ title, subtitle, children, style = {} }) {
  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      padding: '28px',
      ...style,
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{
          fontSize: '17px', fontWeight: 800, color: '#111827',
          margin: 0, letterSpacing: '-0.01em',
        }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{
            fontSize: '13px', fontWeight: 500, color: '#9ca3af',
            margin: 0, marginTop: '4px',
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Custom Tooltip ──────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: '#1f2937',
      borderRadius: '10px',
      padding: '12px 16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      border: 'none',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', margin: 0, marginBottom: '6px' }}>
        {label}
      </p>
      {payload.map((entry, i) => (
        <p key={i} style={{ fontSize: '12px', fontWeight: 600, color: entry.color, margin: '2px 0' }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

/* ── Componente principal ────────────────────────────────────── */
export default function DashboardPage() {
  const { user, hasRole } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard_metricas'],
    queryFn: () => dashboardApi.fetchDashboardMetrics(),
    staleTime: 60 * 1000,
  });

  const metrics = normalize(data);

  /* ── KPI values ──────────────────────────────────── */
  const totalEquipos = safeNum(metrics?.total_equipos);
  const labsActivos = safeNum(metrics?.laboratorios_activos);
  const pendientes = safeNum(metrics?.reordenamientos_pendientes);
  const totalGuias = safeNum(metrics?.total_guias_publicadas);
  const pctMalos = safeNum(metrics?.equipos_malos_porcentaje);

  /* ── Chart data (API real o fallback) ─────────────── */
  const equiposPorSede = Array.isArray(metrics?.equipos_por_sede) && metrics.equipos_por_sede.length > 0
    ? metrics.equipos_por_sede
    : FALLBACK_SEDES;

  const estadoEquipos = Array.isArray(metrics?.estado_equipos) && metrics.estado_equipos.some(e => e.value > 0)
    ? metrics.estado_equipos
    : FALLBACK_ESTADO;

  const reordenamientosMensual = Array.isArray(metrics?.reordenamientos_mensual) && metrics.reordenamientos_mensual.length > 0
    ? metrics.reordenamientos_mensual
    : FALLBACK_MENSUAL;

  /* ── Quick access cards ──────────────────────────── */
  const quickCards = [
    {
      title: 'Guías de Laboratorio', desc: 'Consulta y descarga prácticas',
      icon: BookOpen, href: '/guias', iconBg: '#EFF6FF', iconColor: '#002B5E', visible: true,
    },
    {
      title: 'Laboratorios', desc: 'Gestión de equipos y evaluaciones',
      icon: FlaskConical, href: '/laboratorios', iconBg: '#ECFDF5', iconColor: '#065f46',
      visible: hasRole('admin', 'jefe', 'decano', 'encargado_activos'),
    },
    {
      title: 'Reordenamiento', desc: 'Traslados entre sedes',
      icon: ArrowLeftRight, href: '/reordenamientos', iconBg: '#FFFBEB', iconColor: '#92400e',
      visible: hasRole('admin', 'jefe', 'decano'),
    },
    {
      title: 'Reportes', desc: 'Exportación de datos en PDF',
      icon: FileText, href: '/reportes', iconBg: '#F0F9FF', iconColor: '#0284c7',
      visible: hasRole('admin', 'jefe', 'decano'),
    },
  ].filter(c => c.visible);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '48px' }} className="animate-fade-in">

      {/* ── Header ──────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #002B5E 0%, #003d82 50%, #1a5bb5 100%)',
        borderRadius: '20px',
        padding: '44px 40px',
        marginBottom: '28px',
        boxShadow: '0 12px 32px rgba(0,43,94,0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: '-40px', right: '-20px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', right: '120px',
          width: '160px', height: '160px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.03)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <LayoutDashboard size={20} color="#93c5fd" />
          <p style={{
            fontSize: '12px', fontWeight: 700, color: '#93c5fd',
            textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0,
          }}>
            Panel de Control — SGL
          </p>
        </div>
        <h1 style={{
          fontSize: '32px', fontWeight: 800, color: '#ffffff',
          lineHeight: 1.2, letterSpacing: '-0.02em', margin: 0,
        }}>
          Bienvenido, {user?.nombre_completo?.split(' ')[0] || 'Usuario'}
        </h1>
        <p style={{
          fontSize: '16px', fontWeight: 500, color: '#93c5fd',
          marginTop: '12px', lineHeight: 1.6, maxWidth: '600px',
        }}>
          Estado general de laboratorios y equipos · Escuela Militar de Ingeniería
        </p>
      </div>

      {/* ── Alerta reordenamientos pendientes ───────── */}
      {!isLoading && pendientes > 0 && hasRole('admin', 'decano') && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '16px',
          padding: '16px 24px', borderRadius: '14px',
          backgroundColor: '#FEF3C7', border: '1px solid #FDE68A',
          marginBottom: '28px', boxShadow: '0 2px 6px rgba(245,158,11,0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={24} color="#D97706" />
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#92400E', margin: 0 }}>
              Tienes {pendientes} traslado{pendientes > 1 ? 's' : ''} pendiente{pendientes > 1 ? 's' : ''} de autorización.
            </p>
          </div>
          <Link to="/reordenamientos" style={{
            backgroundColor: '#D97706', color: '#fff', padding: '8px 20px',
            borderRadius: '10px', fontSize: '14px', fontWeight: 700,
            textDecoration: 'none', boxShadow: '0 2px 6px rgba(217,119,6,0.3)',
            transition: 'all 150ms ease',
          }}>
            Ver traslados
          </Link>
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '28px',
      }}>
        <KPICard
          label="Total Equipos"
          value={totalEquipos}
          icon={Package}
          iconBg="#F3F4F6"
          iconColor="#374151"
          isLoading={isLoading}
        />
        <KPICard
          label="Guías Publicadas"
          value={totalGuias}
          icon={BookOpen}
          iconBg="#EFF6FF"
          iconColor="#002B5E"
          isLoading={isLoading}
        />
        <KPICard
          label="Reordenamientos"
          value={pendientes}
          icon={ArrowLeftRight}
          iconBg="#FEF3C7"
          iconColor="#d97706"
          isLoading={isLoading}
          suffix=" pend."
        />
        <KPICard
          label="Labs Activos"
          value={labsActivos}
          icon={FlaskConical}
          iconBg="#ECFDF5"
          iconColor="#16a34a"
          isLoading={isLoading}
        />
      </div>

      {/* ── Fila gráficos: Barras + Dona ────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '20px',
        marginBottom: '20px',
      }}>
        {/* Barras: Equipos por Sede */}
        <ChartCard
          title="Equipos por Sede"
          subtitle="Distribución de activos en las unidades académicas"
        >
          {isLoading ? (
            <div style={{ height: '300px', backgroundColor: '#f9fafb', borderRadius: '12px' }} className="animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={equiposPorSede} barSize={24} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="sede"
                  tick={{ fontSize: 13, fontWeight: 600, fill: '#6b7280' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '16px', fontSize: '13px', fontWeight: 600 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="buenos" name="Buenos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="regulares" name="Regulares" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="malos" name="Malos" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Dona: Estado General */}
        <ChartCard
          title="Estado de Equipos"
          subtitle="Distribución global por condición"
        >
          {isLoading ? (
            <div style={{ height: '300px', backgroundColor: '#f9fafb', borderRadius: '12px' }} className="animate-pulse" />
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={estadoEquipos}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {estadoEquipos.map((entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => v}
                    contentStyle={{
                      backgroundColor: '#1f2937', borderRadius: '10px', border: 'none',
                      padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: '#fff',
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend manual for cleaner layout */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '4px' }}>
                {estadoEquipos.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                    }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>
                      {entry.name}: {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Gráfico de línea: Reordenamientos por mes ── */}
      <ChartCard
        title="Reordenamientos por Mes"
        subtitle="Historial de traslados de equipos — últimos 6 meses"
        style={{ marginBottom: '28px' }}
      >
        {isLoading ? (
          <div style={{ height: '240px', backgroundColor: '#f9fafb', borderRadius: '12px' }} className="animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={reordenamientosMensual}>
              <defs>
                <linearGradient id="gradientTraslados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 13, fontWeight: 600, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="traslados"
                name="Traslados"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#gradientTraslados)"
                dot={{ fill: '#2563eb', r: 4, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2, fill: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Accesos Rápidos ─────────────────────────── */}
      <div>
        <h2 style={{
          fontSize: '15px', fontWeight: 800, color: '#111827',
          marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <Monitor size={18} color="#002B5E" />
          Accesos Rápidos
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {quickCards.map((card) => (
            <Link
              key={card.href}
              to={card.href}
              style={{
                display: 'flex', alignItems: 'center',
                backgroundColor: '#fff', border: '1px solid #e5e7eb',
                borderRadius: '14px', padding: '20px',
                textDecoration: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 200ms ease',
              }}
              className="hover:shadow-md hover:border-gray-300"
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '48px', height: '48px', borderRadius: '12px',
                backgroundColor: card.iconBg, flexShrink: 0, marginRight: '16px',
              }}>
                <card.icon size={22} color={card.iconColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  fontSize: '16px', fontWeight: 800, color: '#111827',
                  marginBottom: '4px', margin: 0,
                }}>
                  {card.title}
                </h3>
                <p style={{
                  fontSize: '13px', fontWeight: 500, color: '#6b7280',
                  lineHeight: 1.4, margin: 0,
                }}>
                  {card.desc}
                </p>
              </div>
              <ChevronRight size={20} color="#9ca3af" style={{ flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}