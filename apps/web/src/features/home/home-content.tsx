import Link from "next/link";

import { HomeIcon } from "./home-icons";

export function HomeContent() {
  return (
    <section className="home-content" aria-labelledby="home-title">
      <header className="home-intro">
        <div>
          <h1 id="home-title">Tu operación empieza en Aplicaciones</h1>
          <p>
            Configura formularios, publica versiones y administra registros
            maestros de campo desde una única superficie de trabajo.
          </p>
        </div>
        <Link className="home-primary-action" href="/apps">
          Abrir aplicaciones <HomeIcon name="arrowRight" />
        </Link>
      </header>
      <section aria-labelledby="apps-module-title" className="home-apps-focus">
        <div className="home-apps-focus-heading">
          <span aria-hidden="true" className="home-module-icon">
            <HomeIcon name="apps" />
          </span>
          <div>
            <h2 id="apps-module-title">Aplicaciones</h2>
            <p>El módulo disponible para estructurar y operar tus datos.</p>
          </div>
        </div>
        <ul className="home-capability-list">
          <li>Constructor de formularios tipados</li>
          <li>Versiones publicadas e inmutables</li>
          <li>Registros de punto, línea, polígono o sin geometría</li>
        </ul>
        <Link className="home-secondary-action" href="/apps">
          Ver catálogo de Apps <HomeIcon name="arrowRight" />
        </Link>
      </section>
      <p className="home-roadmap-note">
        Importaciones, exportaciones, capas, proyectos y configuración se
        incorporarán como módulos independientes cuando sus flujos estén listos.
      </p>
    </section>
  );
}
