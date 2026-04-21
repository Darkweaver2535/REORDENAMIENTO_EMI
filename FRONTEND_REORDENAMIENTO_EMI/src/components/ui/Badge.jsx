import { clsx } from "clsx";

const STATUS_MAP = {
  publicado:  { label: "Publicado",               classes: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  borrador:   { label: "Borrador",                classes: "bg-gray-100 text-gray-700 border-gray-300" },
  pendiente:  { label: "Pendiente de aprobación", classes: "bg-amber-50 text-amber-800 border-amber-300" },
  aprobado:   { label: "Aprobado",                classes: "bg-blue-50 text-blue-800 border-blue-300" },
  ejecutado:  { label: "Ejecutado",               classes: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  autorizado: { label: "Autorizado",              classes: "bg-blue-50 text-[#002B5E] border-blue-300" },
  cancelado:  { label: "Cancelado",               classes: "bg-red-50 text-red-800 border-red-300" },
};

const TONE_MAP = {
  neutral: "bg-gray-100 text-gray-700 border-gray-300",
  info:    "bg-blue-50 text-blue-800 border-blue-300",
  success: "bg-emerald-50 text-emerald-800 border-emerald-300",
  warning: "bg-amber-50 text-amber-800 border-amber-300",
  danger:  "bg-red-50 text-red-800 border-red-300",
};

function Badge({ children, estado, tone = "neutral", className }) {
  const key = typeof estado === "string" ? estado.toLowerCase() : "";
  const config = STATUS_MAP[key];
  const classes = config?.classes ?? TONE_MAP[tone] ?? TONE_MAP.neutral;
  const label = children ?? config?.label ?? "Estado";

  return (
    <span className={clsx(
      "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-bold",
      classes,
      className
    )}>
      <span className="w-2 h-2 rounded-full bg-current opacity-60 flex-shrink-0" />
      {label}
    </span>
  );
}

export default Badge;