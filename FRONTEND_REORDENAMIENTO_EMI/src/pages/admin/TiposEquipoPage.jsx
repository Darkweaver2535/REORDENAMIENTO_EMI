import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  Tags,
  LoaderCircle,
  AlertCircle,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { PageWrapper } from "../../components/layout";
import {
  fetchTiposEquipo,
  createTipoEquipo,
  updateTipoEquipo,
  deleteTipoEquipo,
} from "../../api/laboratoriosApi";

const th = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "12px",
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  borderBottom: "1px solid #e5e7eb",
};
const td = { padding: "10px 12px", fontSize: "14px", color: "#374151", borderBottom: "1px solid #f3f4f6" };
const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "14px",
};

function TipoModal({ tipo, onClose, onSaved }) {
  const editando = Boolean(tipo?.id);
  const [nombre, setNombre] = useState(tipo?.nombre || "");
  const [categoria, setCategoria] = useState(tipo?.categoria || "");
  const [descripcion, setDescripcion] = useState(tipo?.descripcion || "");
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: (payload) =>
      editando ? updateTipoEquipo(tipo.id, payload) : createTipoEquipo(payload),
    onSuccess: () => onSaved(),
    onError: (err) => {
      const data = err?.response?.data;
      setError(data?.nombre?.[0] || data?.detail || "No se pudo guardar.");
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    mutation.mutate({ nombre: nombre.trim(), categoria: categoria.trim(), descripcion });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "440px",
          padding: "24px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#111827" }}>
            {editando ? "Editar tipo" : "Nuevo tipo de equipo"}
          </h3>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af" }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Nombre canónico *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} placeholder="p. ej. MICROSCOPIO" />
          </div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Categoría</label>
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} style={inputStyle} placeholder="opcional" />
          </div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }}
              placeholder="opcional"
            />
          </div>
          {error && <p style={{ fontSize: "13px", color: "#b91c1c" }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: "8px", background: "#fff", cursor: "pointer", fontSize: "14px" }}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              style={{ padding: "8px 16px", border: "none", borderRadius: "8px", background: "#003366", color: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
            >
              {mutation.isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TiposEquipoPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | {} (nuevo) | tipo (editar)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["tipos-equipo", { search, page }],
    queryFn: () =>
      fetchTiposEquipo({ ...(search ? { search } : {}), page, ordering: "-total_equipos" }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const delMutation = useMutation({
    mutationFn: (id) => deleteTipoEquipo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tipos-equipo"] }),
  });

  const payload = data?.data ?? data ?? {};
  const tipos = Array.isArray(payload.results) ? payload.results : [];
  const total = payload.count ?? tipos.length;

  const onSaved = () => {
    setModal(null);
    queryClient.invalidateQueries({ queryKey: ["tipos-equipo"] });
  };

  const handleDelete = (tipo) => {
    if (!window.confirm(`¿Eliminar el tipo "${tipo.nombre}"? Los equipos quedarán sin tipo asignado.`)) return;
    delMutation.mutate(tipo.id);
  };

  return (
    <PageWrapper
      title="Catálogo de tipos de equipo"
      description="Agrupa las unidades físicas bajo tipos canónicos para las analíticas de déficit y reordenamiento."
      actions={
        <button
          onClick={() => setModal({})}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", border: "none", borderRadius: "8px", background: "#003366", color: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}
        >
          <Plus size={16} /> Nuevo tipo
        </button>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}
        style={{ display: "flex", gap: "8px", marginBottom: "16px", maxWidth: "420px" }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar tipo o categoría…"
            style={{ ...inputStyle, paddingLeft: "32px" }}
          />
        </div>
        <button type="submit" style={{ padding: "8px 16px", background: "#003366", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
          Buscar
        </button>
      </form>

      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "64px" }}>
          <LoaderCircle size={32} className="animate-spin" style={{ color: "#003366" }} />
        </div>
      )}

      {isError && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "12px", padding: "16px" }}>
          <AlertCircle size={20} />
          <span>No se pudo cargar el catálogo: {error?.message || "error"}</span>
        </div>
      )}

      {!isLoading && !isError && (
        <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: "8px" }}>
            <Tags size={16} style={{ color: "#003366" }} />
            <span style={{ fontSize: "13px", color: "#6b7280" }}>{total} tipo{total === 1 ? "" : "s"}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Tipo</th>
                  <th style={th}>Categoría</th>
                  <th style={{ ...th, textAlign: "right" }}>Unidades</th>
                  <th style={{ ...th, textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tipos.length === 0 ? (
                  <tr>
                    <td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={4}>
                      No hay tipos para mostrar.
                    </td>
                  </tr>
                ) : (
                  tipos.map((t) => (
                    <tr key={t.id}>
                      <td style={{ ...td, fontWeight: 600, color: "#111827" }}>{t.nombre}</td>
                      <td style={td}>{t.categoria || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{t.total_equipos ?? 0}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <button onClick={() => setModal(t)} title="Editar" style={{ border: "none", background: "none", cursor: "pointer", color: "#0066CC", padding: "4px" }}>
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(t)} title="Eliminar" style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626", padding: "4px" }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>Página {page}</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!payload.previous} style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "8px", background: payload.previous ? "#fff" : "#f9fafb", color: payload.previous ? "#374151" : "#d1d5db", fontSize: "13px", cursor: payload.previous ? "pointer" : "not-allowed" }}>
                Anterior
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={!payload.next} style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "8px", background: payload.next ? "#fff" : "#f9fafb", color: payload.next ? "#374151" : "#d1d5db", fontSize: "13px", cursor: payload.next ? "pointer" : "not-allowed" }}>
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && <TipoModal tipo={modal} onClose={() => setModal(null)} onSaved={onSaved} />}
    </PageWrapper>
  );
}

export default TiposEquipoPage;
