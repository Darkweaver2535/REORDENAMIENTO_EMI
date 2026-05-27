import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    Search, BarChart2, ArrowRightLeft,
    LoaderCircle, AlertCircle, TrendingUp, TrendingDown, Minus,
    Activity, AlertTriangle, Layers, MapPin
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { fetchComparativaSedes } from "../../api/reordenamientoApi";
import { useAuth } from "../../store/AuthContext";
import { ROLES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import { Navigate } from "react-router-dom";

/* ── Helpers Generales ────────────────────────────────────────── */
const normalize = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.sedes ?? p?.data ?? p; };
const safe = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const getUnidadNombre = (s) => s?.sede ?? s?.nombre_sede ?? s?.sede_nombre ?? s?.nombre ?? "Unidad Académica";

/* ── Helpers Comparativa Específica ────────────────────────────── */
const getDisp = (s) => safe(s?.disponibles ?? s?.cantidad_disponible ?? s?.disponible);
const getReq = (s) => safe(s?.requerido ?? s?.cantidad_requerida ?? s?.requeridos);
const getRatio = (s) => { const req = getReq(s); return req > 0 ? getDisp(s) / req : getDisp(s) > 0 ? 2 : 0; };
const getDeficit = (s) => Math.max(getReq(s) - getDisp(s), 0);
const getExcedente = (s) => Math.max(getDisp(s) - getReq(s), 0);

function getRatioConfig(ratio) {
    if (ratio >= 1) return { bar: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d", label: "Suficiente", icon: TrendingUp };
    if (ratio >= 0.6) return { bar: "#f59e0b", bg: "#fffbeb", border: "#fde68a", text: "#92400e", label: "Ajustado", icon: Minus };
    return { bar: "#dc2626", bg: "#fef2f2", border: "#fecaca", text: "#b91c1c", label: "Insuficiente", icon: TrendingDown };
}

/* ── Tarjeta KPI ───────────────────────────────────────────────── */
function KpiCard({ title, value, icon: Icon, color }) {
    return (
        <div style={{
            backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px",
            padding: "20px", display: "flex", alignItems: "center", gap: "16px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
        }}>
            <div style={{
                width: "48px", height: "48px", borderRadius: "12px",
                backgroundColor: `${color}15`, color: color,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
                <Icon size={24} />
            </div>
            <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                    {title}
                </p>
                <p style={{ fontSize: "28px", fontWeight: 800, color: "#111827", lineHeight: 1 }}>
                    {value}
                </p>
            </div>
        </div>
    );
}

/* ── Componente: Panorama Nacional ─────────────────────────────── */
const COLORS = ['#002B5E', '#1D4ED8', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'];

function PanoramaNacional({ data, navigate }) {
    const kpis = data?.kpis || {};
    const distribucion = data?.distribucion_sedes || [];
    const oportunidades = data?.oportunidades || [];

    // KPI 2: Sedes con mayor déficit
    const topSedeDeficit = data?.top_sedes_deficit?.[0] ? `${data.top_sedes_deficit[0].sede} (-${data.top_sedes_deficit[0].deficit})` : "Sin déficit";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {/* Header */}
            <div>
                <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#111827" }}>Panorama Nacional</h2>
                <p style={{ fontSize: "14px", color: "#6b7280" }}>Resumen global de inventario y oportunidades de optimización.</p>
            </div>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
                <KpiCard 
                    title="Equipos en estado Malo/Regular" 
                    value={`${kpis.porcentaje_malo_regular ?? 0}%`} 
                    icon={Activity} 
                    color="#dc2626" 
                />
                <KpiCard 
                    title="Sede c/ mayor déficit" 
                    value={topSedeDeficit} 
                    icon={AlertTriangle} 
                    color="#f59e0b" 
                />
                <KpiCard 
                    title="Equipos reasignables hoy" 
                    value={kpis.total_reasignable ?? 0} 
                    icon={Layers} 
                    color="#16a34a" 
                />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", alignItems: "start" }}>
                {/* Gráfico Dona */}
                <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#374151", marginBottom: "16px" }}>Distribución del Inventario por Sede</h3>
                    {distribucion.length > 0 ? (
                        <div style={{ height: "350px", width: "100%" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={distribucion} dataKey="cantidad" nameKey="sede" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2}>
                                        {distribucion.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(value) => [`${value} equipos`, 'Total']} />
                                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p style={{ textAlign: "center", color: "#9ca3af", paddingTop: "40px" }}>No hay datos suficientes.</p>
                    )}
                </div>

                {/* Tabla Oportunidades */}
                <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#374151", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                        Top 5 Oportunidades de Reordenamiento
                    </h3>
                    {oportunidades.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {oportunidades.map((op, i) => (
                                <div key={i} style={{ padding: "14px", borderRadius: "10px", backgroundColor: "#f9fafb", border: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>{op.equipo}</p>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#6b7280" }}>
                                            <span style={{ color: "#16a34a", fontWeight: 600 }}>{op.origen}</span>
                                            <ArrowRightLeft size={12} color="#d1d5db" />
                                            <span style={{ color: "#dc2626", fontWeight: 600 }}>{op.destino}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                        <span style={{ fontSize: "16px", fontWeight: 800, color: "#002B5E" }}>{op.cantidad_sugerida}</span>
                                        <span style={{ fontSize: "10px", color: "#9ca3af", textTransform: "uppercase" }}>Unidades</span>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => navigate("/reordenamientos/nuevo")}
                                style={{ marginTop: "12px", padding: "12px", width: "100%", borderRadius: "8px", border: "1px solid #002B5E", backgroundColor: "#fff", color: "#002B5E", fontWeight: 700, cursor: "pointer", fontSize: "13px", transition: "all 200ms ease" }}
                                className="hover:bg-blue-50"
                            >
                                Iniciar Reordenamiento
                            </button>
                        </div>
                    ) : (
                        <div style={{ padding: "40px 20px", textAlign: "center" }}>
                            <TrendingUp size={32} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
                            <p style={{ fontSize: "14px", color: "#6b7280", fontWeight: 500 }}>No hay oportunidades de reordenamiento evidentes en este momento.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Componente: SedeCard (Específica) ─────────────────────────── */
function SedeCard({ sede, maxDisp, maxReq }) {
    const ratio = getRatio(sede);
    const disponibles = getDisp(sede);
    const requerido = getReq(sede);
    const deficit = getDeficit(sede);
    const excedente = getExcedente(sede);
    const config = getRatioConfig(ratio);
    const Icon = config.icon;

    const barWidth = maxDisp > 0 ? Math.min((disponibles / maxDisp) * 100, 100) : 0;
    const reqWidth = maxDisp > 0 ? Math.min((requerido / maxDisp) * 100, 100) : 0;

    return (
        <div style={{ backgroundColor: "#fff", border: `1px solid ${config.border}`, borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "box-shadow 200ms ease" }} className="hover:shadow-md">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                    <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>{getUnidadNombre(sede)}</h3>
                    {sede?.laboratorio && <p style={{ fontSize: "13px", color: "#9ca3af", fontWeight: 500, marginTop: "3px" }}>{sede.laboratorio}</p>}
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "8px", backgroundColor: config.bg, border: `1px solid ${config.border}`, color: config.text, fontSize: "12px", fontWeight: 700 }}>
                    <Icon size={13} />{config.label}
                </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Disponibles</p>
                    <p style={{ fontSize: "26px", fontWeight: 800, color: config.bar, lineHeight: 1 }}>{disponibles}</p>
                </div>
                <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Requeridos</p>
                    <p style={{ fontSize: "26px", fontWeight: 800, color: "#374151", lineHeight: 1 }}>{requerido}</p>
                </div>
                <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>{deficit > 0 ? "Déficit" : "Excedente"}</p>
                    <p style={{ fontSize: "26px", fontWeight: 800, lineHeight: 1, color: deficit > 0 ? "#dc2626" : "#16a34a" }}>{deficit > 0 ? `−${deficit}` : excedente > 0 ? `+${excedente}` : "="}</p>
                </div>
            </div>

            <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>Disponibles vs Requeridos</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>{requerido > 0 ? `${Math.round(ratio * 100)}%` : "—"}</span>
                </div>
                <div style={{ position: "relative", height: "12px", borderRadius: "8px", backgroundColor: "#f3f4f6", overflow: "hidden" }}>
                    {requerido > 0 && <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${reqWidth}%`, backgroundColor: "#e5e7eb", borderRadius: "8px" }} />}
                    <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${barWidth}%`, backgroundColor: config.bar, borderRadius: "8px", transition: "width 600ms ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px" }}>
                    <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>0</span>
                    <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>Max: {Math.max(disponibles, requerido, maxDisp)}</span>
                </div>
            </div>
        </div>
    );
}

/* ── Componente Principal ──────────────────────────────────────── */
export default function ComparativaSedesPage() {
    const navigate = useNavigate();
    const { hasRole } = useAuth();
    const inputRef = useRef(null);

    if (!hasRole(ROLES.ADMIN, ROLES.JEFE)) {
        return <Navigate to="/dashboard" replace />;
    }

    const [query, setQuery] = useState("");
    const [searchTerm, setSearchTerm] = useState(""); 

    const { data, isLoading, isFetching, isError, error } = useQuery({
        queryKey: ["comparativa-sedes", searchTerm],
        queryFn: () => fetchComparativaSedes(searchTerm),
        staleTime: 30 * 1000,
    });

    const isGeneralView = !searchTerm;
    const sedes = useMemo(() => isGeneralView ? [] : normalize(data), [data, isGeneralView]);
    const maxDisp = useMemo(() => Math.max(...sedes.map(getDisp), 1), [sedes]);
    const maxReq = useMemo(() => Math.max(...sedes.map(getReq), 1), [sedes]);

    const bestOrigen = useMemo(() => sedes.reduce((best, s) => getExcedente(s) > getExcedente(best ?? {}) ? s : best, null), [sedes]);
    const bestDestino = useMemo(() => sedes.reduce((best, s) => getDeficit(s) > getDeficit(best ?? {}) ? s : best, null), [sedes]);

    const handleSearch = () => {
        setSearchTerm(query.trim());
    };

    const handleClear = () => {
        setQuery("");
        setSearchTerm("");
    };

    const loading = isLoading || isFetching;

    return (
        <PageWrapper
            title="Comparativa y Reordenamiento"
            description="Analiza la disponibilidad de equipos y detecta oportunidades de traslado entre unidades académicas."
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

                {/* Buscador */}
                <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "24px 28px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <label htmlFor="search-equipo" style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "10px" }}>
                        Buscar un equipo específico
                    </label>
                    <div style={{ display: "flex", gap: "12px", alignItems: "stretch" }}>
                        <div style={{ position: "relative", flex: 1 }}>
                            <Search size={18} color="#9ca3af" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                            <input
                                id="search-equipo"
                                ref={inputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                                placeholder='Ej: "Balanza analítica", "Microscopio"...'
                                style={{ width: "100%", height: "48px", borderRadius: "10px", border: "1px solid #d1d5db", backgroundColor: "#fff", paddingLeft: "46px", paddingRight: "16px", fontSize: "16px", fontWeight: 500, color: "#111827", outline: "none" }}
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "48px", padding: "0 24px", borderRadius: "10px", backgroundColor: "#002B5E", color: "#fff", fontSize: "15px", fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 6px rgba(0,43,94,0.25)", transition: "all 200ms ease", flexShrink: 0 }}
                        >
                            {loading ? <><LoaderCircle size={17} className="animate-spin" />Buscando...</> : <><Search size={17} />Buscar</>}
                        </button>
                    </div>
                    {searchTerm && (
                        <p style={{ marginTop: "10px", fontSize: "13px", color: "#9ca3af", fontWeight: 500 }}>
                            Mostrando comparativa para: <strong style={{ color: "#374151" }}>"{searchTerm}"</strong> {" · "}
                            <button onClick={handleClear} style={{ background: "none", border: "none", color: "#002B5E", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
                                Volver al panorama nacional
                            </button>
                        </p>
                    )}
                </div>

                {isError && (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderRadius: "12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
                        <AlertCircle size={20} color="#ef4444" />
                        <p style={{ fontSize: "15px", fontWeight: 600, color: "#b91c1c" }}>{error?.response?.data?.detail ?? "Error al cargar los datos."}</p>
                    </div>
                )}

                {/* SKELETONS */}
                {loading && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
                        {[1, 2, 3].map((i) => (
                            <div key={i} style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "24px", height: "200px" }} className="animate-pulse" />
                        ))}
                    </div>
                )}

                {/* PANORAMA NACIONAL (Si no hay busqueda y terminó de cargar) */}
                {isGeneralView && !loading && !isError && (
                    <PanoramaNacional data={normalize(data)} navigate={navigate} />
                )}

                {/* COMPARATIVA ESPECÍFICA (Si hay busqueda y terminó de cargar) */}
                {!isGeneralView && !loading && !isError && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <div>
                            <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#111827" }}>Comparativa: {searchTerm}</h2>
                            <p style={{ fontSize: "14px", color: "#6b7280" }}>Disponibilidad específica por unidad académica.</p>
                        </div>

                        {sedes.length === 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 32px", backgroundColor: "#fff", border: "2px dashed #e5e7eb", borderRadius: "14px", textAlign: "center" }}>
                                <Search size={40} color="#d1d5db" style={{ marginBottom: "12px" }} />
                                <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>Sin resultados</h3>
                                <p style={{ fontSize: "15px", color: "#9ca3af" }}>No se encontraron equipos que coincidan.</p>
                            </div>
                        ) : (
                            <>
                                {bestOrigen && bestDestino && getUnidadNombre(bestOrigen) !== getUnidadNombre(bestDestino) && (
                                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "20px 24px", borderRadius: "14px", backgroundColor: "#EFF6FF", border: "1px solid #dbeafe", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                                        <div>
                                            <p style={{ fontSize: "13px", fontWeight: 700, color: "#002B5E", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>💡 Oportunidad detectada</p>
                                            <p style={{ fontSize: "15px", fontWeight: 500, color: "#374151", lineHeight: 1.5 }}>
                                                Trasladar <strong style={{ color: "#002B5E" }}>{Math.min(getExcedente(bestOrigen), getDeficit(bestDestino))} unidad(es)</strong> desde <strong>{getUnidadNombre(bestOrigen)}</strong> hacia <strong>{getUnidadNombre(bestDestino)}</strong>
                                            </p>
                                        </div>
                                        <button onClick={() => navigate("/reordenamientos/nuevo")} style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "44px", padding: "0 20px", borderRadius: "10px", backgroundColor: "#002B5E", color: "#fff", fontSize: "14px", fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,43,94,0.25)", flexShrink: 0 }}>
                                            <ArrowRightLeft size={16} /> Crear reordenamiento
                                        </button>
                                    </div>
                                )}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
                                    {sedes.map((sede, i) => (
                                        <SedeCard key={getUnidadNombre(sede) + i} sede={sede} maxDisp={maxDisp} maxReq={maxReq} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </PageWrapper>
    );
}
