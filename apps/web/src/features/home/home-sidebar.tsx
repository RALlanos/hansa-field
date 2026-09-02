import Link from "next/link";

type HomeSidebarProps = { collapsed: boolean; onToggle: () => void };

const futureModules = [
  { label: "Importaciones", icon: "⇧" },
  { label: "Exportaciones", icon: "⇩" },
  { label: "Capas", icon: "◇" },
  { label: "Proyectos", icon: "▤" },
  { label: "Configuración", icon: "⚙" },
] as const;

export function HomeSidebar({ collapsed, onToggle }: HomeSidebarProps) {
  return (
    <aside className={collapsed ? "home-sidebar is-collapsed" : "home-sidebar"}>
      <div className="home-brand">
        <span aria-hidden="true" className="home-brand-mark">
          H
        </span>
        <span className="home-brand-copy">
          <strong>Hansa Field</strong>
          <small>Operaciones GIS</small>
        </span>
        <button
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          className="home-collapse"
          onClick={onToggle}
          type="button"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>
      <nav aria-label="Navegación principal" className="home-nav">
        <p>OPERACIÓN</p>
        <Link className="home-nav-link is-active" href="/apps">
          <span aria-hidden="true">▦</span>
          <span>Apps</span>
        </Link>
        <p>PRÓXIMAMENTE</p>
        {futureModules.map((item) => (
          <span
            aria-disabled="true"
            className="home-nav-link is-disabled"
            key={item.label}
            title={`${item.label}: módulo aún no implementado`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </span>
        ))}
      </nav>
      <div className="home-user">
        <span aria-hidden="true" className="home-avatar">
          JM
        </span>
        <span className="home-user-copy">
          <strong>Usuario maestro</strong>
          <small>Acceso completo</small>
        </span>
      </div>
    </aside>
  );
}
