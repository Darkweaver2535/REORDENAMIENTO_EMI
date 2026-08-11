/**
 * LabTree.jsx — Árbol jerárquico de laboratorios SGL-EMI
 *
 * Renderiza el árbol padre-hijo devuelto por GET /api/v1/laboratorios/tree/
 * agrupado por unidad académica: cada sede es una sección colapsable con su
 * ciudad y conteos, y dentro cuelgan los laboratorios generales con sus
 * subespacios (expand/collapse animado y badges de clase/subtipo).
 *
 * Props:
 *   (ninguna requerida — el componente se auto-carga)
 *
 * Uso:
 *   import LabTree from "@/components/laboratorios/LabTree";
 *   <LabTree />
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import httpClient from "../../api/httpClient";
import { fetchLaboratoriosTree } from "../../api/laboratoriosApi";
import { API_ENDPOINTS } from "../../constants/api";
import { contiene } from "../../utils/texto";

// ── Paleta de colores por clase/subtipo ────────────────────────────────────────
const CLASE_STYLES = {
  GENERAL: {
    badge:  "background:#1e3a6e;color:#e8f0fe;",
    dot:    "#1e3a6e",
    indent: "border-left:2.5px solid #1e3a6e33;",
    label:  "General",
  },
  SUBESPACIO: {
    badge:  "background:#1a5c3a;color:#d1fae5;",
    dot:    "#1a5c3a",
    indent: "border-left:2px solid #1a5c3a22;",
    label:  "Subespacio",
  },
};

const SUBTIPO_STYLES = {
  SALA:        { badge: "background:#0e4d7a;color:#bae6fd;",   label: "Sala"        },
  AREA:        { badge: "background:#5b3a00;color:#fde68a;",   label: "Área"        },
  SECCION:     { badge: "background:#3b1f63;color:#e9d5ff;",   label: "Sección"     },
  LABORATORIO: { badge: "background:#7a1a1a;color:#fecaca;",   label: "Laboratorio" },
};

// ── Icono Chevron ─────────────────────────────────────────────────────────────
function ChevronIcon({ open, size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        flexShrink: 0,
        opacity: 0.7,
      }}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ── Icono Hoja ────────────────────────────────────────────────────────────────
function LeafIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, opacity: 0.4 }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ── Icono Sede (edificio) ─────────────────────────────────────────────────────
function SedeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
    </svg>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ styleStr, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 7px",
        borderRadius: "9999px",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.04em",
        lineHeight: 1.6,
        ...parseCssString(styleStr),
      }}
    >
      {label}
    </span>
  );
}

/** Convierte "key:val;key2:val2" a objeto de estilo React */
function parseCssString(str) {
  if (!str) return {};
  return Object.fromEntries(
    str.split(";")
      .filter(Boolean)
      .map((s) => {
        const [k, ...rest] = s.split(":");
        // camelCase conversion
        const key = k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return [key, rest.join(":").trim()];
      })
  );
}

// ── Helpers de árbol ──────────────────────────────────────────────────────────
/** ¿El nodo (o alguno de sus descendientes) coincide con la búsqueda? */
function nodoCoincide(node, q) {
  // Ignora tildes: "quimica" tiene que encontrar "QUÍMICA".
  if (contiene(node.nombre, q)) return true;
  return (node.hijos || []).some((h) => nodoCoincide(h, q));
}

/** Cuenta todos los descendientes (subespacios) de un nodo. */
function contarSubespacios(node) {
  return (node.hijos || []).reduce(
    (acc, h) => acc + 1 + contarSubespacios(h),
    0
  );
}

// ── Nodo del árbol ────────────────────────────────────────────────────────────
function LabTreeNode({ node, level = 0, forceOpen = false, navigate }) {
  const [open, setOpen] = useState(false);

  // Al buscar, los nodos cuyo descendiente coincide se expanden solos
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const tieneHijos = node.hijos && node.hijos.length > 0;
  const claseStyle = CLASE_STYLES[node.clase_nodo] || CLASE_STYLES.GENERAL;
  const subtipoStyle = node.subtipo_espacio ? SUBTIPO_STYLES[node.subtipo_espacio] : null;

  const handleToggle = useCallback(() => {
    if (tieneHijos) setOpen((prev) => !prev);
  }, [tieneHijos]);

  // Indent visual: 20px por nivel
  const paddingLeft = level * 20;

  return (
    <li
      role="treeitem"
      aria-expanded={tieneHijos ? open : undefined}
      style={{ listStyle: "none", margin: 0, padding: 0 }}
    >
      {/* ── Fila del nodo ──────────────────────────────────────────────── */}
      <div
        onClick={() => {
          if (tieneHijos) handleToggle();
          else if (node.es_hoja) navigate(`/laboratorios/${node.id}`);
        }}
        role={tieneHijos ? "button" : node.es_hoja ? "link" : undefined}
        tabIndex={tieneHijos || node.es_hoja ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (tieneHijos) handleToggle();
            else if (node.es_hoja) navigate(`/laboratorios/${node.id}`);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "6px 8px",
          padding: `7px 12px 7px ${16 + paddingLeft}px`,
          cursor: tieneHijos || node.es_hoja ? "pointer" : "default",
          borderRadius: "8px",
          transition: "background 160ms ease",
          userSelect: "none",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        {/* Expand/collapse o punto hoja */}
        <span style={{ width: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {tieneHijos ? <ChevronIcon open={open} /> : <LeafIcon />}
        </span>

        {/* Nombre — prioridad de espacio: nunca se trunca, los metadatos saltan de línea */}
        <span
          style={{
            flex: "1 1 auto",
            fontSize: level === 0 ? "14px" : "13px",
            fontWeight: level === 0 ? 700 : 500,
            color: "#111827",
            lineHeight: 1.3,
            minWidth: "150px",
          }}
          title={node.nombre}
        >
          {node.nombre}
          {tieneHijos && (
            <span style={{ color: "#9ca3af", fontSize: "11px", marginLeft: "6px", fontWeight: 500 }}>
              ({node.hijos.length} subespacio{node.hijos.length !== 1 ? "s" : ""})
            </span>
          )}
        </span>

        {/* Badges y metadatos */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0, marginLeft: "auto" }}>
          {subtipoStyle && (
            <Badge styleStr={subtipoStyle.badge} label={subtipoStyle.label} />
          )}
          {!subtipoStyle && (
            <Badge styleStr={claseStyle.badge} label={claseStyle.label} />
          )}
          {node.superficie_m2 && (
            <span style={{ fontSize: "10px", color: "#6b7280", fontWeight: 500 }}>
              {Number(node.superficie_m2).toLocaleString("es")} m²
            </span>
          )}
          {node.es_hoja && node.ubicacion && (
            <span style={{ fontSize: "10px", color: "#6b7280", fontWeight: 500, display: "flex", alignItems: "center", gap: "2px", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={node.ubicacion}>
              📍 {node.ubicacion}
            </span>
          )}
        </div>
      </div>

      {/* ── Hijos (con animación de altura) ───────────────────────────── */}
      {tieneHijos && (
        <div
          style={{
            overflow: "hidden",
            maxHeight: open ? "9999px" : "0",
            transition: "max-height 280ms cubic-bezier(0.4,0,0.2,1)",
            paddingLeft: "4px",
            borderLeft: level < 3 ? `2px solid ${claseStyle.dot}22` : "none",
            marginLeft: `${16 + paddingLeft + 7}px`,
          }}
          role="group"
        >
          <ul style={{ margin: 0, padding: 0 }}>
            {node.hijos.map((hijo) => (
              <LabTreeNode
                key={hijo.id}
                node={hijo}
                level={level + 1}
                forceOpen={forceOpen}
                navigate={navigate}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

// ── Sección por unidad académica ──────────────────────────────────────────────
function UnidadSection({ grupo, search, navigate }) {
  const [open, setOpen] = useState(true);

  const totalSubespacios = grupo.labs.reduce(
    (acc, lab) => acc + contarSubespacios(lab),
    0
  );

  return (
    <section aria-label={`Laboratorios de ${grupo.nombre}`} style={{ marginBottom: "4px" }}>
      {/* ── Cabecera de la sede ─────────────────────────────────────────── */}
      <div
        onClick={() => setOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((prev) => !prev);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          margin: "10px 12px 4px",
          padding: "10px 14px",
          borderRadius: "10px",
          background: "linear-gradient(135deg,#1e3a6e 0%,#2b4d8c 100%)",
          color: "#fff",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <ChevronIcon open={open} size={15} />
        <SedeIcon />
        <span style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "0.02em" }}>
          {grupo.nombre}
        </span>
        {grupo.ciudad && (
          <span style={{ fontSize: "12px", fontWeight: 500, opacity: 0.85 }}>
            · {grupo.ciudad}
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "11px",
            fontWeight: 600,
            padding: "2px 10px",
            borderRadius: "9999px",
            background: "rgba(255,255,255,0.16)",
          }}
        >
          {grupo.labs.length} laboratorio{grupo.labs.length !== 1 ? "s" : ""} · {totalSubespacios} subespacio{totalSubespacios !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Laboratorios de la sede ─────────────────────────────────────── */}
      {open && (
        <ul
          role="tree"
          aria-label={`Jerarquía de laboratorios de ${grupo.nombre}`}
          style={{ margin: "0 4px", padding: 0 }}
        >
          {grupo.labs.map((nodo) => (
            <LabTreeNode
              key={nodo.id}
              node={nodo}
              level={0}
              forceOpen={Boolean(search)}
              navigate={navigate}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Estados de carga / error ──────────────────────────────────────────────────
function SkeletonRow({ width = "60%" }) {
  return (
    <div
      style={{
        height: "16px",
        borderRadius: "8px",
        background: "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)",
        backgroundSize: "200% 100%",
        animation: "labTreeShimmer 1.4s infinite",
        width,
        marginBottom: "10px",
      }}
    />
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LabTree() {
  const navigate = useNavigate();
  const [tree, setTree]         = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // El árbol trae el nombre de la UA; el catálogo de unidades añade la ciudad
    Promise.all([
      fetchLaboratoriosTree(),
      httpClient
        .get(API_ENDPOINTS.estructuraAcademica.unidades)
        .catch(() => null),
    ])
      .then(([resTree, resUAs]) => {
        if (cancelled) return;
        setTree(resTree.data ?? resTree);
        const uaData = resUAs?.data ?? resUAs;
        setUnidades(uaData?.results ?? (Array.isArray(uaData) ? uaData : []));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.response?.data?.detail ||
            err?.message ||
            "Error al cargar el árbol de laboratorios."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // ── Filtro de búsqueda (raíces y subespacios, conservando la jerarquía) ──
  const q = search.trim().toLowerCase();
  const treeFiltered = q ? tree.filter((n) => nodoCoincide(n, q)) : tree;

  // ── Agrupar raíces por unidad académica ──────────────────────────────────
  const grupos = useMemo(() => {
    const ciudadPorUA = new Map(unidades.map((u) => [u.id, u.ciudad]));
    const map = new Map();
    for (const nodo of treeFiltered) {
      const id = nodo.unidad_academica_id ?? "sin-ua";
      if (!map.has(id)) {
        map.set(id, {
          id,
          nombre: nodo.unidad_academica_nombre || "Sin unidad académica",
          ciudad: ciudadPorUA.get(nodo.unidad_academica_id) || "",
          labs: [],
        });
      }
      map.get(id).labs.push(nodo);
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [treeFiltered, unidades]);

  return (
    <>
      {/* Animación shimmer */}
      <style>{`
        @keyframes labTreeShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
        aria-label="Árbol de laboratorios"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            padding: "18px 20px 14px",
            borderBottom: "1px solid #f3f4f6",
            background: "linear-gradient(135deg,#f8faff 0%,#ffffff 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "linear-gradient(135deg,#1e3a6e,#2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#111827",
                  letterSpacing: "-0.01em",
                }}
              >
                Árbol de Laboratorios por Unidad Académica
              </h2>
              <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>
                {loading
                  ? "Cargando…"
                  : `${grupos.length} unidad${grupos.length !== 1 ? "es" : ""} académica${grupos.length !== 1 ? "s" : ""} · ${treeFiltered.length} laboratorio${treeFiltered.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* Buscador */}
          <div style={{ position: "relative" }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              id="lab-tree-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar laboratorio o subespacio…"
              aria-label="Buscar en el árbol de laboratorios"
              style={{
                paddingLeft: "30px",
                paddingRight: "10px",
                paddingTop: "6px",
                paddingBottom: "6px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
                background: "#f9fafb",
                color: "#374151",
                outline: "none",
                transition: "border 180ms ease, box-shadow 180ms ease",
                width: "220px",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#2563eb";
                e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e5e7eb";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
        </div>

        {/* ── Leyenda ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            padding: "10px 20px",
            borderBottom: "1px solid #f9fafb",
            background: "#fafafa",
          }}
        >
          {[
            { label: "General",     style: CLASE_STYLES.GENERAL.badge },
            { label: "Sala",        style: SUBTIPO_STYLES.SALA.badge },
            { label: "Área",        style: SUBTIPO_STYLES.AREA.badge },
            { label: "Sección",     style: SUBTIPO_STYLES.SECCION.badge },
            { label: "Laboratorio", style: SUBTIPO_STYLES.LABORATORIO.badge },
          ].map(({ label, style }) => (
            <Badge key={label} styleStr={style} label={label} />
          ))}
          <span style={{ fontSize: "10px", color: "#9ca3af", alignSelf: "center", marginLeft: "4px" }}>
            — tipos de nodo · haz clic en una sede o laboratorio para expandirlo
          </span>
        </div>

        {/* ── Contenido ────────────────────────────────────────────────── */}
        <div style={{ padding: "8px 4px 12px", minHeight: "120px" }}>
          {loading && (
            <div style={{ padding: "16px 20px" }}>
              <SkeletonRow width="70%" />
              <SkeletonRow width="50%" />
              <SkeletonRow width="60%" />
              <SkeletonRow width="45%" />
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              style={{
                margin: "16px 20px",
                padding: "12px 16px",
                borderRadius: "10px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>
          )}

          {!loading && !error && grupos.length === 0 && (
            <div
              style={{
                padding: "32px 20px",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: "13px",
              }}
            >
              {search ? "Sin resultados para esa búsqueda." : "No hay laboratorios registrados aún."}
            </div>
          )}

          {!loading && !error && grupos.map((grupo) => (
            <UnidadSection
              key={grupo.id}
              grupo={grupo}
              search={q}
              navigate={navigate}
            />
          ))}
        </div>
      </div>
    </>
  );
}
