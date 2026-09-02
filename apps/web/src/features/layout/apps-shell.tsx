"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

const futureModules = [
  { label: "Importaciones", icon: "⇧" },
  { label: "Exportaciones", icon: "⇩" },
  { label: "Capas", icon: "◇" },
  { label: "Proyectos", icon: "▤" },
  { label: "Configuración", icon: "⚙" },
] as const;

export function AppsShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={collapsed ? "apps-shell is-collapsed" : "apps-shell"}>
      <aside className="apps-sidebar">
        <div className="apps-brand">
          <span aria-hidden="true" className="apps-brand-mark">
            H
          </span>
          <span className="apps-brand-copy">
            <strong>Hansa Field</strong>
            <small>Operaciones GIS</small>
          </span>
          <button
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            className="apps-collapse"
            onClick={() => setCollapsed((current) => !current)}
            type="button"
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        <nav aria-label="Navegación de Hansa Field" className="apps-navigation">
          <p>OPERACIÓN</p>
          <Link className="apps-navigation-link is-active" href="/apps">
            <span aria-hidden="true">▦</span>
            <span>Apps</span>
          </Link>
          <p>PRÓXIMAMENTE</p>
          {futureModules.map((item) => (
            <span
              aria-disabled="true"
              className="apps-navigation-link is-disabled"
              key={item.label}
              title={`${item.label}: módulo aún no implementado`}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </span>
          ))}
        </nav>
        <div className="apps-user">
          <span aria-hidden="true" className="apps-avatar">
            JM
          </span>
          <span className="apps-user-copy">
            <strong>Usuario maestro</strong>
            <small>Acceso completo</small>
          </span>
        </div>
      </aside>
      <div className="apps-shell-content">{children}</div>
    </div>
  );
}
