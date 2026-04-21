import { NavLink } from "react-router-dom";

const LINKS = [
  { label: "Guias", to: "/guias" },
  { label: "Laboratorios", to: "/laboratorios" },
  { label: "Reordenamiento", to: "/reordenamiento" },
];

function Sidebar() {
  return (
    <aside className="w-64 border-r border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">Modulos</p>
      <nav className="space-y-1">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-200"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
