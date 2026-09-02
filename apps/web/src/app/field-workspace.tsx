"use client";

import { useState } from "react";
import Link from "next/link";

const records = [
  [
    "Pendiente",
    "SN-0123",
    "Poste SN-0123",
    "Poste",
    "01/09/2026 10:21",
    "Juan Pérez",
  ],
  [
    "En proceso",
    "SN-0124",
    "Poste URU-02",
    "Poste",
    "01/09/2026 09:45",
    "Carlos Gómez",
  ],
  [
    "Completado",
    "CB-0056",
    "Cable HFC-05",
    "Cable",
    "01/09/2026 08:33",
    "Pedro Ramírez",
  ],
  [
    "Pendiente",
    "ND-0102",
    "Nodo URU-03",
    "Nodo",
    "31/08/2026 17:55",
    "Carlos Gómez",
  ],
] as const;

export function FieldWorkspace() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);

  return (
    <main className="field-app">
      <aside
        className={
          sidebarCollapsed ? "field-sidebar collapsed" : "field-sidebar"
        }
      >
        <div className="field-logo" aria-label="Hansa Field">
          <span className="field-logo-mark">⌾</span>
          <span>HANSA FIELD</span>
          <button
            aria-label="Comprimir menú"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            type="button"
          >
            ☰
          </button>
        </div>
        <nav aria-label="Principal" className="field-nav">
          <Link className="nav-item active" href="/apps">
            <span aria-hidden="true">▦</span>Apps
          </Link>
          <button
            aria-expanded={setupOpen}
            className="nav-item setup-toggle"
            onClick={() => setSetupOpen(!setupOpen)}
            type="button"
          >
            <span aria-hidden="true">⚙</span>Setup{" "}
            <i aria-hidden="true">{setupOpen ? "⌃" : "⌄"}</i>
          </button>
          {setupOpen && (
            <div className="setup-links">
              <span>CONFIGURACIÓN</span>
              <button type="button">Importaciones</button>
              <button type="button">Exportaciones</button>
              <button type="button">Capas de mapa</button>
              <span>ORGANIZACIÓN</span>
              <button type="button">Perfil de miembro</button>
              <button type="button">API</button>
            </div>
          )}
        </nav>
        <div className="user-chip">
          <span className="avatar">JM</span>
          <span>
            <strong>Usuario maestro</strong>
            <small>Acceso completo</small>
          </span>
          <span aria-hidden="true">›</span>
        </div>
      </aside>

      <section className="field-main">
        <header className="field-header">
          <h1 className="visually-hidden">Registros</h1>
          <button aria-label="Abrir menú" className="icon-button" type="button">
            ☰
          </button>
          <div className="app-selector">
            <span className="selector-icon" aria-hidden="true">
              ▦
            </span>
            <strong>APP DE PRUEBAS TIGO ROBERTO</strong>
            <span aria-hidden="true">⌄</span>
          </div>
          <div className="header-actions">
            <button aria-label="Ayuda" className="icon-button" type="button">
              ?
            </button>
            <button
              aria-label="Notificaciones"
              className="icon-button"
              type="button"
            >
              ♧
            </button>
            <button
              aria-label="Actividad"
              className="icon-button"
              type="button"
            >
              ◷
            </button>
            <button
              aria-label="Cuenta"
              className="profile-button"
              type="button"
            >
              JM
            </button>
          </div>
        </header>

        <div className="workspace-toolbar">
          <div className="search-control">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Buscar registros"
              placeholder="Buscar registros, ID o atributos"
              type="search"
            />
          </div>
          <button className="toolbar-button" type="button">
            ⏷ Filtros guardados
          </button>
          <button
            aria-label="Filtrar"
            className="icon-button bordered"
            type="button"
          >
            ▽
          </button>
          <button className="toolbar-button" type="button">
            ▣ 1.369 registros
          </button>
          <span className="toolbar-spacer" />
          <button className="secondary-action" type="button">
            ⇩ Descargar
          </button>
          <button
            aria-label="Nuevo registro"
            className="primary-action"
            type="button"
          >
            ＋ Nuevo registro
          </button>
        </div>

        <div className="workspace-content">
          <aside className="filter-panel" aria-label="Filtros de registros">
            <div className="filter-heading">
              <span>FILTROS RÁPIDOS</span>
              <button
                aria-label="Contraer filtros"
                className="text-icon"
                type="button"
              >
                ‹
              </button>
            </div>
            <fieldset>
              <legend>ACTUALIZADO</legend>
              {[
                "Todos",
                "Hoy",
                "Ayer",
                "Últimos 7 días",
                "Últimos 30 días",
              ].map((item, index) => (
                <label key={item}>
                  <input
                    defaultChecked={index === 0}
                    name="updated"
                    type="radio"
                  />
                  {item}
                  {index === 0 && <small>1.369</small>}
                </label>
              ))}
              <div className="date-row">
                <button type="button">Desde</button>
                <button type="button">Hasta</button>
              </div>
            </fieldset>
            <fieldset>
              <legend>ESTADO</legend>
              {[
                ["#f59e0b", "Pendiente", "248"],
                ["#1677db", "En proceso", "320"],
                ["#12a86e", "Completado", "624"],
                ["#e13131", "Cancelado", "21"],
              ].map(([color, label, count]) => (
                <label key={label}>
                  <input defaultChecked type="checkbox" />
                  <span className="status-dot" style={{ background: color }} />
                  {label}
                  <small>{count}</small>
                </label>
              ))}
            </fieldset>
            <div className="layer-heading">
              <span>CAPAS</span>
              <button onClick={() => setLayersOpen(!layersOpen)} type="button">
                {layersOpen ? "⌃" : "⌄"}
              </button>
            </div>
            {layersOpen && (
              <div className="layer-list">
                {[
                  ["#e83328", "Postes", "1.245"],
                  ["#147bd1", "Nodos", "412"],
                  ["#13a269", "Cables", "358"],
                  ["#f39818", "Reservas", "12"],
                  ["#8b5cf6", "Divisores", "86"],
                ].map(([color, label, count]) => (
                  <label key={label}>
                    <input defaultChecked type="checkbox" />
                    <span
                      className="status-dot"
                      style={{ background: color }}
                    />
                    {label}
                    <small>{count}</small>
                  </label>
                ))}
              </div>
            )}
            <button className="add-layer" type="button">
              ＋ Agregar capa
            </button>
          </aside>

          <section className="records-workspace">
            <div
              aria-label="Mapa de registros"
              className="map-canvas"
              role="region"
            >
              <div className="map-search">
                ⌕ <span>Buscar dirección o lugar</span>
              </div>
              <div className="map-tools">
                <button type="button">＋</button>
                <button type="button">−</button>
                <button type="button">⌖</button>
              </div>
              <div className="map-layers">▤ Todas las capas ⌄</div>
              <div className="map-label label-one">NODO URU-02</div>
              {[
                "pin-red",
                "pin-green",
                "pin-blue",
                "pin-orange",
                "pin-purple",
                "pin-green two",
                "pin-red two",
                "pin-blue two",
                "pin-orange two",
              ].map((className, index) => (
                <span className={`map-pin ${className}`} key={index} />
              ))}
              <div className="map-scale">500 m</div>
            </div>
            <div className="table-wrap">
              <table aria-label="Lista de registros">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>ID Registro</th>
                    <th>Título</th>
                    <th>Tipo</th>
                    <th>Actualizado</th>
                    <th>Técnico</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(([status, id, title, type, updated, owner]) => (
                    <tr key={id}>
                      <td>
                        <span
                          className={`table-status ${status.replace(" ", "-").toLowerCase()}`}
                        />
                        {status}
                      </td>
                      <td>{id}</td>
                      <td>{title}</td>
                      <td>{type}</td>
                      <td>{updated}</td>
                      <td>{owner}</td>
                      <td>
                        <button
                          aria-label={`Ver ${id}`}
                          className="row-action"
                          type="button"
                        >
                          ↗
                        </button>
                        <button
                          aria-label={`Más opciones para ${id}`}
                          className="row-action"
                          type="button"
                        >
                          ⋮
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <footer className="pagination">
                <span>Mostrando 1 a 50 de 1.369 registros</span>
                <span>
                  ‹ <b>1</b> 2 3 … 28 ›
                </span>
                <button type="button">50 por página⌄</button>
              </footer>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
