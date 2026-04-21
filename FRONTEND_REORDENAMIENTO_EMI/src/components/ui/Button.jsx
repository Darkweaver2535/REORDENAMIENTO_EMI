import { clsx } from "clsx";

const VARIANT_STYLES = {
  primary: {
    backgroundColor: "#002B5E",
    color: "#ffffff",
    boxShadow: "0 4px 6px rgba(0,43,94,0.25)",
  },
  secondary: {
    backgroundColor: "#ffffff",
    color: "#374151",
    border: "2px solid #e5e7eb",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  danger: {
    backgroundColor: "#dc2626",
    color: "#ffffff",
    boxShadow: "0 4px 6px rgba(220,38,38,0.25)",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "#002B5E",
  },
  outline: {
    backgroundColor: "#ffffff",
    color: "#002B5E",
    border: "2px solid rgba(0,43,94,0.3)",
  },
};

const SIZE_STYLES = {
  sm: { height: "40px", padding: "0 16px", fontSize: "14px", gap: "8px" },
  md: { height: "48px", padding: "0 24px", fontSize: "15px", gap: "10px" },
  lg: { height: "56px", padding: "0 32px", fontSize: "16px", gap: "12px" },
};

function Button({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  className,
  ...props
}) {
  const variantStyle = VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;
  const sizeStyle = SIZE_STYLES[size] ?? SIZE_STYLES.md;

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "10px",
        fontWeight: 700,
        cursor: disabled || isLoading ? "not-allowed" : "pointer",
        opacity: disabled || isLoading ? 0.5 : 1,
        border: "none",
        transition: "all 150ms ease",
        ...variantStyle,
        ...sizeStyle,
      }}
      className={className}
      {...props}
    >
      {isLoading ? (
        <svg style={{ width: "20px", height: "20px", flexShrink: 0 }} viewBox="0 0 24 24" fill="none" className="animate-spin">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" style={{ opacity: 0.75 }} />
        </svg>
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export default Button;