"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const modules = [
  { label: "Importaciones", icon: "⇧", href: "/apps/imports" },
  { label: "Exportaciones", icon: "⇩", href: "/apps/exports" },
  { label: "Capas", icon: "◇", href: "/apps/layers" },
  { label: "Proyectos", icon: "▤", href: "/apps/projects" },
  { label: "Configuración", icon: "⚙", href: "/apps/settings" },
] as const;

export function AppsShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const moduleIsActive = modules.some((item) => pathname.startsWith(item.href));
  const appsIsActive =
    pathname === "/apps" || (pathname.startsWith("/apps/") && !moduleIsActive);

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
          <Link
            className={`apps-navigation-link ${appsIsActive ? "is-active" : ""}`}
            href="/apps"
          >
            <span aria-hidden="true">▦</span>
            <span>Apps</span>
          </Link>
          <p>GESTIÓN</p>
          {modules.map((item) => (
            <Link
              className={`apps-navigation-link ${pathname.startsWith(item.href) ? "is-active" : ""}`}
              href={item.href}
              key={item.label}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
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
