/**
 * LabTree.jsx — Árbol jerárquico de laboratorios SGL-EMI
 *
 * Renderiza el árbol padre-hijo devuelto por GET /api/v1/laboratorios/tree/
 * con expand/collapse animado por nivel y badges de clase/subtipo.
 *
 * Props:
 *   (ninguna requerida — el componente se auto-carga)
 *
 * Uso:
 *   import LabTree from "@/components/laboratorios/LabTree";
 *   <LabTree />
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchLaboratoriosTree } from "../../api/laboratoriosApi";

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
function ChevronIcon({ open }) {
  return (
    <svg
      width="14"
      height="14"
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

// ── Nodo del árbol ────────────────────────────────────────────────────────────
function LabTreeNode({ node, level = 0, defaultOpen = false, navigate }) {
  const [open, setOpen] = useState(defaultOpen || level === 0);
  const contentRef = useRef(null);

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
          gap: "8px",
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

        {/* Nombre */}
        <span
          style={{
            flex: 1,
            fontSize: level === 0 ? "14px" : "13px",
            fontWeight: level === 0 ? 700 : 500,
            color: "#111827",
            lineHeight: 1.3,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={node.nombre}
        >
          {node.nombre}
          {tieneHijos && (
            <span style={{ color: "#9ca3af", fontSize: "11px", marginLeft: "6px", fontWeight: 500 }}>
              ({node.hijos.length} subespacios)
            </span>
          )}
        </span>

        {/* Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
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
            <span style={{ fontSize: "10px", color: "#6b7280", fontWeight: 500, display: "flex", alignItems: "center", gap: "2px", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={node.ubicacion}>
              📍 {node.ubicacion}
            </span>
          )}
          {node.es_hoja && (
            <span
              style={{
                fontSize: "9px",
                padding: "1px 5px",
                borderRadius: "4px",
                background: "#f3f4f6",
                color: "#9ca3af",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              HOJA
            </span>
          )}
        </div>
      </div>

      {/* ── Hijos (con animación de altura) ───────────────────────────── */}
      {tieneHijos && (
        <div
          ref={contentRef}
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
                navigate={navigate}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
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
  const [tree, setTree]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchLaboratoriosTree()
      .then((res) => {
        if (!cancelled) setTree(res.data ?? res);
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

  // ── Filtro de búsqueda (filtra en la raíz por nombre) ────────────────────
  const treeFiltered = search.trim()
    ? tree.filter((n) =>
        n.nombre.toLowerCase().includes(search.trim().toLowerCase())
      )
    : tree;

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
                Árbol de Laboratorios
              </h2>
              <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af", fontWeight: 500 }}>
                {loading ? "Cargando…" : `${tree.length} nodo${tree.length !== 1 ? "s" : ""} raíz`}
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
              placeholder="Buscar raíz…"
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
                width: "180px",
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
            — tipos de nodo
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

          {!loading && !error && treeFiltered.length === 0 && (
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

          {!loading && !error && treeFiltered.length > 0 && (
            <ul role="tree" aria-label="Jerarquía de laboratorios" style={{ margin: 0, padding: 0 }}>
              {treeFiltered.map((nodo, i) => (
                <LabTreeNode
                  key={nodo.id}
                  node={nodo}
                  level={0}
                  defaultOpen={i === 0}
                  navigate={navigate}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
