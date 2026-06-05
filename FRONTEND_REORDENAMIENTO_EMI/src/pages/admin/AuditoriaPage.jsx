import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  ShieldCheck,
  LoaderCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { PageWrapper } from "../../components/layout";
import { fetchAuditoria } from "../../api/usuariosApi";

/* Colores por tipo de acción */
const ACCION_COLOR = {
  LOGIN: "#0066CC",
  CREATE: "#16a34a",
  UPDATE: "#f59e0b",
  DELETE: "#dc2626",
  APPROVE: "#7c3aed",
  MOVE: "#0891b2",
  PUBLISH: "#2563eb",
};

const ACCIONES = ["", "LOGIN", "CREATE", "UPDATE", "DELETE", "APPROVE", "MOVE", "PUBLISH"];

const th = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "12px",
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};
const td = {
  padding: "10px 12px",
  fontSize: "13px",
  color: "#374151",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
};

function Badge({ accion, label }) {
  const color = ACCION_COLOR[accion] || "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
        color,
        backgroundColor: `${color}15`,
        whiteSpace: "nowrap",
      }}
    >
      {label || accion}
    </span>
  );
}

function formatFecha(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("es-BO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuditoriaPage() {
  const [accion, setAccion] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["auditoria", { accion, search, page }],
    queryFn: () =>
      fetchAuditoria({
        ...(accion ? { accion } : {}),
        ...(search ? { search } : {}),
        page,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const payload = data?.data ?? data ?? {};
  const registros = Array.isArray(payload.results) ? payload.results : [];
  const total = payload.count ?? registros.length;
  const hasNext = Boolean(payload.next);
  const hasPrev = Boolean(payload.previous);

  const submitSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <PageWrapper
      title="Auditoría del sistema"
      description="Trazabilidad de logins, movimientos, aprobaciones y cambios de inventario."
    >
      {/* Filtros */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <ShieldCheck size={16} style={{ color: "#003366" }} />
          <select
            value={accion}
            onChange={(e) => {
              setAccion(e.target.value);
              setPage(1);
            }}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "14px",
              backgroundColor: "#fff",
            }}
          >
            {ACCIONES.map((a) => (
              <option key={a} value={a}>
                {a === "" ? "Todas las acciones" : a}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={submitSearch} style={{ display: "flex", gap: "6px", flex: 1, minWidth: "220px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9ca3af",
              }}
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por tabla, usuario o carnet…"
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              backgroundColor: "#003366",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Buscar
          </button>
        </form>

        <span style={{ fontSize: "13px", color: "#6b7280" }}>
          {total} registro{total === 1 ? "" : "s"}
        </span>
      </div>

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
          <span>No se pudo cargar la auditoría: {error?.message || "error desconocido"}</span>
        </div>
      )}

      {!isLoading && !isError && (
        <div
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            overflow: "hidden",
            opacity: isFetching ? 0.6 : 1,
            transition: "opacity 0.15s",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Acción</th>
                  <th style={th}>Tabla</th>
                  <th style={{ ...th, textAlign: "right" }}>Registro</th>
                  <th style={th}>Usuario</th>
                  <th style={th}>IP</th>
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 ? (
                  <tr>
                    <td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={6}>
                      No hay registros para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  registros.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{formatFecha(r.timestamp)}</td>
                      <td style={td}>
                        <Badge accion={r.accion} label={r.accion_display} />
                      </td>
                      <td style={td}>{r.tabla_afectada}</td>
                      <td style={{ ...td, textAlign: "right" }}>#{r.registro_id}</td>
                      <td style={td}>
                        {r.usuario_nombre ? (
                          <div>
                            <div style={{ fontWeight: 600, color: "#111827" }}>{r.usuario_nombre}</div>
                            <div style={{ fontSize: "12px", color: "#9ca3af" }}>{r.usuario_carnet}</div>
                          </div>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>—</span>
                        )}
                      </td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: "12px", color: "#6b7280" }}>
                        {r.ip_address || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderTop: "1px solid #f3f4f6",
            }}
          >
            <span style={{ fontSize: "13px", color: "#6b7280" }}>Página {page}</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!hasPrev}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  backgroundColor: hasPrev ? "#fff" : "#f9fafb",
                  color: hasPrev ? "#374151" : "#d1d5db",
                  fontSize: "13px",
                  cursor: hasPrev ? "pointer" : "not-allowed",
                }}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  backgroundColor: hasNext ? "#fff" : "#f9fafb",
                  color: hasNext ? "#374151" : "#d1d5db",
                  fontSize: "13px",
                  cursor: hasNext ? "pointer" : "not-allowed",
                }}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

export default AuditoriaPage;
