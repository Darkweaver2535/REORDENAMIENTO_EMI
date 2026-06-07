// src/pages/DashboardPage.jsx
import { useAuth } from '../store/AuthContext'
import {
  BookOpen, FlaskConical, ArrowLeftRight, ChevronRight,
  FileText, Monitor, AlertCircle, AlertTriangle, Info,
  Package, LayoutDashboard, Tags, PackageX, ShieldAlert,
  Building2, Wrench, CheckCircle2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize = (d) => d?.data ?? d ?? {};
const safeNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const arr = (v) => (Array.isArray(v) ? v : []);
const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

/* ── KPI Card ────────────────────────────────────────────────── */
function KPICard({ label, value, icon: Icon, iconBg, iconColor, isLoading, suffix }) {
  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: '16px', padding: '20px',
      border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', gap: '16px',
    }}>
      <div style={{
        backgroundColor: iconBg, borderRadius: '14px', padding: '13px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={24} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '12px', fontWeight: 700, color: '#6b7280',
          textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px',
        }}>{label}</p>
        {isLoading ? (
          <div style={{ height: '28px', width: '60%', backgroundColor: '#f3f4f6', borderRadius: '8px' }} className="animate-pulse" />
        ) : (
          <p style={{ fontSize: '27px', fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {value ?? '—'}{suffix || ''}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Chart / Section Card ────────────────────────────────────── */
function ChartCard({ title, subtitle, action, children, style = {} }) {
  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '24px', ...style,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
          {subtitle && <p style={{ fontSize: '13px', fontWeight: 500, color: '#9ca3af', margin: '4px 0 0' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: '#1f2937', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ fontSize: '12px', fontWeight: 600, color: e.color, margin: '2px 0' }}>{e.name}: {e.value}</p>
      ))}
    </div>
  );
}

function EmptyState({ text, height = 280 }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14, fontWeight: 500, backgroundColor: '#f9fafb', borderRadius: 12 }}>
      {text}
    </div>
  );
}

/* ── Estilos de tabla ────────────────────────────────────────── */
const th = { textAlign: 'left', padding: '9px 12px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' };
const td = { padding: '9px 12px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #f3f4f6' };

/* Barra de proporción operativo/malo */
function CondBar({ buenos, regulares, malos }) {
  const total = buenos + regulares + malos || 1;
  const seg = (v, color) => v > 0 && (
    <div style={{ width: `${(v / total) * 100}%`, backgroundColor: color, height: '100%' }} title={`${v}`} />
  );
  return (
    <div style={{ display: 'flex', width: '100%', height: '10px', borderRadius: '5px', overflow: 'hidden', backgroundColor: '#f3f4f6' }}>
      {seg(buenos, '#22c55e')}{seg(regulares, '#f59e0b')}{seg(malos, '#ef4444')}
    </div>
  );
}

const ALERT_STYLE = {
  danger: { bg: '#FEF2F2', border: '#FECACA', color: '#b91c1c', icon: ShieldAlert },
  warning: { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', icon: AlertTriangle },
  info: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1e40af', icon: Info },
};

/* ── Componente principal ────────────────────────────────────── */
export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const esGestor = hasRole('admin', 'jefe');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard_metricas'],
    queryFn: () => dashboardApi.fetchDashboardMetrics(),
    staleTime: 60 * 1000,
  });
  const m = normalize(data);

  const totalEquipos = safeNum(m?.total_equipos);
  const operativos = safeNum(m?.equipos_operativos);
  const pctOperativos = safeNum(m?.equipos_operativos_porcentaje);
  const sinAsignar = safeNum(m?.equipos_sin_asignar);
  const labsActivos = safeNum(m?.laboratorios_activos);
  const totalTipos = safeNum(m?.total_tipos_equipo);
  const pendientes = safeNum(m?.reordenamientos_pendientes);
  const totalGuias = safeNum(m?.total_guias_publicadas);
  const mantenimiento = safeNum(m?.equipos_mantenimiento);

  const comparativa = arr(m?.comparativa_unidades);
  const estadoEquipos = arr(m?.estado_equipos).filter(e => safeNum(e.value) >= 0);
  const rankingLabs = arr(m?.ranking_laboratorios_criticos);
  const tiposComunes = arr(m?.tipos_mas_comunes);
  const reordEstado = arr(m?.reordenamientos_por_estado);
  const reordMensual = arr(m?.reordenamientos_mensual);
  const alertas = arr(m?.alertas);

  const hayEstado = estadoEquipos.some(e => safeNum(e.value) > 0);

  const quickCards = [
    { title: 'Guías de Laboratorio', desc: 'Consulta y descarga prácticas', icon: BookOpen, href: '/guias', iconBg: '#EFF6FF', iconColor: '#002B5E', visible: true },
    { title: 'Laboratorios', desc: 'Gestión de equipos y evaluaciones', icon: FlaskConical, href: '/laboratorios', iconBg: '#ECFDF5', iconColor: '#065f46', visible: hasRole('admin', 'jefe', 'encargado_activos') },
    { title: 'Reordenamiento', desc: 'Movimientos entre unidades académicas', icon: ArrowLeftRight, href: '/reordenamientos', iconBg: '#FFFBEB', iconColor: '#92400e', visible: hasRole('admin', 'jefe') },
    { title: 'Reportes', desc: 'Exportación de datos en PDF', icon: FileText, href: '/reportes', iconBg: '#F0F9FF', iconColor: '#0284c7', visible: hasRole('admin', 'jefe') },
  ].filter(c => c.visible);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '48px' }} className="animate-fade-in">
      {/* ── Header ──────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #002B5E 0%, #003d82 50%, #1a5bb5 100%)',
        borderRadius: '20px', padding: '40px', marginBottom: '24px',
        boxShadow: '0 12px 32px rgba(0,43,94,0.35)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-20px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <LayoutDashboard size={20} color="#93c5fd" />
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>
            Panel de Control — SGL
          </p>
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 800, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.02em', margin: 0 }}>
          Bienvenido, {user?.nombre_completo?.split(' ')[0] || 'Usuario'}
        </h1>
        <p style={{ fontSize: '15px', fontWeight: 500, color: '#93c5fd', marginTop: '10px', lineHeight: 1.6, maxWidth: '600px' }}>
          {esGestor
            ? 'Estado de los laboratorios y soporte a decisiones de reordenamiento · EMI'
            : 'Estado general de laboratorios y equipos · Escuela Militar de Ingeniería'}
        </p>
      </div>

      {/* ── Alertas accionables ─────────────────────── */}
      {!isLoading && esGestor && alertas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {alertas.map((a, i) => {
            const s = ALERT_STYLE[a.nivel] || ALERT_STYLE.info;
            const Icon = s.icon;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderRadius: '12px', backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                <Icon size={20} color={s.color} style={{ flexShrink: 0 }} />
                <p style={{ fontSize: '14px', fontWeight: 600, color: s.color, margin: 0 }}>{a.mensaje}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <KPICard label="Total Equipos" value={totalEquipos} icon={Package} iconBg="#F3F4F6" iconColor="#374151" isLoading={isLoading} />
        <KPICard label="Operativos" value={pctOperativos} suffix="%" icon={CheckCircle2} iconBg="#ECFDF5" iconColor="#16a34a" isLoading={isLoading} />
        <KPICard label="Sin Asignar" value={sinAsignar} icon={PackageX} iconBg="#FEF2F2" iconColor="#dc2626" isLoading={isLoading} />
        <KPICard label="Labs Activos" value={labsActivos} icon={FlaskConical} iconBg="#EFF6FF" iconColor="#002B5E" isLoading={isLoading} />
        <KPICard label="Tipos de Equipo" value={totalTipos} icon={Tags} iconBg="#F5F3FF" iconColor="#6d28d9" isLoading={isLoading} />
        <KPICard label="Reordenam." value={pendientes} suffix=" pend." icon={ArrowLeftRight} iconBg="#FFFBEB" iconColor="#d97706" isLoading={isLoading} />
      </div>

      {/* ── Comparativa por unidad (barras apiladas) + Estado (dona) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <ChartCard title="Equipos por Unidad Académica" subtitle="Condición de los activos en cada unidad">
          {isLoading ? <EmptyState text="Cargando…" height={300} /> : comparativa.length === 0 ? (
            <EmptyState text="Sin datos de equipos por unidad" height={300} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparativa} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="sede" tick={{ fontSize: 13, fontWeight: 600, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '13px', fontWeight: 600 }} iconType="circle" iconSize={8} />
                <Bar dataKey="buenos" name="Buenos" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="regulares" name="Regulares" stackId="a" fill="#f59e0b" />
                <Bar dataKey="malos" name="Malos" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Estado de Equipos" subtitle="Distribución global por condición">
          {isLoading ? <EmptyState text="Cargando…" height={240} /> : !hayEstado ? (
            <EmptyState text="Sin datos de condición" height={240} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={estadoEquipos} cx="50%" cy="50%" innerRadius={62} outerRadius={96} paddingAngle={4} dataKey="value" strokeWidth={0}>
                    {estadoEquipos.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderRadius: '10px', border: 'none', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '4px', flexWrap: 'wrap' }}>
                {estadoEquipos.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>{e.name}: {e.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* ── Tabla: Balance por unidad académica (decisión) ── */}
      {esGestor && (
        <ChartCard
          title="Balance por Unidad Académica"
          subtitle="Dónde se concentran los equipos y su estado operativo"
          style={{ marginBottom: '20px' }}
        >
          {isLoading ? <EmptyState text="Cargando…" height={160} /> : comparativa.length === 0 ? (
            <EmptyState text="Sin datos" height={160} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Unidad</th>
                    <th style={{ ...th, textAlign: 'right' }}>Equipos</th>
                    <th style={{ ...th, textAlign: 'right' }}>Labs</th>
                    <th style={{ ...th, width: '180px' }}>Condición</th>
                    <th style={{ ...th, textAlign: 'right' }}>% Operativo</th>
                    <th style={{ ...th, textAlign: 'right' }}>Sin asignar</th>
                    <th style={{ ...th, textAlign: 'right' }}>Ratio eq./est.</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativa.map((c, i) => (
                    <tr key={i}>
                      <td style={{ ...td, fontWeight: 700, color: '#111827' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Building2 size={15} color="#9ca3af" />{c.sede}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{c.total}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{c.labs}</td>
                      <td style={td}><CondBar buenos={c.buenos} regulares={c.regulares} malos={c.malos} /></td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: c.pct_operativo >= 80 ? '#16a34a' : c.pct_operativo >= 50 ? '#d97706' : '#dc2626' }}>
                        {c.pct_operativo}%
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: c.sin_asignar > 0 ? '#dc2626' : '#9ca3af', fontWeight: c.sin_asignar > 0 ? 700 : 400 }}>
                        {c.sin_asignar}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{c.ratio_equipo_estudiante ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      )}

      {/* ── Labs que requieren atención + Tipos más comunes ── */}
      {esGestor && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <ChartCard title="Laboratorios que requieren atención" subtitle="Mayor proporción de equipos en mal estado">
            {isLoading ? <EmptyState text="Cargando…" height={220} /> : rankingLabs.length === 0 ? (
              <EmptyState text="Sin laboratorios con equipos en mal estado" height={220} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Laboratorio</th>
                      <th style={th}>Sede</th>
                      <th style={{ ...th, textAlign: 'right' }}>Malos</th>
                      <th style={{ ...th, textAlign: 'right' }}>% Malos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingLabs.map((r, i) => (
                      <tr key={i}>
                        <td style={{ ...td, fontWeight: 600, color: '#111827' }}>{r.laboratorio}</td>
                        <td style={td}>{r.sede}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{r.malos}/{r.total}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: r.pct_malos >= 50 ? '#dc2626' : r.pct_malos >= 20 ? '#d97706' : '#6b7280' }}>
                          {r.pct_malos}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Tipos de equipo más comunes" subtitle="Top del catálogo por número de unidades">
            {isLoading ? <EmptyState text="Cargando…" height={220} /> : tiposComunes.length === 0 ? (
              <EmptyState text="Catálogo sin clasificar aún" height={220} />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, tiposComunes.length * 26)}>
                <BarChart data={tiposComunes} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Unidades" fill="#6d28d9" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {/* ── Reordenamientos: estado + serie mensual ── */}
      {esGestor && (
        <ChartCard title="Actividad de reordenamientos" subtitle="Estado actual y movimientos de los últimos 6 meses" style={{ marginBottom: '24px' }}>
          {reordEstado.length === 0 && reordMensual.length === 0 ? (
            <EmptyState text="Aún no se han registrado reordenamientos" height={160} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: reordMensual.length > 0 ? '1fr 2fr' : '1fr', gap: '24px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {reordEstado.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>Sin movimientos registrados.</p>
                ) : reordEstado.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{r.label}</span>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#002B5E' }}>{r.total}</span>
                  </div>
                ))}
              </div>
              {reordMensual.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={reordMensual}>
                    <defs>
                      <linearGradient id="gradMov" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 13, fontWeight: 600, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="movimientos" name="Movimientos" stroke="#2563eb" strokeWidth={2.5} fill="url(#gradMov)" dot={{ fill: '#2563eb', r: 4, strokeWidth: 2, stroke: '#fff' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </ChartCard>
      )}

      {/* ── Mantenimiento (chip informativo) ── */}
      {esGestor && !isLoading && mantenimiento > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', borderRadius: '12px', backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', marginBottom: '24px' }}>
          <Wrench size={18} color="#c2410c" />
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#9a3412' }}>
            {mantenimiento} equipo(s) marcados para mantenimiento periódico.
          </span>
        </div>
      )}

      {/* ── Accesos Rápidos ─────────────────────────── */}
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Monitor size={18} color="#002B5E" /> Accesos Rápidos
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {quickCards.map((card) => (
            <Link key={card.href} to={card.href} style={{
              display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #e5e7eb',
              borderRadius: '14px', padding: '18px', textDecoration: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }} className="hover:shadow-md hover:border-gray-300">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '46px', height: '46px', borderRadius: '12px', backgroundColor: card.iconBg, flexShrink: 0, marginRight: '14px' }}>
                <card.icon size={21} color={card.iconColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0 }}>{card.title}</h3>
                <p style={{ fontSize: '12.5px', fontWeight: 500, color: '#6b7280', lineHeight: 1.4, margin: '2px 0 0' }}>{card.desc}</p>
              </div>
              <ChevronRight size={20} color="#9ca3af" style={{ flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
