// src/pages/reordenamiento/ReordenamientoListPage.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, ArrowLeftRight, CheckCircle, PlayCircle, LoaderCircle,
  AlertCircle, Paperclip, PackageCheck, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../store/AuthContext";
import {
  fetchReordenamientos,
  autorizarReordenamiento,
  aprobarReordenamiento,
  ejecutarReordenamiento,
  recepcinarReordenamiento,
} from "../../api/reordenamientoApi";
import { ROLES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import { Navigate } from "react-router-dom";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize    = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.data ?? []; };
const getId        = (r) => r?.id ?? r?.uuid;
const getEstado    = (r) => String(r?.estado ?? "").toLowerCase();
const getEquipo    = (r) => r?.equipo_nombre ?? r?.equipo?.nombre ?? r?.nombre_equipo ?? "—";
const getOrigen    = (r) => r?.laboratorio_origen_nombre ?? r?.laboratorio_origen?.nombre ?? (getTipo(r) === "COMPRA" ? "Compra" : "—");
const getDestino   = (r) => r?.laboratorio_destino_nombre ?? r?.laboratorio_destino?.nombre ?? "—";
const getCantidad  = (r) => r?.cantidad_trasladada ?? r?.cantidad ?? "—";
const getTipo      = (r) => r?.tipo_movimiento ?? "";
const getDoc       = (r) => r?.numero_documento || r?.resolucion_numero || "—";
const tieneDoc     = (r) => Boolean(r?.tiene_documento);

const getFecha = (r) => {
  const d = r?.fecha_creacion ?? r?.created_at ?? r?.fecha;
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
};

/* ── Badge de Estado ─────────────────────────────────────────── */
const ESTADO_CONFIG = {
  borrador:             { label: "Borrador",               bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
  pendiente:            { label: "Pendiente",              bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  pendiente_aprobacion: { label: "Pendiente aprobación",  bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  aprobado:             { label: "Aprobado",               bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  autorizado:           { label: "Aprobado (legacy)",      bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  rechazado:            { label: "Rechazado",              bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  en_transito:          { label: "En tránsito",            bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  ejecutado:            { label: "En tránsito (legacy)",   bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  recepcionado:         { label: "Recepcionado",           bg: "#f0fdf4", color: "#065f46", border: "#6ee7b7" },
  cancelado:            { label: "Cancelado",              bg: "#fef2f2", color: "#9ca3af", border: "#e5e7eb" },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, bg: "#f9fafb", color: "#374151", border: "#e5e7eb" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "4px 10px", borderRadius: "9999px",
      backgroundColor: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

/* ── Badge de Tipo ────────────────────────────────────────────── */
const TIPO_CONFIG = {
  REASIGNACION_DEFINITIVA: { label: "Reasignación", bg: "#eff6ff", color: "#1d4ed8" },
  PRESTAMO:                { label: "Préstamo",      bg: "#f0fdf4", color: "#15803d" },
  COMPRA:                  { label: "Compra",        bg: "#f5f3ff", color: "#7c3aed" },
};

function TipoBadge({ tipo }) {
  const cfg = TIPO_CONFIG[tipo] ?? { label: tipo || "—", bg: "#f9fafb", color: "#374151" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "4px 10px", borderRadius: "8px",
      backgroundColor: cfg.bg, color: cfg.color,
      fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

/* ── Modal simple de confirmación ────────────────────────────── */
function RecepcinarModal({ reordenamiento, onConfirm, onCancel, isPending }) {
  const [observaciones, setObservaciones] = useState("");
  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: "#fff", borderRadius: "16px", padding: "32px",
        maxWidth: "480px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <PackageCheck size={24} color="#065f46" />
          <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#111827" }}>Confirmar Recepción</h3>
        </div>
        <p style={{ fontSize: "14px", color: "#374151", marginBottom: "20px", lineHeight: 1.5 }}>
          ¿Confirmas que el equipo <strong>{getEquipo(reordenamiento)}</strong> fue recibido correctamente en <strong>{getDestino(reordenamiento)}</strong>?
        </p>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontSize: "13px", fontWeight: 700, color: "#374151", display: "block", marginBottom: "8px" }}>
            Observaciones (opcional)
          </label>
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas sobre el estado del equipo al recibir..."
            style={{ width: "100%", borderRadius: "8px", border: "1px solid #d1d5db", padding: "10px 14px", fontSize: "14px", outline: "none", resize: "vertical" }}
          />
        </div>
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={isPending}
            style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #e5e7eb", backgroundColor: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(observaciones)}
            disabled={isPending}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "10px 20px", borderRadius: "8px", border: "none",
              backgroundColor: "#065f46", color: "#fff",
              fontSize: "14px", fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <PackageCheck size={14} />}
            Confirmar recepción
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Botón de acción ─────────────────────────────────────────── */
function ActionButton({ reordenamiento, onAutorizar, onEjecutar, onRecepcinar, isPending, pendingId }) {
  const { hasRole } = useAuth();
  const estado = getEstado(reordenamiento);
  const id     = getId(reordenamiento);
  const loading = isPending && pendingId === id;

  const btnBase = {
    display: "inline-flex", alignItems: "center", gap: "6px",
    padding: "7px 14px", borderRadius: "8px",
    fontSize: "13px", fontWeight: 700, border: "none",
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.6 : 1, whiteSpace: "nowrap",
  };

  if (["pendiente_aprobacion", "pendiente"].includes(estado) && hasRole(ROLES.ADMIN)) {
    return (
      <button onClick={() => onAutorizar(id)} disabled={loading} style={{ ...btnBase, backgroundColor: "#004F9F", color: "#fff", boxShadow: "0 2px 4px rgba(0, 79, 159,0.25)" }}>
        {loading ? <LoaderCircle size={13} className="animate-spin" /> : <CheckCircle size={13} />}
        Aprobar
      </button>
    );
  }

  if (["aprobado", "autorizado"].includes(estado) && hasRole(ROLES.ADMIN, ROLES.ENCARGADO_ACTIVOS)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <button onClick={() => onEjecutar(id)} disabled={loading} style={{ ...btnBase, backgroundColor: "#1d4ed8", color: "#fff", boxShadow: "0 2px 4px rgba(29,78,216,0.25)" }}>
          {loading ? <LoaderCircle size={13} className="animate-spin" /> : <PlayCircle size={13} />}
          En tránsito
        </button>
        <button onClick={() => onRecepcinar(reordenamiento)} disabled={loading} style={{ ...btnBase, backgroundColor: "#065f46", color: "#fff", boxShadow: "0 2px 4px rgba(6,95,70,0.25)" }}>
          {loading ? <LoaderCircle size={13} className="animate-spin" /> : <PackageCheck size={13} />}
          Recepcionar
        </button>
      </div>
    );
  }

  if (["en_transito", "ejecutado"].includes(estado)) {
    return (
      <button onClick={() => onRecepcinar(reordenamiento)} disabled={loading} style={{ ...btnBase, backgroundColor: "#065f46", color: "#fff", boxShadow: "0 2px 4px rgba(6,95,70,0.25)" }}>
        {loading ? <LoaderCircle size={13} className="animate-spin" /> : <PackageCheck size={13} />}
        Recepcionar
      </button>
    );
  }

  if (["recepcionado"].includes(estado)) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "5px 12px", borderRadius: "9999px",
        backgroundColor: "#f0fdf4", border: "1px solid #6ee7b7",
        fontSize: "12px", fontWeight: 700, color: "#065f46",
        whiteSpace: "nowrap",
      }}>
        <CheckCircle size={13} color="#16a34a" />
        Recepcionado
      </span>
    );
  }

  return <span style={{ fontSize: "13px", color: "#9ca3af" }}>—</span>;
}

/* ── Componente principal ────────────────────────────────────── */
export default function ReordenamientoListPage() {
  const navigate    = useNavigate();
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();

  const [recepcinarTarget, setRecepcinarTarget] = useState(null);

  if (!hasRole(ROLES.ADMIN, ROLES.JEFE, ROLES.ENCARGADO_ACTIVOS)) {
    return <Navigate to="/dashboard" replace />;
  }

  /* ── Query ────────────────────────────────────────────────── */
  const { data, isLoading, isError } = useQuery({
    queryKey: ["reordenamientos"],
    queryFn: () => fetchReordenamientos(),
    staleTime: 60 * 1000,
  });

  const reordenamientos = useMemo(() => normalize(data), [data]);

  /* ── Mutations ────────────────────────────────────────────── */
  const autorizarMutation = useMutation({
    mutationFn: (id) => aprobarReordenamiento(id),
    onSuccess: () => {
      toast.success("Reordenamiento aprobado correctamente");
      queryClient.invalidateQueries({ queryKey: ["reordenamientos"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail ?? "No se pudo aprobar el reordenamiento");
    },
  });

  const ejecutarMutation = useMutation({
    mutationFn: (id) => ejecutarReordenamiento(id),
    onSuccess: () => {
      toast.success("Movimiento marcado como En tránsito");
      queryClient.invalidateQueries({ queryKey: ["reordenamientos"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail ?? "No se pudo actualizar el estado");
    },
  });

  const recepcinarMutation = useMutation({
    mutationFn: ({ id, observaciones }) => recepcinarReordenamiento(id, { observaciones_recepcion: observaciones }),
    onSuccess: () => {
      toast.success("¡Recepción confirmada! Inventario actualizado.");
      setRecepcinarTarget(null);
      queryClient.invalidateQueries({ queryKey: ["reordenamientos"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail ?? "No se pudo confirmar la recepción");
    },
  });

  const pendingId = autorizarMutation.variables ?? ejecutarMutation.variables ?? recepcinarMutation.variables?.id ?? null;
  const isPending = autorizarMutation.isPending || ejecutarMutation.isPending || recepcinarMutation.isPending;

  /* ── Render ───────────────────────────────────────────────── */
  const HEADERS = ["Fecha", "Tipo", "Equipo", "Origen", "Destino", "Cantidad", "Estado", "Doc.", "Acción"];

  return (
    <PageWrapper
      title="Reordenamientos"
      description="Historial de movimientos de equipos entre laboratorios y unidades académicas."
      actions={
        hasRole(ROLES.ADMIN, ROLES.JEFE) ? (
          <button
            onClick={() => navigate("/reordenamientos/nuevo")}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              height: "44px", padding: "0 20px", borderRadius: "10px",
              backgroundColor: "#004F9F", color: "#fff",
              fontSize: "15px", fontWeight: 700, border: "none",
              cursor: "pointer", boxShadow: "0 4px 6px rgba(0, 79, 159,0.25)",
            }}
          >
            <Plus size={18} />
            Nuevo Movimiento
          </button>
        ) : null
      }
    >
      {/* Modal de recepción */}
      {recepcinarTarget && (
        <RecepcinarModal
          reordenamiento={recepcinarTarget}
          isPending={recepcinarMutation.isPending}
          onConfirm={(observaciones) =>
            recepcinarMutation.mutate({ id: getId(recepcinarTarget), observaciones })
          }
          onCancel={() => setRecepcinarTarget(null)}
        />
      )}

      {isError && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", borderRadius: "12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", marginBottom: "24px" }}>
          <AlertCircle size={20} color="#ef4444" />
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#b91c1c" }}>No se pudieron cargar los reordenamientos.</p>
        </div>
      )}

      <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: "1050px", borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                {HEADERS.map((h) => (
                  <th key={h} style={{ padding: "13px 16px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Skeleton */}
              {isLoading && [1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  {HEADERS.map((_, j) => (
                    <td key={j} style={{ padding: "16px" }}>
                      <div style={{ height: "14px", borderRadius: "6px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}

              {/* Empty */}
              {!isLoading && reordenamientos.length === 0 && (
                <tr>
                  <td colSpan={HEADERS.length} style={{ padding: "56px 24px", textAlign: "center" }}>
                    <ArrowLeftRight size={40} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
                    <p style={{ fontSize: "17px", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>Sin reordenamientos registrados</p>
                    <p style={{ fontSize: "15px", color: "#9ca3af" }}>Crea el primer movimiento con el botón superior.</p>
                  </td>
                </tr>
              )}

              {/* Filas */}
              {!isLoading && reordenamientos.map((r, idx) => (
                <tr
                  key={getId(r) ?? idx}
                  style={{ borderBottom: idx < reordenamientos.length - 1 ? "1px solid #f3f4f6" : "none" }}
                  className="hover:bg-gray-50"
                >
                  <td style={{ padding: "13px 16px", fontSize: "13px", color: "#6b7280", fontWeight: 500, whiteSpace: "nowrap" }}>
                    {getFecha(r)}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <TipoBadge tipo={getTipo(r)} />
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>{getEquipo(r)}</p>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: "13px", color: "#374151", fontWeight: 500 }}>
                    {getOrigen(r)}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: "13px", color: "#374151", fontWeight: 500 }}>
                    {getDestino(r)}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "36px", height: "26px", padding: "0 8px", borderRadius: "6px", backgroundColor: "#f3f4f6", fontSize: "13px", fontWeight: 700, color: "#374151" }}>
                      {getCantidad(r)}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <EstadoBadge estado={getEstado(r)} />
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: "13px", color: "#6b7280" }}>
                    {tieneDoc(r) ? (
                      r.documento_url ? (
                        <a 
                          href={r.documento_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
                          className="hover:underline"
                        >
                          <Paperclip size={13} />Ver PDF
                        </a>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#2563eb", fontWeight: 600 }}>
                          <Paperclip size={13} />Sí
                        </span>
                      )
                    ) : (
                      <span style={{ color: "#d1d5db" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <ActionButton
                      reordenamiento={r}
                      onAutorizar={(id) => autorizarMutation.mutate(id)}
                      onEjecutar={(id) => ejecutarMutation.mutate(id)}
                      onRecepcinar={(reord) => setRecepcinarTarget(reord)}
                      isPending={isPending}
                      pendingId={pendingId}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && reordenamientos.length > 0 && (
          <div style={{ padding: "12px 16px", backgroundColor: "#f9fafb", borderTop: "1px solid #f3f4f6" }}>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "#9ca3af" }}>
              {reordenamientos.length} movimiento{reordenamientos.length === 1 ? "" : "s"} en total
            </p>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
