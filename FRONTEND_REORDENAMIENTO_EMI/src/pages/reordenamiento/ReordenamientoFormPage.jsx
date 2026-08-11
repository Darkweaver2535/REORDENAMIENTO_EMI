// src/pages/reordenamiento/ReordenamientoFormPage.jsx
// Wizard de 4 pasos para crear un reordenamiento
// Paso 0: Tipo de movimiento
// Paso 1: Origen, Equipo y Cantidad
// Paso 2: Destino + Documento
// Paso 3: Documentación / Resolución / Confirmación
import { useMemo, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  ArrowLeft, ArrowRight, ArrowRightLeft,
  Warehouse, Package, FileText, Check, LoaderCircle, AlertCircle,
  ShoppingCart, HandshakeIcon, ArrowLeftRight, Paperclip, X,
} from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { fetchLaboratorios, fetchTodosLosEquipos } from "../../api/laboratoriosApi";
import { createReordenamiento } from "../../api/reordenamientoApi";
import { ROLES } from "../../constants/api";
import PageWrapper from "../../components/layout/PageWrapper";
import { Navigate } from "react-router-dom";

/* ── Helpers ─────────────────────────────────────────────────── */
const normalize    = (d) => { if (!d) return []; const p = d?.data ?? d; if (Array.isArray(p)) return p; return p?.results ?? p?.data ?? []; };
const getId        = (x) => x?.id ?? x?.uuid;
const getLabName   = (l) => l?.nombre ?? l?.nombre_laboratorio ?? "Laboratorio";
const getUnidadAcademica = (l) => l?.unidad_academica_nombre ?? l?.sede ?? "";
const formatLab    = (l) => l ? `${getLabName(l)}${getUnidadAcademica(l) ? " — " + getUnidadAcademica(l) : ""}` : "";
const getEquipName = (e) => e?.nombre ?? "Equipo";
const getEquipCode = (e) => e?.codigo_activo ?? e?.codigo ?? "";
const getDisponibles = (e) => Number(e?.cantidad_disponible ?? e?.cantidad_total ?? 0);

/* ── Config de tipos de movimiento ───────────────────────────── */
const TIPOS = [
  {
    value: "REASIGNACION_DEFINITIVA",
    label: "Reasignación definitiva",
    desc: "Movimiento permanente de equipos entre laboratorios. Requiere resolución y PDF.",
    icon: ArrowLeftRight,
    color: "#004F9F",
    bg: "#EFF6FF",
    border: "#bfdbfe",
  },
  {
    value: "PRESTAMO",
    label: "Préstamo",
    desc: "Movimiento temporal. Requiere fecha de retorno. Documento opcional.",
    icon: HandshakeIcon,
    color: "#065f46",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  {
    value: "COMPRA",
    label: "Compra / Ingreso",
    desc: "Documenta la recepción de un activo ya registrado en el sistema. No crea equipos nuevos. Para dar de alta un equipo nuevo ve primero a Inventario.",
    icon: ShoppingCart,
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
];

/* ── Schemas Zod por paso (dinámicos por tipo) ───────────────── */
const schemaStep0 = z.object({
  tipo_movimiento: z.string().min(1, "Selecciona el tipo de movimiento"),
});

const makeSchemaStep1 = (tipo) =>
  z.object({
    laboratorio_origen_id: tipo === "COMPRA"
      ? z.coerce.number().optional().nullable()
      : z.coerce.number().positive("Selecciona un laboratorio de origen"),
    equipo_id: z.coerce.number().positive("Selecciona un equipo"),
    cantidad_trasladada: z.coerce
      .number({ error: "Indica cuántas unidades vas a mover" })
      .min(1, "Mínimo 1 unidad"),
  });

const schemaStep2 = z.object({
  laboratorio_destino_id: z.coerce.number().positive("Selecciona laboratorio de destino"),
});

const makeSchemaStep3 = (tipo) =>
  z.object({
    numero_documento: tipo === "REASIGNACION_DEFINITIVA"
      ? z.string().min(1, "El número de resolución es obligatorio").trim()
      : z.string().optional().default(""),
    fecha_retorno_prevista: tipo === "PRESTAMO"
      ? z.string().min(1, "La fecha de retorno es obligatoria")
      : z.string().optional().nullable(),
    motivo: z.string().optional().default(""),
  });

/* ── Sub-componentes ─────────────────────────────────────────── */
function StepIndicator({ current, steps }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "36px" }}>
      {steps.map((step, i) => {
        const done   = i < current;
        const active = i === current;
        const last   = i === steps.length - 1;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: last ? undefined : 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: done ? "#16a34a" : active ? "#004F9F" : "#e5e7eb",
                color: done || active ? "#fff" : "#9ca3af",
                fontSize: "15px", fontWeight: 800, flexShrink: 0,
                transition: "all 200ms ease",
              }}>
                {done ? <Check size={18} /> : i + 1}
              </div>
              <span style={{
                fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap",
                color: active ? "#004F9F" : done ? "#15803d" : "#9ca3af",
              }}>{step}</span>
            </div>
            {!last && (
              <div style={{
                flex: 1, height: "2px", margin: "0 8px", marginBottom: "18px",
                backgroundColor: done ? "#16a34a" : "#e5e7eb",
                transition: "background-color 200ms ease",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldLabel({ children, required, htmlFor }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>
      {children}{required && <span style={{ color: "#ef4444", marginLeft: "4px" }}>*</span>}
    </label>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <p style={{ marginTop: "6px", fontSize: "13px", fontWeight: 600, color: "#dc2626" }}>{message}</p>;
}

function FieldHint({ children }) {
  return <p style={{ marginTop: "5px", fontSize: "12px", color: "#6b7280" }}>{children}</p>;
}

function StyledSelect({ id, children, error, ...props }) {
  return (
    <select
      id={id}
      style={{
        width: "100%", height: "48px", borderRadius: "8px",
        border: `1px solid ${error ? "#f87171" : "#d1d5db"}`,
        backgroundColor: "#fff", paddingLeft: "14px", paddingRight: "40px",
        fontSize: "15px", fontWeight: 500, color: "#111827",
        outline: "none", appearance: "none", cursor: "pointer",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

function StyledInput({ id, error, ...props }) {
  return (
    <input
      id={id}
      style={{
        width: "100%", height: "48px", borderRadius: "8px",
        border: `1px solid ${error ? "#f87171" : "#d1d5db"}`,
        backgroundColor: "#fff", paddingLeft: "14px", paddingRight: "14px",
        fontSize: "16px", fontWeight: 500, color: "#111827", outline: "none",
      }}
      {...props}
    />
  );
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "18px 24px", borderBottom: "1px solid #f3f4f6", backgroundColor: "#fafafa" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color="#004F9F" />
        </div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#374151" }}>{title}</h2>
      </div>
      <div style={{ padding: "24px" }}>{children}</div>
    </div>
  );
}

/* ── Componente: selector de archivo ──────────────────────────── */
function FileUpload({ onChange, value, accept, required, id, hint }) {
  const inputRef = useRef();

  const handleChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    onChange(file);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const sizeLabel = value
    ? value.size < 1024 * 1024
      ? `${(value.size / 1024).toFixed(1)} KB`
      : `${(value.size / 1024 / 1024).toFixed(2)} MB`
    : null;

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: "none" }}
      />
      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            height: "48px", padding: "0 20px", borderRadius: "8px",
            border: "2px dashed #d1d5db", backgroundColor: "#fafafa",
            fontSize: "14px", fontWeight: 600, color: "#6b7280",
            cursor: "pointer", width: "100%", justifyContent: "center",
            transition: "border-color 150ms",
          }}
        >
          <Paperclip size={16} />
          {required ? "Adjuntar documento (obligatorio)" : "Adjuntar documento (opcional)"}
        </button>
      ) : (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 16px", borderRadius: "8px",
          border: "1px solid #bbf7d0", backgroundColor: "#f0fdf4",
        }}>
          <Paperclip size={16} color="#16a34a" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "#15803d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {value.name}
            </p>
            {sizeLabel && <p style={{ fontSize: "12px", color: "#4ade80" }}>{sizeLabel}</p>}
          </div>
          <button
            type="button"
            onClick={clear}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "4px" }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

/* ── Componente principal ────────────────────────────────────── */
export default function ReordenamientoFormPage() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [archivoDoc, setArchivoDoc] = useState(null);
  const [formData, setFormData] = useState({
    tipo_movimiento: "",
    laboratorio_origen_id: "",
    equipo_id: "",
    cantidad_trasladada: 1,
    laboratorio_destino_id: "",
    numero_documento: "",
    fecha_retorno_prevista: "",
    motivo: "",
    ...(location.state?.propuesta ?? {}),
  });

  if (!hasRole(ROLES.ADMIN, ROLES.JEFE)) {
    return <Navigate to="/reordenamientos" replace />;
  }

  const tipo = formData.tipo_movimiento;
  const tipoConfig = TIPOS.find((t) => t.value === tipo);

  /* ── Forms por paso ───────────────────────────────────────── */
  const form0 = useForm({ resolver: zodResolver(schemaStep0), defaultValues: { tipo_movimiento: formData.tipo_movimiento } });
  const form1 = useForm({ resolver: zodResolver(makeSchemaStep1(tipo)), defaultValues: { laboratorio_origen_id: formData.laboratorio_origen_id, equipo_id: formData.equipo_id, cantidad_trasladada: formData.cantidad_trasladada } });
  const form2 = useForm({ resolver: zodResolver(schemaStep2), defaultValues: { laboratorio_destino_id: formData.laboratorio_destino_id } });
  const form3 = useForm({ resolver: zodResolver(makeSchemaStep3(tipo)), defaultValues: { numero_documento: formData.numero_documento, fecha_retorno_prevista: formData.fecha_retorno_prevista, motivo: formData.motivo } });

  const watchedTipo      = form0.watch("tipo_movimiento");
  const watchedOrigenId  = form1.watch("laboratorio_origen_id");
  const watchedEquipoId  = form1.watch("equipo_id");
  const watchedDestinoId = form2.watch("laboratorio_destino_id");

  /* ── Queries ──────────────────────────────────────────────── */
  const { data: labsData, isLoading: loadingLabs } = useQuery({
    queryKey: ["laboratorios", "operativos"],
    queryFn: () => fetchLaboratorios({ operativos_solo: "true" }),
    staleTime: 5 * 60 * 1000,
  });

  const isCompra = watchedTipo === "COMPRA";

  const { data: equiposData, isLoading: loadingEquipos } = useQuery({
    queryKey: ["equipos-lab", watchedOrigenId, isCompra],
    // El selector debe ofrecer TODOS los equipos del laboratorio origen;
    // paginado a 20 era imposible mover el equipo 21 en adelante.
    queryFn: () => fetchTodosLosEquipos(isCompra ? { modo: "compra" } : { laboratorio_id: watchedOrigenId }),
    enabled: isCompra || Boolean(watchedOrigenId),
  });

  const laboratorios   = useMemo(() => normalize(labsData),   [labsData]);
  const equipos        = useMemo(() => normalize(equiposData), [equiposData]);
  const selectedEquipo = useMemo(() => equipos.find((e) => String(getId(e)) === String(watchedEquipoId)), [equipos, watchedEquipoId]);
  const disponibles    = selectedEquipo ? getDisponibles(selectedEquipo) : 0;
  const destinoLabs    = useMemo(() => laboratorios.filter((l) => String(getId(l)) !== String(watchedOrigenId)), [laboratorios, watchedOrigenId]);

  /* ── Mutation ─────────────────────────────────────────────── */
  const { mutateAsync, isPending } = useMutation({
    mutationFn: createReordenamiento,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reordenamientos"] }),
  });

  /* ── Avanzar pasos ────────────────────────────────────────── */
  const goNext0 = form0.handleSubmit((values) => {
    setFormData((p) => ({ ...p, ...values }));
    setStep(1);
  });

  const goNext1 = form1.handleSubmit((values) => {
    const cantidad = Number(values.cantidad_trasladada);
    if (disponibles > 0 && cantidad > disponibles) {
      form1.setError("cantidad_trasladada", { message: `Máximo disponible: ${disponibles}` });
      return;
    }
    setFormData((p) => ({ ...p, ...values }));
    setStep(2);
  });

  const goNext2 = form2.handleSubmit((values) => {
    setFormData((p) => ({ ...p, ...values }));
    setStep(3);
  });

  const goSubmit = form3.handleSubmit(async (values) => {
    const payload = {
      tipo_movimiento: formData.tipo_movimiento,
      equipo_id: formData.equipo_id,
      laboratorio_origen_id: formData.laboratorio_origen_id || null,
      laboratorio_destino_id: formData.laboratorio_destino_id,
      cantidad_trasladada: formData.cantidad_trasladada,
      numero_documento: values.numero_documento || "",
      motivo: values.motivo || "",
      fecha_retorno_prevista: values.fecha_retorno_prevista || null,
      documento_respaldo: archivoDoc || undefined,
    };
    try {
      await mutateAsync(payload);
      toast.success("¡Movimiento creado correctamente!");
      navigate("/reordenamientos");
    } catch (error) {
      const data = error?.response?.data;
      const msg = data?.detail ?? data?.message ?? (typeof data === "string" ? data : "Error al crear el movimiento");
      toast.error(msg);
    }
  });

  const origenLab   = laboratorios.find((l) => String(getId(l)) === String(watchedOrigenId || formData.laboratorio_origen_id));
  const destinoLab  = destinoLabs.find((l) => String(getId(l)) === String(watchedDestinoId || formData.laboratorio_destino_id));
  const equipoSelec = equipos.find((e) => String(getId(e)) === String(watchedEquipoId || formData.equipo_id));

  /* ── Helper de nav buttons ────────────────────────────────── */
  const navBtnBase = {
    display: "inline-flex", alignItems: "center", gap: "8px",
    height: "46px", padding: "0 24px", borderRadius: "10px",
    fontSize: "15px", fontWeight: 700, border: "none",
    cursor: "pointer", transition: "all 150ms ease",
  };

  const STEPS = ["Tipo", "Origen y Equipo", "Destino", "Documentación"];

  return (
    <PageWrapper
      title="Nuevo movimiento"
      description="Completa los pasos para registrar un movimiento de equipos entre laboratorios."
      actions={
        <button
          onClick={() => navigate("/reordenamientos")}
          style={{ ...navBtnBase, backgroundColor: "#fff", border: "1px solid #e5e7eb", color: "#374151" }}
        >
          <ArrowLeft size={17} />
          Volver
        </button>
      }
    >
      <StepIndicator current={step} steps={STEPS} />

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* ══ PASO 0: Tipo de movimiento ════════════════════════ */}
        {step === 0 && (
          <form onSubmit={goNext0}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <SectionCard icon={ArrowRightLeft} title="¿Qué tipo de movimiento quieres registrar?">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                  {TIPOS.map((t) => {
                    const selected = watchedTipo === t.value;
                    return (
                      <label
                        key={t.value}
                        htmlFor={`tipo-${t.value}`}
                        style={{
                          display: "flex", flexDirection: "column", gap: "8px",
                          padding: "20px", borderRadius: "12px", cursor: "pointer",
                          border: `2px solid ${selected ? t.color : t.border}`,
                          backgroundColor: selected ? t.bg : "#fff",
                          transition: "all 150ms ease",
                          boxShadow: selected ? `0 0 0 3px ${t.color}22` : "none",
                        }}
                      >
                        <input
                          type="radio"
                          id={`tipo-${t.value}`}
                          value={t.value}
                          {...form0.register("tipo_movimiento")}
                          style={{ display: "none" }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: selected ? t.color : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <t.icon size={18} color={selected ? "#fff" : "#6b7280"} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: "15px", color: selected ? t.color : "#374151" }}>{t.label}</span>
                        </div>
                        <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: 1.4 }}>{t.desc}</p>
                      </label>
                    );
                  })}
                </div>
                <FieldError message={form0.formState.errors.tipo_movimiento?.message} />
              </SectionCard>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" style={{ ...navBtnBase, backgroundColor: "#004F9F", color: "#fff", boxShadow: "0 4px 6px rgba(0, 79, 159,0.25)" }}>
                  Siguiente
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ══ PASO 1: Origen y Equipo ═══════════════════════════ */}
        {step === 1 && (
          <form onSubmit={goNext1}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Badge de tipo seleccionado */}
              {tipoConfig && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", backgroundColor: tipoConfig.bg, border: `1px solid ${tipoConfig.border}`, alignSelf: "flex-start" }}>
                  <tipoConfig.icon size={15} color={tipoConfig.color} />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: tipoConfig.color }}>{tipoConfig.label}</span>
                </div>
              )}

              {/* Laboratorio de origen (ocultar para COMPRA) */}
              {tipo !== "COMPRA" && (
                <SectionCard icon={Warehouse} title="Laboratorio de Origen">
                  <div>
                    <FieldLabel htmlFor="lab-origen" required>Laboratorio Origen</FieldLabel>
                    {loadingLabs ? (
                      <div style={{ height: "48px", borderRadius: "8px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
                    ) : (
                      <StyledSelect
                        id="lab-origen"
                        error={form1.formState.errors.laboratorio_origen_id}
                        {...form1.register("laboratorio_origen_id", {
                          onChange: () => { form1.setValue("equipo_id", ""); form1.setValue("cantidad_trasladada", 1); },
                        })}
                      >
                        <option value="">Selecciona un laboratorio…</option>
                        {laboratorios.map((l) => (
                          <option key={getId(l)} value={getId(l)}>{formatLab(l)}</option>
                        ))}
                      </StyledSelect>
                    )}
                    <FieldError message={form1.formState.errors.laboratorio_origen_id?.message} />
                  </div>
                </SectionCard>
              )}

              {/* Para COMPRA: aviso doble — no requiere origen Y no crea equipos */}
              {tipo === "COMPRA" && (
                <div style={{
                  padding: "16px 18px", borderRadius: "10px",
                  backgroundColor: "#f5f3ff", border: "1px solid #c4b5fd",
                  display: "flex", flexDirection: "column", gap: "6px",
                }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#6d28d9", margin: 0 }}>
                    🛝 Este tipo documenta la recepción de un activo, no da de alta un equipo nuevo.
                  </p>
                  <p style={{ fontSize: "13px", fontWeight: 500, color: "#7c3aed", margin: 0 }}>
                    El equipo que selecciones debe existir ya en el sistema. Si aún no fue creado,
                    ve primero a <strong>Inventario → Equipos → Nuevo equipo</strong> y luego vuelve aquí.
                  </p>
                  <p style={{ fontSize: "13px", fontWeight: 500, color: "#7c3aed", margin: 0 }}>
                    No se requiere laboratorio de origen. El activo ingresará directamente al destino seleccionado.
                  </p>
                </div>
              )}

              <SectionCard icon={Package} title="Equipo">
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "20px", alignItems: "start" }}>
                  <div>
                    <FieldLabel htmlFor="equipo" required>Equipo</FieldLabel>
                    {loadingEquipos && (isCompra || watchedOrigenId) ? (
                      <div style={{ height: "48px", borderRadius: "8px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
                    ) : (
                      <StyledSelect
                        id="equipo"
                        disabled={tipo !== "COMPRA" && !watchedOrigenId}
                        error={form1.formState.errors.equipo_id}
                        {...form1.register("equipo_id", {
                          onChange: () => form1.setValue("cantidad_trasladada", 1),
                        })}
                      >
                        <option value="">{tipo !== "COMPRA" && !watchedOrigenId ? "Primero selecciona origen…" : "Selecciona un equipo…"}</option>
                        {equipos.map((e) => (
                          <option key={getId(e)} value={getId(e)}>
                            {getEquipCode(e) ? `[${getEquipCode(e)}] ` : ""}{getEquipName(e)} — {getDisponibles(e)} disponibles
                          </option>
                        ))}
                      </StyledSelect>
                    )}
                    {isCompra && !loadingEquipos && equipos.length === 0 && (
                      <p style={{ marginTop: "6px", fontSize: "13px", color: "#d97706", fontWeight: 600 }}>
                        No hay equipos activos en el sistema. Debes crear uno desde Inventario.
                      </p>
                    )}
                    <FieldError message={form1.formState.errors.equipo_id?.message} />
                  </div>

                  <div style={{ minWidth: "140px" }}>
                    <FieldLabel htmlFor="cantidad" required>Cantidad</FieldLabel>
                    <StyledInput
                      id="cantidad"
                      type="number"
                      min={1}
                      max={disponibles || undefined}
                      placeholder="0"
                      disabled={!watchedEquipoId}
                      error={form1.formState.errors.cantidad_trasladada}
                      {...form1.register("cantidad_trasladada", { valueAsNumber: true })}
                    />
                    {selectedEquipo && (
                      <p style={{ marginTop: "5px", fontSize: "13px", fontWeight: 600, color: disponibles > 0 ? "#15803d" : "#dc2626" }}>
                        {disponibles} disponibles
                      </p>
                    )}
                    <FieldError message={form1.formState.errors.cantidad_trasladada?.message} />
                  </div>
                </div>
              </SectionCard>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button type="button" onClick={() => setStep(0)} style={{ ...navBtnBase, backgroundColor: "#fff", border: "1px solid #e5e7eb", color: "#374151" }}>
                  <ArrowLeft size={17} />
                  Anterior
                </button>
                <button type="submit" style={{ ...navBtnBase, backgroundColor: "#004F9F", color: "#fff", boxShadow: "0 4px 6px rgba(0, 79, 159,0.25)" }}>
                  Siguiente
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ══ PASO 2: Destino ═══════════════════════════════════ */}
        {step === 2 && (
          <form onSubmit={goNext2}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Resumen paso 1 */}
              <div style={{ padding: "16px 20px", borderRadius: "12px", backgroundColor: "#EFF6FF", border: "1px solid #dbeafe" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#004F9F", marginBottom: "4px" }}>Resumen del origen:</p>
                <p style={{ fontSize: "15px", fontWeight: 500, color: "#374151" }}>
                  {origenLab ? formatLab(origenLab) : "Sin laboratorio origen"} · <strong>{getEquipName(equipoSelec)}</strong> · {formData.cantidad_trasladada} unidades
                </p>
              </div>

              <SectionCard icon={ArrowRightLeft} title="Laboratorio de Destino">
                <div>
                  <FieldLabel htmlFor="lab-destino" required>Laboratorio Destino</FieldLabel>
                  {loadingLabs ? (
                    <div style={{ height: "48px", borderRadius: "8px", backgroundColor: "#f3f4f6" }} className="animate-pulse" />
                  ) : (
                    <StyledSelect
                      id="lab-destino"
                      error={form2.formState.errors.laboratorio_destino_id}
                      {...form2.register("laboratorio_destino_id")}
                    >
                      <option value="">Selecciona un laboratorio de destino…</option>
                      {destinoLabs.map((l) => (
                        <option key={getId(l)} value={getId(l)}>{formatLab(l)}</option>
                      ))}
                    </StyledSelect>
                  )}
                  <FieldError message={form2.formState.errors.laboratorio_destino_id?.message} />
                </div>
              </SectionCard>

              {/* Preview flecha de movimiento */}
              {origenLab && destinoLab && (
                <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px", borderRadius: "12px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151", flex: 1, textAlign: "right" }}>{getLabName(origenLab)}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <ArrowRightLeft size={18} color="#15803d" />
                    <span style={{ fontSize: "14px", fontWeight: 800, color: "#15803d" }}>{formData.cantidad_trasladada} u.</span>
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151", flex: 1 }}>{getLabName(destinoLab)}</span>
                </div>
              )}
              {!origenLab && destinoLab && tipo === "COMPRA" && (
                <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px", borderRadius: "12px", backgroundColor: "#f5f3ff", border: "1px solid #ddd6fe" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#7c3aed" }}>🛒 Compra → {getLabName(destinoLab)}</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button type="button" onClick={() => setStep(1)} style={{ ...navBtnBase, backgroundColor: "#fff", border: "1px solid #e5e7eb", color: "#374151" }}>
                  <ArrowLeft size={17} />
                  Anterior
                </button>
                <button type="submit" style={{ ...navBtnBase, backgroundColor: "#004F9F", color: "#fff", boxShadow: "0 4px 6px rgba(0, 79, 159,0.25)" }}>
                  Siguiente
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ══ PASO 3: Documentación ══════════════════════════════ */}
        {step === 3 && (
          <form onSubmit={goSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Resumen completo */}
              <div style={{ padding: "16px 20px", borderRadius: "12px", backgroundColor: "#EFF6FF", border: "1px solid #dbeafe" }}>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#004F9F", marginBottom: "6px" }}>Resumen del movimiento:</p>
                <p style={{ fontSize: "15px", color: "#374151", fontWeight: 500, lineHeight: 1.6 }}>
                  <strong>{formData.cantidad_trasladada}</strong> unidades de <strong>{getEquipName(equipoSelec)}</strong>
                  {tipo !== "COMPRA" && origenLab && <>{" desde "}<strong>{formatLab(origenLab)}</strong></>}
                  {" hacia "}<strong>{formatLab(destinoLab)}</strong>
                </p>
              </div>

              <SectionCard icon={FileText} title="Documentación">
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                  {/* Número de documento — requerido solo para REASIGNACION */}
                  {(tipo === "REASIGNACION_DEFINITIVA" || tipo === "PRESTAMO") && (
                    <div>
                      <FieldLabel htmlFor="numero_documento" required={tipo === "REASIGNACION_DEFINITIVA"}>
                        {tipo === "REASIGNACION_DEFINITIVA" ? "N.º de Resolución" : "N.º de Autorización (opcional)"}
                      </FieldLabel>
                      <StyledInput
                        id="numero_documento"
                        type="text"
                        placeholder={tipo === "REASIGNACION_DEFINITIVA" ? "Ej: RES-2026-042" : "Ej: AUTH-2026-001 (opcional)"}
                        error={form3.formState.errors.numero_documento}
                        {...form3.register("numero_documento")}
                      />
                      <FieldError message={form3.formState.errors.numero_documento?.message} />
                    </div>
                  )}

                  {/* Fecha de retorno — solo PRESTAMO */}
                  {tipo === "PRESTAMO" && (
                    <div>
                      <FieldLabel htmlFor="fecha_retorno" required>Fecha de retorno prevista</FieldLabel>
                      <StyledInput
                        id="fecha_retorno"
                        type="date"
                        error={form3.formState.errors.fecha_retorno_prevista}
                        {...form3.register("fecha_retorno_prevista")}
                      />
                      <FieldHint>Fecha estimada en que el equipo regresará al laboratorio de origen.</FieldHint>
                      <FieldError message={form3.formState.errors.fecha_retorno_prevista?.message} />
                    </div>
                  )}

                  {/* Documento de respaldo */}
                  <div>
                    <FieldLabel required={tipo === "REASIGNACION_DEFINITIVA"}>
                      {tipo === "REASIGNACION_DEFINITIVA"
                        ? "Resolución (PDF obligatorio)"
                        : tipo === "PRESTAMO"
                          ? "Autorización adjunta (PDF/imagen, opcional)"
                          : "Documento de compra (factura, acta, etc. — opcional)"}
                    </FieldLabel>
                    <FileUpload
                      id="documento_respaldo"
                      value={archivoDoc}
                      onChange={setArchivoDoc}
                      accept={tipo === "REASIGNACION_DEFINITIVA" ? ".pdf" : ".pdf,.jpg,.jpeg,.png"}
                      required={tipo === "REASIGNACION_DEFINITIVA"}
                      hint={
                        tipo === "REASIGNACION_DEFINITIVA"
                          ? "Solo se aceptan archivos PDF."
                          : tipo === "PRESTAMO"
                            ? "Puede adjuntar una autorización simple si corresponde (PDF o imagen)."
                            : "Puede adjuntar factura, acta de entrega, orden de compra, etc."
                      }
                    />
                  </div>

                  {/* Motivo */}
                  <div>
                    <FieldLabel htmlFor="motivo">Motivo (opcional)</FieldLabel>
                    <textarea
                      id="motivo"
                      rows={2}
                      placeholder="Descripción del movimiento..."
                      style={{ width: "100%", borderRadius: "8px", border: "1px solid #d1d5db", padding: "10px 14px", fontSize: "15px", fontWeight: 500, color: "#111827", outline: "none", resize: "vertical" }}
                      {...form3.register("motivo")}
                    />
                  </div>
                </div>
              </SectionCard>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button type="button" onClick={() => setStep(2)} style={{ ...navBtnBase, backgroundColor: "#fff", border: "1px solid #e5e7eb", color: "#374151" }}>
                  <ArrowLeft size={17} />
                  Anterior
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{ ...navBtnBase, backgroundColor: "#004F9F", color: "#fff", boxShadow: "0 4px 6px rgba(0, 79, 159,0.25)", opacity: isPending ? 0.6 : 1, cursor: isPending ? "not-allowed" : "pointer" }}
                >
                  {isPending ? (
                    <><LoaderCircle size={17} className="animate-spin" />Creando...</>
                  ) : (
                    <><Check size={17} />Crear movimiento</>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </PageWrapper>
  );
}