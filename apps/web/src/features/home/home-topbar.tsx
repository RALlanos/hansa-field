export function HomeTopbar() {
  return (
    <header className="home-topbar">
      <div>
        <p className="home-kicker">Hansa Field</p>
        <h1>Inicio</h1>
      </div>
      <div className="home-topbar-actions">
        <span className="home-environment">Entorno local</span>
        <button aria-label="Ayuda" className="home-icon-button" type="button">
          ?
        </button>
        <button
          aria-label="Notificaciones"
          className="home-icon-button"
          type="button"
        >
          ♧
        </button>
        <span aria-label="Usuario maestro" className="home-avatar">
          JM
        </span>
      </div>
    </header>
  );
}
