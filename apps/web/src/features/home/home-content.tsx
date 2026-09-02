import Link from "next/link";

export function HomeContent() {
  return (
    <section className="home-content" aria-labelledby="home-title">
      <div className="home-intro">
        <div>
          <p className="home-kicker">Espacio de trabajo</p>
          <h2 id="home-title">Gestiona tus aplicaciones de campo</h2>
          <p>
            Define formularios, publica sus versiones y administra los registros
            maestros de cada App.
          </p>
        </div>
        <Link className="home-primary-action" href="/apps">
          Ir a Apps <span aria-hidden="true">→</span>
        </Link>
      </div>
      <section aria-labelledby="apps-module-title" className="home-module">
        <div className="home-module-icon" aria-hidden="true">
          ▦
        </div>
        <div>
          <p className="home-kicker">Módulo disponible</p>
          <h2 id="apps-module-title">Aplicaciones</h2>
          <p>
            Crea una App, configura atributos por tipo y abre sus registros en
            mapa, tabla o vista dividida.
          </p>
        </div>
        <Link className="home-secondary-action" href="/apps">
          Abrir Apps
        </Link>
      </section>
      <section aria-labelledby="home-boundary-title" className="home-boundary">
        <h2 id="home-boundary-title">Preparación de la plataforma</h2>
        <p>
          Importaciones, proyectos, capas y configuración tendrán sus propios
          módulos. Aún no se muestran datos ni acciones simuladas en estos
          accesos.
        </p>
      </section>
    </section>
  );
}
