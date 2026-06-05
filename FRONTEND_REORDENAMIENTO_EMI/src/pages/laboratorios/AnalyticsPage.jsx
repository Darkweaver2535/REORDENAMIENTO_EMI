import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  LoaderCircle,
  AlertCircle,
  TrendingDown,
  PackageX,
  Gauge,
  Moon,
  CheckCircle2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PageWrapper } from "../../components/layout";
import { fetchLaboratorioAnalytics } from "../../api/laboratoriosApi";

const safe = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ── Tarjeta KPI ──────────────────────────────────────────────────────────── */
function KpiCard({ title, value, subtitle, icon: Icon, color }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          backgroundColor: `${color}15`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={24} />
      </div>
      <div>
        <p
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "4px",
          }}
        >
          {title}
        </p>
        <p style={{ fontSize: "28px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>
          {value}
        </p>
        {subtitle && (
          <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/* ── Contenedor de sección ────────────────────────────────────────────────── */
function Section({ title, icon: Icon, children }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "20px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        {Icon && <Icon size={18} style={{ color: "#003366" }} />}
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

const th = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  borderBottom: "1px solid #e5e7eb",
};
const td = { padding: "8px 12px", fontSize: "14px", color: "#374151", borderBottom: "1px solid #f3f4f6" };

function EmptyHint({ text }) {
  return (
    <p style={{ fontSize: "14px", color: "#9ca3af", padding: "12px 0", textAlign: "center" }}>
      {text}
    </p>
  );
}

function AnalyticsPage() {
  const { id } = useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["laboratorio-analytics", id],
    queryFn: () => fetchLaboratorioAnalytics(id),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const payload = data?.data ?? data ?? {};
  const deficits = Array.isArray(payload.deficits) ? payload.deficits : [];
  const excedentes = Array.isArray(payload.excedentes) ? payload.excedentes : [];
  const usoEquipos = Array.isArray(payload.uso_equipos) ? payload.uso_equipos : [];
  const ratio = payload.ratio ?? {};

  const conDeficit = deficits.filter((d) => d.tiene_deficit || safe(d.deficit) > 0);
  const ociosos = usoEquipos.filter((u) => u.es_ocioso || safe(u.pct_uso) === 0);

  const usoChart = [...usoEquipos]
    .sort((a, b) => safe(b.pct_uso) - safe(a.pct_uso))
    .slice(0, 12)
    .map((u) => ({ nombre: u.nombre, pct: safe(u.pct_uso) }));

  return (
    <PageWrapper
      title="Analytics de laboratorio"
      description={ratio.nombre ? `Indicadores de ${ratio.nombre}` : `Indicadores del laboratorio #${id}`}
    >
      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "64px" }}>
          <LoaderCircle size={32} className="animate-spin" style={{ color: "#003366" }} />
        </div>
      )}

      {isError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            borderRadius: "12px",
            padding: "16px",
          }}
        >
          <AlertCircle size={20} />
          <span>No se pudo cargar la analítica: {error?.message || "error desconocido"}</span>
        </div>
      )}

      {!isLoading && !isError && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* KPIs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <KpiCard
              title="Ratio equipo/estudiante"
              value={safe(ratio.ratio_equipo_por_estudiante).toFixed(2)}
              subtitle={`${safe(ratio.total_equipos_disponibles)} equipos · cap. ${safe(ratio.capacidad_estudiantes)}`}
              icon={Gauge}
              color="#0066CC"
            />
            <KpiCard
              title="Equipos con déficit"
              value={conDeficit.length}
              subtitle={`de ${deficits.length} requeridos`}
              icon={TrendingDown}
              color="#dc2626"
            />
            <KpiCard
              title="Excedentes"
              value={excedentes.length}
              subtitle="equipos sobredimensionados"
              icon={PackageX}
              color="#f59e0b"
            />
            <KpiCard
              title="Equipos ociosos"
              value={ociosos.length}
              subtitle="sin uso en prácticas"
              icon={Moon}
              color="#6b7280"
            />
          </div>

          {/* Déficit */}
          <Section title="Déficit de equipamiento" icon={TrendingDown}>
            {deficits.length === 0 ? (
              <EmptyHint text="No hay equipos requeridos registrados para este laboratorio." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Equipo</th>
                      <th style={{ ...th, textAlign: "right" }}>Disponible</th>
                      <th style={{ ...th, textAlign: "right" }}>Requerido</th>
                      <th style={{ ...th, textAlign: "right" }}>Déficit</th>
                      <th style={{ ...th, textAlign: "center" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deficits.map((d, i) => {
                      const tiene = d.tiene_deficit || safe(d.deficit) > 0;
                      return (
                        <tr key={i}>
                          <td style={td}>{d.nombre_equipo}</td>
                          <td style={{ ...td, textAlign: "right" }}>{safe(d.cantidad_disponible)}</td>
                          <td style={{ ...td, textAlign: "right" }}>{safe(d.cantidad_requerida)}</td>
                          <td
                            style={{
                              ...td,
                              textAlign: "right",
                              fontWeight: 700,
                              color: tiene ? "#b91c1c" : "#15803d",
                            }}
                          >
                            {safe(d.deficit)}
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            {tiene ? (
                              <span style={{ color: "#b91c1c", fontWeight: 600, fontSize: "12px" }}>
                                Déficit
                              </span>
                            ) : (
                              <CheckCircle2 size={16} style={{ color: "#16a34a", display: "inline" }} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Uso de equipos */}
          <Section title="Uso de equipos (% de prácticas que lo requieren)" icon={BarChart2}>
            {usoChart.length === 0 ? (
              <EmptyHint text="Sin datos de uso para este laboratorio." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, usoChart.length * 34)}>
                <BarChart data={usoChart} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={12} />
                  <YAxis type="category" dataKey="nombre" width={160} fontSize={11} />
                  <Tooltip formatter={(v) => [`${v}%`, "Uso"]} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                    {usoChart.map((u, i) => (
                      <Cell key={i} fill={u.pct === 0 ? "#d1d5db" : u.pct < 25 ? "#f59e0b" : "#0066CC"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* Excedentes */}
          <Section title="Excedentes / equipos sobredimensionados" icon={PackageX}>
            {excedentes.length === 0 ? (
              <EmptyHint text="No se detectaron excedentes en este laboratorio." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Equipo</th>
                      <th style={{ ...th, textAlign: "right" }}>Disponible</th>
                      <th style={{ ...th, textAlign: "right" }}>Máx. requerido</th>
                      <th style={{ ...th, textAlign: "right" }}>Excedente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excedentes.map((e, i) => (
                      <tr key={i}>
                        <td style={td}>{e.nombre}</td>
                        <td style={{ ...td, textAlign: "right" }}>{safe(e.cantidad_disponible)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{safe(e.max_requerido)}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#b45309" }}>
                          {safe(e.excedente)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}
    </PageWrapper>
  );
}

export default AnalyticsPage;
