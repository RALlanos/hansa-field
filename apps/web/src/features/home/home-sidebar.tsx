import Link from "next/link";

import { HomeIcon } from "./home-icons";

type HomeSidebarProps = { collapsed: boolean; onToggle: () => void };

const futureModules = [
  { label: "Importaciones", icon: "import" },
  { label: "Exportaciones", icon: "export" },
  { label: "Capas", icon: "layers" },
  { label: "Proyectos", icon: "projects" },
  { label: "Configuración", icon: "settings" },
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
          <HomeIcon name={collapsed ? "chevronRight" : "chevronLeft"} />
        </button>
      </div>
      <nav aria-label="Navegación principal" className="home-nav">
        <p>OPERACIÓN</p>
        <Link className="home-nav-link is-active" href="/apps">
          <HomeIcon name="apps" />
          <span>Apps</span>
        </Link>
        <Link className="home-nav-link" href="/apps/blocks">
          <HomeIcon name="apps" />
          <span>Cajones de Apps</span>
        </Link>
        <p>PRÓXIMAMENTE</p>
        {futureModules.map((item) => (
          <span
            aria-disabled="true"
            className="home-nav-link is-disabled"
            key={item.label}
            title={`${item.label}: módulo aún no implementado`}
          >
            <HomeIcon name={item.icon} />
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
