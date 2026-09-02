import Link from "next/link";

const workspaces = [
  {
    name: "Apps",
    description: "Define estructuras y administra registros maestros.",
    href: "/apps",
    action: "Ir a Apps",
    available: true,
  },
  {
    name: "Proyectos",
    description: "Organiza Apps y registros en contenedores operativos.",
    href: "/projects",
    action: "Próximamente",
    available: false,
  },
] as const;

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          HF
        </div>
        <div>
          <p className="eyebrow">Plataforma operativa</p>
          <p className="brand-name">Hansa Field</p>
        </div>
        <span className="environment-badge">Entorno local</span>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Inicio</p>
        <h1 id="page-title">Hansa Field</h1>
        <p className="intro-copy">
          Crea Apps de datos, importa información geográfica y conserva una
          única fuente confiable para cada activo.
        </p>
      </section>

      <section aria-labelledby="workspace-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Espacios de trabajo</p>
            <h2 id="workspace-title">¿Dónde quieres trabajar?</h2>
          </div>
          <p>Primera entrega en construcción</p>
        </div>

        <div className="workspace-grid">
          {workspaces.map((workspace) => (
            <article className="workspace-card" key={workspace.name}>
              <div className="workspace-icon" aria-hidden="true">
                {workspace.name.slice(0, 1)}
              </div>
              <div className="workspace-content">
                <h3>{workspace.name}</h3>
                <p>{workspace.description}</p>
              </div>
              {workspace.available ? (
                <Link className="primary-link" href={workspace.href}>
                  {workspace.action}
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <span
                  className="disabled-action"
                  aria-label="Proyectos, próximamente"
                >
                  {workspace.action}
                </span>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
