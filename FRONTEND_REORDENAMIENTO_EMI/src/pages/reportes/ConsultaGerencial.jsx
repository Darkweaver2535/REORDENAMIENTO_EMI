import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles, Send, LoaderCircle, AlertCircle, Building2, Cpu, Database, Lightbulb,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import axiosClient from "../../api/axiosClient";
import { API_ROUTES } from "../../constants/api";

const EJEMPLOS = [
  "¿Cuántos microscopios hay a nivel nacional y cómo están distribuidos?",
  "¿Qué unidad académica tiene más balanzas?",
  "¿Cómo está distribuido el inventario por unidad académica?",
  "¿Cuántos equipos en mal estado hay y dónde se concentran?",
];

const COLORS = ["#002B5E", "#0066CC", "#16a34a", "#f59e0b", "#8b5cf6", "#ec4899"];

/* Render mínimo de la respuesta del modelo (negritas **x** y viñetas) */
function renderRespuesta(texto) {
  const lineas = (texto || "").split("\n");
  return lineas.map((linea, i) => {
    const esVineta = /^\s*[*-]\s+/.test(linea);
    const contenido = linea.replace(/^\s*[*-]\s+/, "");
    const partes = contenido.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, j) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={j} style={{ color: "#111827" }}>{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>
    );
    if (!contenido.trim()) return <div key={i} style={{ height: 8 }} />;
    return (
      <p key={i} style={{ margin: "4px 0", paddingLeft: esVineta ? 18 : 0, position: "relative", lineHeight: 1.6, fontSize: 15, color: "#374151" }}>
        {esVineta && <span style={{ position: "absolute", left: 4, color: "#0066CC", fontWeight: 800 }}>•</span>}
        {partes}
      </p>
    );
  });
}

export default function ConsultaGerencial() {
  const [pregunta, setPregunta] = useState("");
  const [resultado, setResultado] = useState(null);

  const mutation = useMutation({
    mutationFn: (q) => axiosClient.post(API_ROUTES.REPORTES.CONSULTA_GERENCIAL, { pregunta: q }),
    onSuccess: (resp) => setResultado(resp?.data ?? resp),
    onError: () => setResultado(null),
  });

  const enviar = (q) => {
    const texto = (q ?? pregunta).trim();
    if (!texto || mutation.isPending) return;
    setPregunta(texto);
    mutation.mutate(texto);
  };

  const datos = resultado?.datos ?? {};
  const detalle = Array.isArray(datos?.detalle_por_tipo) ? datos.detalle_por_tipo : [];
  const resumen = datos?.resumen_nacional ?? {};
  const porSedeGlobal = Array.isArray(resumen?.por_sede) ? resumen.por_sede : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "20px 24px", borderRadius: 16, background: "linear-gradient(135deg, #002B5E 0%, #1a5bb5 100%)", color: "#fff" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Sparkles size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Consultas Gerenciales</h2>
          <p style={{ fontSize: 13.5, color: "#bfdbfe", margin: "4px 0 0", lineHeight: 1.5 }}>
            Pregunta en lenguaje natural sobre el inventario a nivel nacional. Las respuestas se
            generan con IA local sobre los datos reales del sistema.
          </p>
        </div>
      </div>

      {/* Caja de pregunta */}
      <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <textarea
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder="Ej: ¿Cuántos microscopios hay a nivel nacional y cómo están distribuidos?"
              rows={2}
              style={{ width: "100%", resize: "vertical", border: "1px solid #d1d5db", borderRadius: 10, padding: "12px 14px", fontSize: 15, fontFamily: "inherit", color: "#111827", outline: "none", lineHeight: 1.5 }}
            />
          </div>
          <button
            onClick={() => enviar()}
            disabled={mutation.isPending || !pregunta.trim()}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 48, padding: "0 22px", borderRadius: 10, border: "none", backgroundColor: (mutation.isPending || !pregunta.trim()) ? "#9ca3af" : "#002B5E", color: "#fff", fontSize: 15, fontWeight: 700, cursor: (mutation.isPending || !pregunta.trim()) ? "not-allowed" : "pointer", flexShrink: 0 }}
          >
            {mutation.isPending ? <><LoaderCircle size={17} className="animate-spin" />Analizando…</> : <><Send size={16} />Consultar</>}
          </button>
        </div>

        {/* Ejemplos */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "#9ca3af" }}>
            <Lightbulb size={14} /> Ejemplos:
          </span>
          {EJEMPLOS.map((ej, i) => (
            <button key={i} onClick={() => enviar(ej)} disabled={mutation.isPending}
              style={{ fontSize: 12.5, fontWeight: 600, color: "#1d4ed8", backgroundColor: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 999, padding: "5px 12px", cursor: mutation.isPending ? "not-allowed" : "pointer" }}>
              {ej}
            </button>
          ))}
        </div>
      </div>

      {/* Estado de carga */}
      {mutation.isPending && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 48, backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 16 }}>
          <LoaderCircle size={32} className="animate-spin" style={{ color: "#002B5E" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", margin: 0 }}>Analizando los datos con IA local…</p>
          <p style={{ fontSize: 12.5, color: "#9ca3af", margin: 0 }}>Esto puede tardar unos segundos.</p>
        </div>
      )}

      {/* Error */}
      {mutation.isError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 12, padding: 16 }}>
          <AlertCircle size={20} />
          <span>No se pudo completar la consulta. Verifica que el servicio de IA esté disponible.</span>
        </div>
      )}

      {/* Resultado */}
      {!mutation.isPending && resultado && (
        <>
          {/* Respuesta */}
          <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Sparkles size={18} style={{ color: "#002B5E" }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>Respuesta</h3>
              {!resultado.conversacional && (
                <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: resultado.ia_disponible ? "#16a34a" : "#d97706", backgroundColor: resultado.ia_disponible ? "#f0fdf4" : "#fffbeb", border: `1px solid ${resultado.ia_disponible ? "#bbf7d0" : "#fde68a"}`, borderRadius: 999, padding: "3px 10px" }}>
                  {resultado.ia_disponible ? <Cpu size={12} /> : <Database size={12} />}
                  {resultado.ia_disponible ? `IA local (${resultado.modelo})` : "Resumen de datos (IA no disponible)"}
                </span>
              )}
            </div>
            <div>{renderRespuesta(resultado.respuesta)}</div>
          </div>

          {/* Datos de respaldo por tipo */}
          {detalle.map((d, idx) => (
            <div key={idx} style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>
                {d.tipo} · {d.total_nacional} unidad(es) a nivel nacional
              </h3>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 16px" }}>
                Buenos: {d.condicion.buenos} · Regulares: {d.condicion.regulares} · Malos: {d.condicion.malos}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Gráfico por sede */}
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 8px" }}>Distribución por unidad</p>
                  {d.distribucion_por_sede.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#9ca3af" }}>Sin datos.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(140, d.distribucion_por_sede.length * 40)}>
                      <BarChart data={d.distribucion_por_sede} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                        <XAxis type="number" tick={{ fontSize: 12, fill: "#9ca3af" }} allowDecimals={false} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="sede" width={70} tick={{ fontSize: 12, fill: "#374151", fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="total" name="Unidades" radius={[0, 5, 5, 0]} barSize={20}>
                          {d.distribucion_por_sede.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {/* Tabla por laboratorio */}
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 8px" }}>Top laboratorios</p>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {d.distribucion_por_laboratorio.map((l, i) => (
                        <tr key={i}>
                          <td style={{ padding: "6px 8px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6" }}>{l.laboratorio}</td>
                          <td style={{ padding: "6px 8px", fontSize: 12, color: "#9ca3af", borderBottom: "1px solid #f3f4f6" }}>{l.sede}</td>
                          <td style={{ padding: "6px 8px", fontSize: 13, fontWeight: 700, textAlign: "right", color: "#111827", borderBottom: "1px solid #f3f4f6" }}>{l.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}

          {/* Resumen nacional (si no hubo tipo específico) */}
          {detalle.length === 0 && porSedeGlobal.length > 0 && (
            <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: "0 0 16px" }}>
                Inventario nacional · {resumen.total_equipos_nacional} equipos
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px", fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>Unidad</th>
                    <th style={{ textAlign: "right", padding: "8px", fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>Total</th>
                    <th style={{ textAlign: "right", padding: "8px", fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>Buenos</th>
                    <th style={{ textAlign: "right", padding: "8px", fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>Regulares</th>
                    <th style={{ textAlign: "right", padding: "8px", fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>Malos</th>
                  </tr>
                </thead>
                <tbody>
                  {porSedeGlobal.map((s, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px", fontSize: 13.5, fontWeight: 600, color: "#111827", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 6 }}>
                        <Building2 size={14} color="#9ca3af" />{s.sede}
                      </td>
                      <td style={{ padding: "8px", fontSize: 13.5, fontWeight: 700, textAlign: "right", borderBottom: "1px solid #f3f4f6" }}>{s.total}</td>
                      <td style={{ padding: "8px", fontSize: 13.5, textAlign: "right", color: "#16a34a", borderBottom: "1px solid #f3f4f6" }}>{s.buenos}</td>
                      <td style={{ padding: "8px", fontSize: 13.5, textAlign: "right", color: "#d97706", borderBottom: "1px solid #f3f4f6" }}>{s.regulares}</td>
                      <td style={{ padding: "8px", fontSize: 13.5, textAlign: "right", color: "#dc2626", borderBottom: "1px solid #f3f4f6" }}>{s.malos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
