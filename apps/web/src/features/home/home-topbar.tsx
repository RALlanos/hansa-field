import { HomeIcon } from "./home-icons";

export function HomeTopbar() {
  return (
    <header className="home-topbar">
      <div className="home-page-title">
        <span>Hansa Field</span>
        <strong>Inicio</strong>
      </div>
      <div className="home-topbar-actions">
        <span className="home-environment">Entorno local</span>
        <button aria-label="Ayuda" className="home-icon-button" type="button">
          <HomeIcon name="help" />
        </button>
        <button
          aria-label="Notificaciones"
          className="home-icon-button"
          type="button"
        >
          <HomeIcon name="bell" />
        </button>
        <span aria-label="Usuario maestro" className="home-avatar">
          JM
        </span>
      </div>
    </header>
  );
}
