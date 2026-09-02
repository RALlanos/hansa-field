import Link from "next/link";

export default function AppsPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link className="back-link" href="/">
          <span aria-hidden="true">←</span>
          Inicio
        </Link>
        <span className="environment-badge">Entorno local</span>
      </header>

      <section className="page-header" aria-labelledby="apps-title">
        <div>
          <p className="eyebrow">Fuente maestra</p>
          <h1 id="apps-title">Apps</h1>
          <p>
            Define estructuras reutilizables para puntos, líneas y polígonos.
          </p>
        </div>
        <button className="primary-button" type="button" disabled>
          Nueva App
        </button>
      </section>

      <section className="empty-state" aria-labelledby="empty-title">
        <div className="empty-symbol" aria-hidden="true">
          +
        </div>
        <h2 id="empty-title">Todavía no hay Apps</h2>
        <p>
          La persistencia se conectará en el siguiente incremento. La interfaz
          permanece bloqueada para no simular que una App fue guardada.
        </p>
        <button className="secondary-button" type="button" disabled>
          Crear primera App
        </button>
      </section>
    </main>
  );
}
