/* ============================================================
   EmiLogo — Marca gráfica institucional EMI (MIC 2025 v2.0)
   Isotipo: castillo de torres (amarillo #FFDD00 + trazo azul/blanco)
   Logotipo: "EMI" + "ESCUELA MILITAR DE INGENIERÍA" con línea amarilla.
   Reproduce el imagotipo del Manual de Identidad Corporativa.
   ============================================================ */

const BLUE = "#004F9F";
const BLUE_DARK = "#003D7C";

// Isotipo oficial (castillo del Arma de Ingeniería) — Marca EMI 2025.
// Full color sobre fondos claros; versión con borde blanco sobre fondo azul/oscuro.
const CASTILLO_LIGHT = "/imagenes/castillo-full-color.png";
const CASTILLO_DARK = "/imagenes/castillo-borde-blanco.png";
const CASTILLO_RATIO = 1675 / 1129; // ancho / alto

/** Isotipo — castillo oficial del Arma de Ingeniería (imagen de marca). */
export function EmiCastle({ size = 40, theme = "light", title = "EMI" }) {
  const src = theme === "dark" ? CASTILLO_DARK : CASTILLO_LIGHT;
  return (
    <img
      src={src}
      alt={title}
      width={Math.round(size * CASTILLO_RATIO)}
      height={size}
      style={{ display: "block", height: `${size}px`, width: "auto", flexShrink: 0 }}
    />
  );
}

/**
 * Imagotipo completo o parcial.
 * @param variant "full" | "mark" | "wordmark"
 * @param theme   "light" (sobre fondo claro) | "dark" (sobre fondo azul/oscuro)
 */
export default function EmiLogo({
  variant = "full",
  theme = "light",
  markSize = 40,
  subtitle = "Escuela Militar de Ingeniería",
  className,
}) {
  const textColor = theme === "dark" ? "#ffffff" : BLUE;
  const subColor = theme === "dark" ? "rgba(255,255,255,0.85)" : BLUE_DARK;

  if (variant === "mark") {
    return <EmiCastle size={markSize} theme={theme} />;
  }

  const Wordmark = (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
      <span
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 900,
          fontSize: `${markSize * 0.62}px`,
          lineHeight: 0.9,
          letterSpacing: "0.02em",
          color: textColor,
        }}
      >
        EMI
      </span>
      <div className="emi-accent-line" style={{ width: "100%", maxWidth: "160px" }} />
      {subtitle && (
        <span
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: `${Math.max(8, markSize * 0.19)}px`,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: subColor,
            whiteSpace: "nowrap",
            lineHeight: 1.1,
            marginTop: "1px",
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );

  if (variant === "wordmark") return Wordmark;

  return (
    <div
      className={className}
      style={{ display: "flex", alignItems: "center", gap: `${markSize * 0.28}px`, minWidth: 0 }}
    >
      <EmiCastle size={markSize} theme={theme} />
      {Wordmark}
    </div>
  );
}
